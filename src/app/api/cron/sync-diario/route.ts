import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPaginado, mapEstadoDentalink, mapOrigenDentalink, mapMedioPagoDentalink } from '@/lib/dentalink'
import type { DentalinkCita, DentalinkPago } from '@/lib/dentalink'

export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET || ''

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

/**
 * Cron job: sync diario completo.
 * Corre todos los días a las 23:00 AR (02:00 UTC+1).
 * Sincroniza turnos + pagos + pacientes nuevos del día.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const hoy = new Date()

    // Rango: 7 días atrás + 30 adelante (para turnos)
    const desde = new Date()
    desde.setDate(hoy.getDate() - 7)
    const hasta = new Date()
    hasta.setDate(hoy.getDate() + 30)
    const fechaDesde = desde.toISOString().split('T')[0]
    const fechaHasta = hasta.toISOString().split('T')[0]
    const fechaHoy = hoy.toISOString().split('T')[0]

    // ── 1. Sync turnos ─────────────────────────────────────
    const citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: fechaDesde }, { lte: fechaHasta }],
    })

    let turnosInserted = 0
    if (citas.length > 0) {
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

      for (let i = 0; i < turnos.length; i += 500) {
        const batch = turnos.slice(i, i + 500)
        const { error } = await supabase.from('turnos').insert(batch)
        if (error) console.error('Turnos insert error:', error.message)
        else turnosInserted += batch.length
      }
    }

    // ── 2. Sync pagos ──────────────────────────────────────
    let pagosInserted = 0
    try {
      const pagos = await fetchPaginado<DentalinkPago>('/pagos', {
        fecha_recepcion: [{ gte: fechaDesde }, { lte: fechaHoy }],
      })

      if (pagos.length > 0) {
        const cobranzas = pagos
          .filter(p => SUCURSAL_MAP[p.id_sucursal])
          .map(p => ({
            id: crypto.randomUUID(),
            fecha: p.fecha_recepcion,
            sede_id: SUCURSAL_MAP[p.id_sucursal],
            paciente: (p.nombre_paciente || 'Sin nombre').trim(),
            tratamiento: 'Dentalink',
            tipo_pago: mapMedioPagoDentalink(p.medio_pago),
            monto: p.monto_pago,
            es_cuota: false,
            notas: p.numero_referencia ? `Ref: ${p.numero_referencia}` : null,
            dentalink_id: p.id,
          }))

        await supabase
          .from('cobranzas')
          .delete()
          .not('dentalink_id', 'is', null)
          .gte('fecha', fechaDesde)
          .lte('fecha', fechaHoy)

        for (let i = 0; i < cobranzas.length; i += 500) {
          const batch = cobranzas.slice(i, i + 500)
          const { error } = await supabase.from('cobranzas').insert(batch)
          if (error) console.error('Pagos insert error:', error.message)
          else pagosInserted += batch.length
        }
      }
    } catch (pagosError) {
      console.error('Error sync pagos:', pagosError)
    }

    // ── 3. Sync pacientes nuevos ─────────────────────────────
    let pacientesNuevos = 0
    try {
      // Use ALL fetched citas (-7 to +30 days) to discover new patients
      // Patients registered today may have appointments for future dates
      const patientIds = [...new Set(citas.map(c => c.id_paciente))]

      if (patientIds.length > 0) {
        // Check cuáles ya existen
        const existingIds = new Set<number>()
        for (let i = 0; i < patientIds.length; i += 500) {
          const batch = patientIds.slice(i, i + 500)
          const { data: existing } = await supabase
            .from('pacientes_nuevos')
            .select('id_dentalink')
            .in('id_dentalink', batch)
          if (existing) {
            for (const e of existing) existingIds.add(e.id_dentalink as number)
          }
        }

        const newIds = patientIds.filter(id => !existingIds.has(id))

        // Lookup de pacientes nuevos (5 en paralelo, 500ms entre lotes)
        for (let i = 0; i < newIds.length; i += 5) {
          const batch = newIds.slice(i, i + 5)
          const promises = batch.map(async (id) => {
            try {
              const res = await fetch(`${API_BASE}/pacientes/${id}`, {
                headers: {
                  'Authorization': `Token ${API_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              })
              if (!res.ok) return null
              const json = await res.json()
              const paciente = json.data || json
              const fechaAlta = extraerFecha(paciente['fecha_afiliacion'])
              if (!fechaAlta) return null

              const primeraCita = citas
                .filter(c => c.id_paciente === id)
                .sort((a, b) => `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`))[0]

              return {
                id_dentalink: id,
                nombre: primeraCita?.nombre_paciente?.trim() || 'Sin nombre',
                fecha_afiliacion: fechaAlta,
                primera_cita_fecha: primeraCita?.fecha || null,
                primera_cita_hora: primeraCita?.hora_inicio?.slice(0, 5) || null,
                primera_cita_profesional: primeraCita?.nombre_dentista || null,
                primera_cita_sede: primeraCita?.nombre_sucursal || null,
                primera_cita_id_sucursal: primeraCita?.id_sucursal || null,
                primera_cita_comentario: primeraCita?.comentarios || null,
                origen: detectarOrigen(primeraCita?.comentarios || ''),
              }
            } catch {
              return null
            }
          })

          const results = (await Promise.all(promises)).filter(Boolean)
          if (results.length > 0) {
            const { error } = await supabase.from('pacientes_nuevos').insert(results)
            if (error) console.error('Pacientes insert error:', error.message)
            else pacientesNuevos += results.length
          }

          if (i + 5 < newIds.length) {
            await new Promise(r => setTimeout(r, 500))
          }
        }
      }
    } catch (pacError) {
      console.error('Error sync pacientes:', pacError)
    }

    const result = {
      ok: true,
      fecha: fechaHoy,
      turnos: turnosInserted,
      pagos: pagosInserted,
      pacientes_nuevos: pacientesNuevos,
    }
    console.log('Cron sync-diario:', JSON.stringify(result))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron sync-diario error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
