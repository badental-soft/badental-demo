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

interface DentalinkPaciente {
  id: number
  nombre: string
  apellido: string
  fecha_afiliacion: string
  [key: string]: unknown
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
    // Estrategia: consultar pacientes por fecha_afiliacion (fecha de alta),
    // que es inmutable, en vez de citas por fecha_actualizacion que cambia
    // cada vez que se modifica una cita.
    const pacientes = await fetchPaginado<DentalinkPaciente>('/pacientes', {
      fecha_afiliacion: [
        { gte: `${fecha} 00:00:00` },
        { lte: `${fecha} 23:59:59` },
      ],
    })

    // Para cada paciente nuevo, buscar su primera cita
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
    }> = []

    for (const paciente of pacientes) {
      const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
        id_paciente: paciente.id,
      })

      // Tomar la primera cita (por fecha/hora)
      const primera = citas.sort((a, b) => {
        const da = `${a.fecha} ${a.hora_inicio}`
        const db = `${b.fecha} ${b.hora_inicio}`
        return da.localeCompare(db)
      })[0]

      if (primera) {
        const nombre = primera.nombre_paciente?.trim() ||
          [paciente.nombre, paciente.apellido].filter(Boolean).join(' ').trim() ||
          'Sin nombre'

        agendados.push({
          id: primera.id,
          paciente: nombre,
          fecha_turno: primera.fecha,
          hora: primera.hora_inicio?.slice(0, 5) || '',
          profesional: primera.nombre_dentista || '',
          sede: primera.nombre_sucursal || '',
          id_sucursal: primera.id_sucursal,
          estado: primera.estado_cita || '',
          comentario: primera.comentarios || '',
          origen: detectarOrigen(primera.comentarios),
        })
      }

      // Rate limiting entre consultas
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
      total_pacientes_nuevos: pacientes.length,
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
