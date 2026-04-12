import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado, mapEstadoDentalink, mapOrigenDentalink } from '@/lib/dentalink'
import type { DentalinkCita } from '@/lib/dentalink'

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

// Use service role to bypass RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mapeo estático Dentalink sucursal ID → nuestra sede UUID
const SUCURSAL_MAP: Record<number, string> = {
  1: '9c098df1-b762-4a0f-a5a9-e31f2db2f0e6', // Saavedra
  2: '8435b094-2f26-42da-b8e7-12f8e2c19f17', // Caballito
  4: '30c30867-36c8-4432-af5a-0358fe7a64b9', // Moreno
  5: '14497356-63c4-4aad-90c6-fbc1a18d67e4', // Ramos Mejía
  6: '93f30e64-4857-446d-afc1-6b55c48d4727', // Banfield
  7: '9cb6e65f-5e6a-466e-9a33-eb5f0d1a6dce', // San Isidro
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
 * Batch lookup de pacientes en Dentalink.
 * 10 en paralelo, 500ms entre lotes.
 */
async function batchFetchPacientes(
  patientIds: number[],
): Promise<Map<number, Record<string, unknown>>> {
  const results = new Map<number, Record<string, unknown>>()

  for (let i = 0; i < patientIds.length; i += 10) {
    const batch = patientIds.slice(i, i + 10)
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

    const batchResults = await Promise.all(promises)
    for (const r of batchResults) {
      if (r.data) results.set(r.id, r.data)
    }

    if (i + 10 < patientIds.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return results
}

export async function POST(request: Request) {
  try {
    // Auth check: solo admin puede sincronizar
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
    const diasAtras = body.dias || 7
    const diasAdelante = body.diasAdelante || 30

    // Calculate date range: past + future
    const hoy = new Date()
    const desde = new Date()
    desde.setDate(hoy.getDate() - diasAtras)
    const hasta = new Date()
    hasta.setDate(hoy.getDate() + diasAdelante)

    const fechaDesde = desde.toISOString().split('T')[0]
    const fechaHasta = hasta.toISOString().split('T')[0]

    // Fetch citas from Dentalink
    const citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: fechaDesde }, { lte: fechaHasta }],
    })

    if (!citas.length) {
      return NextResponse.json({ message: 'No hay citas en el rango', count: 0 })
    }

    const supabase = getSupabaseAdmin()

    // ── 1. Sync turnos (existente) ──────────────────────────

    const turnos = citas
      .filter(c => SUCURSAL_MAP[c.id_sucursal])
      .map(c => ({
        id: crypto.randomUUID(),
        fecha: c.fecha,
        hora: c.hora_inicio || '00:00',
        sede_id: SUCURSAL_MAP[c.id_sucursal],
        paciente: c.nombre_paciente || 'Sin nombre',
        profesional: c.nombre_dentista || null,
        estado: mapEstadoDentalink(c.estado_cita),
        origen: mapOrigenDentalink(),
        dentalink_id: c.id,
      }))

    await supabase
      .from('turnos')
      .delete()
      .not('dentalink_id', 'is', null)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)

    const batchSize = 500
    let inserted = 0
    for (let i = 0; i < turnos.length; i += batchSize) {
      const batch = turnos.slice(i, i + batchSize)
      const { error } = await supabase.from('turnos').insert(batch)
      if (error) {
        console.error('Insert error:', error)
        throw new Error(`Error insertando turnos: ${error.message}`)
      }
      inserted += batch.length
    }

    // ── 2. Sync pacientes nuevos ────────────────────────────

    let pacientesNuevos = 0

    try {
      // Recolectar IDs únicos de pacientes de las citas
      const allPatientIds = [...new Set(citas.map(c => c.id_paciente))]

      // Verificar cuáles ya tenemos en pacientes_nuevos
      // (consultar en lotes de 500 para evitar query demasiado larga)
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

      if (newPatientIds.length > 0) {
        // Batch lookup de pacientes nuevos en Dentalink
        const pacientesData = await batchFetchPacientes(newPatientIds)

        // Preparar inserts
        const toInsert: Array<Record<string, unknown>> = []

        for (const [patientId, paciente] of pacientesData.entries()) {
          const fechaAlta = extraerFecha(paciente['fecha_afiliacion'])
          if (!fechaAlta) continue

          // Encontrar la primera cita de este paciente (por fecha/hora)
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

        // Insert en lotes
        for (let i = 0; i < toInsert.length; i += 200) {
          const batch = toInsert.slice(i, i + 200)
          const { error } = await supabase.from('pacientes_nuevos').insert(batch)
          if (error) {
            console.error('Error insertando pacientes_nuevos:', error.message)
          } else {
            pacientesNuevos += batch.length
          }
        }
      }
    } catch (pacError) {
      // No romper el sync de turnos si falla el de pacientes
      console.error('Error en sync de pacientes:', pacError)
    }

    return NextResponse.json({
      message: `${inserted} turnos sincronizados, ${pacientesNuevos} pacientes nuevos registrados`,
      rango: `${fechaDesde} → ${fechaHasta}`,
      total_dentalink: citas.length,
      insertados: inserted,
      omitidos: citas.length - turnos.length,
      pacientes_nuevos: pacientesNuevos,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
