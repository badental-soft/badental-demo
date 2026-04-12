import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPaginado } from '@/lib/dentalink'
import type { DentalinkCita } from '@/lib/dentalink'

export const maxDuration = 60

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
  if (c.includes('fb') || c.includes('facebook')) return 'Facebook'
  return 'Otro'
}

function extraerFecha(valor: unknown): string {
  if (!valor || typeof valor !== 'string') return ''
  return valor.split(' ')[0].split('T')[0]
}

function getArgentinaHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

interface DentalinkPaciente {
  id: number
  nombre: string
  apellido: string
  fecha_afiliacion: string
  [key: string]: unknown
}

/**
 * Sync pacientes nuevos del día.
 * Estrategia: buscar pacientes por fecha_afiliacion=hoy en la API de Dentalink.
 * Esto captura pacientes dados de alta hoy sin importar cuándo es su turno.
 */
async function syncPacientesHoy(hoy: string) {
  const admin = getSupabaseAdmin()
  let saved = 0

  // ── Estrategia 1: buscar pacientes por fecha_afiliacion ──
  try {
    const pacientesAPI = await fetchPaginado<DentalinkPaciente>('/pacientes', {
      fecha_afiliacion: [{ gte: hoy }, { lte: hoy }],
    })

    // Double-check fecha_afiliacion matches (API might be loose)
    const pacientesHoy = pacientesAPI.filter(p => extraerFecha(p.fecha_afiliacion) === hoy)

    if (pacientesHoy.length > 0) {
      // Check which are new
      const ids = pacientesHoy.map(p => p.id)
      const existingIds = new Set<number>()
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500)
        const { data } = await admin.from('pacientes_nuevos').select('id_dentalink').in('id_dentalink', batch)
        if (data) data.forEach(e => existingIds.add(e.id_dentalink as number))
      }

      const newPacientes = pacientesHoy.filter(p => !existingIds.has(p.id))
      if (newPacientes.length === 0) return 0

      // Fetch citas to get appointment details (sede, profesional, comentario)
      let citas: DentalinkCita[] = []
      try {
        const hasta = new Date()
        hasta.setDate(hasta.getDate() + 60)
        const fechaHasta = hasta.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        citas = await fetchPaginado<DentalinkCita>('/citas', {
          fecha: [{ gte: hoy }, { lte: fechaHasta }],
        })
      } catch {
        // If cita fetch fails, still save patients without cita details
      }

      const toInsert = newPacientes.map(p => {
        const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre'
        const primeraCita = citas
          .filter(c => c.id_paciente === p.id)
          .sort((a, b) => `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`))[0]

        return {
          id_dentalink: p.id,
          nombre: primeraCita?.nombre_paciente?.trim() || nombre,
          fecha_afiliacion: hoy,
          primera_cita_fecha: primeraCita?.fecha || null,
          primera_cita_hora: primeraCita?.hora_inicio?.slice(0, 5) || null,
          primera_cita_profesional: primeraCita?.nombre_dentista || null,
          primera_cita_sede: primeraCita?.nombre_sucursal || null,
          primera_cita_id_sucursal: primeraCita?.id_sucursal || null,
          primera_cita_comentario: primeraCita?.comentarios || null,
          origen: detectarOrigen(primeraCita?.comentarios || ''),
        }
      })

      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500)
        const { error } = await admin.from('pacientes_nuevos').insert(batch)
        if (error) console.error('Insert error:', error.message)
        else saved += batch.length
      }

      return saved
    }
  } catch (err) {
    console.log('Pacientes API fecha_afiliacion filter failed, trying cita fallback:', err)
  }

  // ── Estrategia 2 (fallback): buscar por citas recientes ──
  try {
    const hasta = new Date()
    hasta.setDate(hasta.getDate() + 30)
    const fechaHasta = hasta.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

    const citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: hoy }, { lte: fechaHasta }],
    })

    const patientIds = [...new Set(citas.map(c => c.id_paciente))]
    if (patientIds.length === 0) return 0

    const existingIds = new Set<number>()
    for (let i = 0; i < patientIds.length; i += 500) {
      const batch = patientIds.slice(i, i + 500)
      const { data } = await admin.from('pacientes_nuevos').select('id_dentalink').in('id_dentalink', batch)
      if (data) data.forEach(e => existingIds.add(e.id_dentalink as number))
    }

    const newIds = patientIds.filter(id => !existingIds.has(id))
    if (newIds.length === 0) return 0

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
        const { error } = await admin.from('pacientes_nuevos').insert(results)
        if (error) console.error('Insert error:', error.message)
        else saved += results.length
      }

      if (i + 5 < newIds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }
  } catch (err) {
    console.error('Cita fallback also failed:', err)
  }

  return saved
}

export async function GET(request: Request) {
  const supabase = await createServerClient()

  // Auth check: admin y rolA
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', authUser.id)
    .single()
  if (!profile || !['admin', 'rolA'].includes(profile.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')

  if (!fecha) {
    return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 })
  }

  const hoy = getArgentinaHoy()

  // Si es hoy: sync en vivo desde Dentalink antes de consultar
  let syncCount = 0
  if (fecha === hoy) {
    try {
      syncCount = await syncPacientesHoy(hoy)
    } catch (err) {
      console.error('Error syncing pacientes hoy:', err)
    }
  }

  // Consultar desde Supabase
  const { data: pacientes, error } = await supabase
    .from('pacientes_nuevos')
    .select('*')
    .eq('fecha_afiliacion', fecha)
    .order('nombre')

  if (error) {
    console.error('Error querying pacientes_nuevos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (pacientes || []) as unknown as Array<{
    id: string
    id_dentalink: number
    nombre: string
    fecha_afiliacion: string
    primera_cita_fecha: string | null
    primera_cita_hora: string | null
    primera_cita_profesional: string | null
    primera_cita_sede: string | null
    primera_cita_id_sucursal: number | null
    primera_cita_comentario: string | null
    origen: string | null
  }>

  const agendados = rows.map(p => ({
    id: p.id_dentalink,
    paciente: p.nombre,
    fecha_turno: p.primera_cita_fecha || '',
    hora: p.primera_cita_hora || '',
    profesional: p.primera_cita_profesional || '',
    sede: p.primera_cita_sede || '',
    id_sucursal: p.primera_cita_id_sucursal || 0,
    estado: '',
    comentario: p.primera_cita_comentario || '',
    origen: p.origen || detectarOrigen(p.primera_cita_comentario || ''),
  }))

  // Resumen
  const porSede: Record<string, number> = {}
  const porOrigen: Record<string, number> = {}
  agendados.forEach(a => {
    if (a.sede) porSede[a.sede] = (porSede[a.sede] || 0) + 1
    porOrigen[a.origen] = (porOrigen[a.origen] || 0) + 1
  })

  return NextResponse.json({
    fecha,
    total: agendados.length,
    por_sede: porSede,
    por_origen: porOrigen,
    agendados,
    ...(fecha === hoy ? { synced: syncCount } : {}),
  })
}
