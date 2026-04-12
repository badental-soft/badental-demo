import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'
import type { DentalinkCita } from '@/lib/dentalink'

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function detectarOrigen(comentario: string): string {
  const c = (comentario || '').toLowerCase()
  if (c.includes('ig') || c.includes('insta') || c.includes('instagram')) return 'Instagram'
  if (c.includes('wp') || c.includes('ws') || c.includes('wsp') || c.includes('whatsapp') || c.includes('wapp')) return 'WhatsApp'
  if (c.includes('web') || c.includes('pag') || c.includes('página') || c.includes('pagina')) return 'Web'
  if (c.includes('tel') || c.includes('llamad') || c.includes('llamó') || c.includes('llamo')) return 'Teléfono'
  if (c.includes('referi') || c.includes('conocido') || c.includes('recomend')) return 'Referido'
  return 'Otro'
}

function extraerFecha(valor: unknown): string {
  if (!valor || typeof valor !== 'string') return ''
  return valor.split(' ')[0].split('T')[0]
}

/**
 * Endpoint de backfill: sincroniza pacientes nuevos para un rango de fechas.
 * Diseñado para ejecutarse múltiples veces (idempotente — ignora duplicados).
 *
 * POST /api/sync-pacientes
 * Body: { desde: "2026-01-01", hasta: "2026-04-12" }
 */
export async function POST(request: Request) {
  try {
    // Auth: solo admin
    const supabaseAuth = await createServerClient()
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { data: profile } = await supabaseAuth
      .from('users')
      .select('rol')
      .eq('id', authUser.id)
      .single()
    if (!profile || profile.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const desde = body.desde || '2026-01-01'
    const hasta = body.hasta || new Date().toISOString().split('T')[0]

    const supabase = getSupabaseAdmin()

    // 1. Fetch all citas in the date range from Dentalink
    const citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: desde }, { lte: hasta }],
    })

    // 2. Get unique patient IDs
    const allPatientIds = [...new Set(citas.map(c => c.id_paciente))]

    // 3. Check which we already have
    const existingIds = new Set<number>()
    for (let i = 0; i < allPatientIds.length; i += 500) {
      const batch = allPatientIds.slice(i, i + 500)
      const { data: existing } = await supabase
        .from('pacientes_nuevos')
        .select('id_dentalink')
        .in('id_dentalink', batch)
      if (existing) {
        for (const e of existing) {
          existingIds.add(e.id_dentalink as number)
        }
      }
    }

    const newPatientIds = allPatientIds.filter(id => !existingIds.has(id))

    // 4. Batch lookup patient details from Dentalink (10 parallel, 500ms between)
    const pacientesData = new Map<number, Record<string, unknown>>()
    let lookupsFailed = 0

    for (let i = 0; i < newPatientIds.length; i += 10) {
      const batch = newPatientIds.slice(i, i + 10)
      const promises = batch.map(async (id) => {
        try {
          const res = await fetch(`${API_BASE}/pacientes/${id}`, {
            headers: {
              'Authorization': `Token ${API_TOKEN}`,
              'Content-Type': 'application/json',
            },
          })
          if (!res.ok) return { id, data: null }
          const json = await res.json()
          return { id, data: json.data || json }
        } catch {
          return { id, data: null }
        }
      })

      const results = await Promise.all(promises)
      for (const r of results) {
        if (r.data) pacientesData.set(r.id, r.data)
        else lookupsFailed++
      }

      if (i + 10 < newPatientIds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // 5. Prepare and insert
    const toInsert: Array<Record<string, unknown>> = []

    for (const [patientId, paciente] of pacientesData.entries()) {
      const fechaAlta = extraerFecha(paciente['fecha_afiliacion'])
      if (!fechaAlta) continue

      const primeraCita = citas
        .filter(c => c.id_paciente === patientId)
        .sort((a, b) => `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`))[0]

      toInsert.push({
        id_dentalink: patientId,
        nombre: primeraCita?.nombre_paciente?.trim() || 'Sin nombre',
        fecha_afiliacion: fechaAlta,
        primera_cita_fecha: primeraCita?.fecha || null,
        primera_cita_hora: primeraCita?.hora_inicio?.slice(0, 5) || null,
        primera_cita_profesional: primeraCita?.nombre_dentista || null,
        primera_cita_sede: primeraCita?.nombre_sucursal || null,
        primera_cita_id_sucursal: primeraCita?.id_sucursal || null,
        primera_cita_comentario: primeraCita?.comentarios || null,
        origen: detectarOrigen(primeraCita?.comentarios || ''),
      })
    }

    let insertados = 0
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200)
      const { error } = await supabase.from('pacientes_nuevos').insert(batch)
      if (error) {
        console.error('Insert error:', error.message)
      } else {
        insertados += batch.length
      }
    }

    return NextResponse.json({
      message: `${insertados} pacientes nuevos sincronizados`,
      rango: `${desde} → ${hasta}`,
      total_citas: citas.length,
      pacientes_unicos: allPatientIds.length,
      ya_existentes: existingIds.size,
      nuevos_encontrados: newPatientIds.length,
      lookups_ok: pacientesData.size,
      lookups_failed: lookupsFailed,
      insertados,
    })
  } catch (error) {
    console.error('Sync pacientes error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
