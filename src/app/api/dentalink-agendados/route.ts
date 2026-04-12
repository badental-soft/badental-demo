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
 * Consulta un paciente individual en Dentalink para obtener su fecha de alta.
 */
async function fetchPaciente(idPaciente: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/pacientes/${idPaciente}`, {
      headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data || json
  } catch {
    return null
  }
}

function getFechaAltaPaciente(paciente: Record<string, unknown>): string {
  const valor = paciente['fecha_afiliacion']
  if (valor && typeof valor === 'string') {
    return valor.split(' ')[0].split('T')[0]
  }
  return ''
}

export async function GET(request: Request) {
  // Auth check: admin y rolA
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
  if (!profile || !['admin', 'rolA'].includes(profile.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') // YYYY-MM-DD

  if (!fecha) {
    return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 })
  }

  try {
    // Usar campo "fecha" (fecha de la cita, inmutable) en vez de
    // "fecha_actualizacion" que cambia cada vez que se modifica la cita.
    const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha: [
        { gte: `${fecha}` },
        { lte: `${fecha}` },
      ],
    })

    // Filtrar citas de primera vez por comentario
    const citasPrimeraVez = citas.filter(c => esPrimeraVez(c.comentarios))

    // Para cada cita primera vez, verificar fecha_afiliacion del paciente
    // Deduplicar por id_paciente (un paciente puede tener varias citas el mismo día)
    const pacientesVistos = new Set<number>()
    const agendados: Array<{
      id: number
      paciente: string
      fecha_turno: string
      hora: string
      profesional: string
      sede: string
      id_sucursal: number
      estado: string
      comentario: string
      origen: string
      fecha_alta: string
    }> = []

    for (const cita of citasPrimeraVez) {
      if (pacientesVistos.has(cita.id_paciente)) continue
      pacientesVistos.add(cita.id_paciente)

      const paciente = await fetchPaciente(cita.id_paciente)
      const fechaAlta = paciente ? getFechaAltaPaciente(paciente) : ''

      agendados.push({
        id: cita.id,
        paciente: cita.nombre_paciente?.trim() || 'Sin nombre',
        fecha_turno: cita.fecha,
        hora: cita.hora_inicio?.slice(0, 5) || '',
        profesional: cita.nombre_dentista || '',
        sede: cita.nombre_sucursal || '',
        id_sucursal: cita.id_sucursal,
        estado: cita.estado_cita || '',
        comentario: cita.comentarios || '',
        origen: detectarOrigen(cita.comentarios),
        fecha_alta: fechaAlta,
      })

      // Rate limiting
      await new Promise(r => setTimeout(r, 150))
    }

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
      total_citas_dia: citas.length,
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
