import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

interface DentalinkCitaFull {
  id: number
  id_paciente: number
  nombre_paciente: string
  nombre_social_paciente: string
  id_estado: number
  estado_cita: string
  id_tratamiento: number
  nombre_tratamiento: string
  id_dentista: number
  nombre_dentista: string
  id_sucursal: number
  nombre_sucursal: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  duracion: number
  comentarios: string
  fecha_actualizacion: string
}

function esPrimeraVez(comentario: string): boolean {
  const c = (comentario || '').toLowerCase()
  return (
    c.includes('primera vez') ||
    c.includes('1ra vez') ||
    c.includes('1° vez') ||
    c.includes('1era vez') ||
    c.includes('primer vez') ||
    c.includes('primera consulta') ||
    c.includes('paciente nuevo') ||
    c.includes('pac nuevo') ||
    c.includes('pac nueva')
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

/**
 * Consulta un paciente individual en Dentalink para obtener su fecha de creación.
 * Devuelve el objeto completo del paciente o null si falla.
 */
async function fetchPaciente(idPaciente: number, retries = 2): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/pacientes/${idPaciente}`, {
        headers: {
          'Authorization': `Token ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })
      if (res.status === 429) {
        // Rate limited — wait and retry
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      if (!res.ok) return null
      const json = await res.json()
      return json.data || json
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300))
        continue
      }
      return null
    }
  }
  return null
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Extrae la fecha (YYYY-MM-DD) de afiliación/alta del paciente en Dentalink.
 */
function getFechaAltaPaciente(paciente: Record<string, unknown>): string {
  const valor = paciente['fecha_afiliacion']
  if (valor && typeof valor === 'string') {
    // Puede venir como "2026-03-28 10:30:00" o "2026-03-28"
    return valor.split(' ')[0].split('T')[0]
  }
  return ''
}

export async function GET(request: Request) {
  // Auth check: solo admin
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', authUser.id)
    .single()
  if (!profile || profile.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') // YYYY-MM-DD

  if (!fecha) {
    return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 })
  }

  try {
    // 1. Traer citas actualizadas en la fecha seleccionada
    const citasHoy = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha_actualizacion: [
        { gte: `${fecha} 00:00:00` },
        { lte: `${fecha} 23:59:59` },
      ],
    })

    // 2. Filtrar solo "primera vez" por comentario
    const citasPrimeraVez = citasHoy.filter(c => esPrimeraVez(c.comentarios))

    // 3. Para cada cita "primera vez", consultar fecha_afiliacion del paciente
    //    en paralelo (batches de 10 para no saturar la API)
    const citasConFecha: (DentalinkCitaFull & { fecha_afiliacion: string })[] = []
    const BATCH_SIZE = 5

    for (let i = 0; i < citasPrimeraVez.length; i += BATCH_SIZE) {
      const batch = citasPrimeraVez.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (cita) => {
          const paciente = await fetchPaciente(cita.id_paciente)
          const fechaAlta = paciente ? getFechaAltaPaciente(paciente) : ''
          return { ...cita, fecha_afiliacion: fechaAlta }
        })
      )
      citasConFecha.push(...results)
      // Delay entre batches para no saturar la API de Dentalink
      if (i + BATCH_SIZE < citasPrimeraVez.length) {
        await delay(200)
      }
    }

    // 4. Filtrar: solo pacientes afiliados/dados de alta en la fecha seleccionada
    const citasNuevas = citasConFecha.filter(c => c.fecha_afiliacion === fecha)

    const agendados = citasNuevas.map(c => ({
      id: c.id,
      paciente: c.nombre_paciente?.trim() || 'Sin nombre',
      fecha_turno: c.fecha,
      hora: c.hora_inicio?.slice(0, 5) || '',
      profesional: c.nombre_dentista || '',
      sede: c.nombre_sucursal || '',
      id_sucursal: c.id_sucursal,
      estado: c.estado_cita || '',
      comentario: c.comentarios || '',
      origen: detectarOrigen(c.comentarios),
      fecha_actualizacion: c.fecha_actualizacion,
    }))

    // Resumen
    const porSede: Record<string, number> = {}
    const porOrigen: Record<string, number> = {}
    agendados.forEach(a => {
      porSede[a.sede] = (porSede[a.sede] || 0) + 1
      porOrigen[a.origen] = (porOrigen[a.origen] || 0) + 1
    })

    return NextResponse.json({
      fecha,
      total: agendados.length,
      total_modificados: citasHoy.length,
      por_sede: porSede,
      por_origen: porOrigen,
      agendados,
    })
  } catch (error) {
    console.error('Error fetching agendados:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
