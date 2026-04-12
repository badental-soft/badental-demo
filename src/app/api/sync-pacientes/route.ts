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
 * Genera rangos mensuales entre dos fechas.
 * Ej: 2026-01-01 → 2026-04-12 produce:
 *   [2026-01-01, 2026-01-31], [2026-02-01, 2026-02-28], [2026-03-01, 2026-03-31], [2026-04-01, 2026-04-12]
 */
function generarRangosMensuales(desde: string, hasta: string): Array<{ desde: string; hasta: string }> {
  const rangos: Array<{ desde: string; hasta: string }> = []
  const fechaFin = new Date(hasta + 'T12:00:00Z')
  let cursor = new Date(desde + 'T12:00:00Z')

  while (cursor <= fechaFin) {
    const mesInicio = cursor.toISOString().split('T')[0]
    // Fin del mes o fecha final, lo que sea menor
    const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const mesFin = finMes <= fechaFin
      ? finMes.toISOString().split('T')[0]
      : hasta

    rangos.push({ desde: mesInicio, hasta: mesFin })

    // Avanzar al primer día del siguiente mes
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12, 0, 0)
  }

  return rangos
}

/**
 * Endpoint de backfill: sincroniza pacientes nuevos para un rango de fechas.
 * Procesa mes a mes para evitar rate limiting de Dentalink.
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
    const rangos = generarRangosMensuales(desde, hasta)

    let totalCitas = 0
    let totalInsertados = 0
    let totalYaExistentes = 0
    let totalLookupsFailed = 0

    for (const rango of rangos) {
      console.log(`Sync pacientes: procesando ${rango.desde} → ${rango.hasta}`)

      // 1. Fetch citas del mes
      const citas = await fetchPaginado<DentalinkCita>('/citas', {
        fecha: [{ gte: rango.desde }, { lte: rango.hasta }],
      })
      totalCitas += citas.length

      if (!citas.length) continue

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
      totalYaExistentes += existingIds.size

      const newPatientIds = allPatientIds.filter(id => !existingIds.has(id))
      if (!newPatientIds.length) continue

      // 4. Batch lookup patient details (5 parallel, 1s between batches to avoid 429)
      const pacientesData = new Map<number, Record<string, unknown>>()

      for (let i = 0; i < newPatientIds.length; i += 5) {
        const batch = newPatientIds.slice(i, i + 5)
        const promises = batch.map(async (id) => {
          try {
            const res = await fetch(`${API_BASE}/pacientes/${id}`, {
              headers: {
                'Authorization': `Token ${API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            })
            if (res.status === 429) {
              // Wait and retry once
              await new Promise(r => setTimeout(r, 3000))
              const retry = await fetch(`${API_BASE}/pacientes/${id}`, {
                headers: {
                  'Authorization': `Token ${API_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              })
              if (!retry.ok) return { id, data: null }
              const json = await retry.json()
              return { id, data: json.data || json }
            }
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
          else totalLookupsFailed++
        }

        // Wait 1s between batches
        if (i + 5 < newPatientIds.length) {
          await new Promise(r => setTimeout(r, 1000))
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

      for (let i = 0; i < toInsert.length; i += 200) {
        const batch = toInsert.slice(i, i + 200)
        const { error } = await supabase.from('pacientes_nuevos').insert(batch)
        if (error) {
          console.error('Insert error:', error.message)
        } else {
          totalInsertados += batch.length
        }
      }

      // Pause 3s between months to avoid rate limiting
      await new Promise(r => setTimeout(r, 3000))
    }

    return NextResponse.json({
      message: `${totalInsertados} pacientes nuevos sincronizados`,
      rango: `${desde} → ${hasta}`,
      meses_procesados: rangos.length,
      total_citas: totalCitas,
      ya_existentes: totalYaExistentes,
      insertados: totalInsertados,
      lookups_failed: totalLookupsFailed,
    })
  } catch (error) {
    console.error('Sync pacientes error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
