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
  if (c.includes('ig') || c.includes('instagram')) return 'Instagram'
  if (c.includes('web')) return 'Web'
  if (c.includes('wp') || c.includes('whatsapp')) return 'WhatsApp'
  if (c.includes('tel') || c.includes('llamad')) return 'Teléfono'
  return 'Otro'
}

/**
 * Consulta un paciente individual en Dentalink para obtener su fecha de creación.
 * Devuelve el objeto completo del paciente o null si falla.
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
    // Dentalink puede devolver { data: {...} } o directamente el objeto
    return json.data || json
  } catch {
    return null
  }
}

/**
 * Extrae la fecha (YYYY-MM-DD) de creación de un paciente.
 * Prueba varios campos posibles que Dentalink podría usar.
 */
function getFechaCreacionPaciente(paciente: Record<string, unknown>): string {
  // Probar los campos más comunes
  const campos = [
    'fecha_creacion',
    'fecha_ingreso',
    'created_at',
    'fecha_registro',
    'fecha_alta',
    'creacion',
  ]

  for (const campo of campos) {
    const valor = paciente[campo]
    if (valor && typeof valor === 'string') {
      // Puede venir como "2026-03-28 10:30:00" o "2026-03-28"
      return valor.split(' ')[0].split('T')[0]
    }
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

    // 3. Para cada cita "primera vez", consultar el paciente en Dentalink
    //    y verificar que fue creado el mismo día (fecha seleccionada)
    let metodo = 'primera_vez_only'
    let campoFechaDetectado = ''
    const debugPacientes: Record<number, unknown> = {}

    // Consultar pacientes (con rate limiting)
    const citasConPaciente: (DentalinkCitaFull & { paciente_creado_hoy: boolean })[] = []

    for (const cita of citasPrimeraVez) {
      const paciente = await fetchPaciente(cita.id_paciente)

      if (paciente) {
        const fechaCreacion = getFechaCreacionPaciente(paciente)

        // Debug: guardar info del primer paciente para ver estructura
        if (Object.keys(debugPacientes).length < 2) {
          debugPacientes[cita.id_paciente] = {
            campos_fecha: Object.keys(paciente).filter(k =>
              k.includes('fecha') || k.includes('date') || k.includes('creat') || k.includes('ingres')
            ),
            fecha_detectada: fechaCreacion,
            todos_los_campos: Object.keys(paciente),
          }
        }

        if (fechaCreacion) {
          campoFechaDetectado = fechaCreacion
          citasConPaciente.push({ ...cita, paciente_creado_hoy: fechaCreacion === fecha })
        } else {
          // No se encontró campo de fecha, incluir por las dudas
          citasConPaciente.push({ ...cita, paciente_creado_hoy: true })
        }
      } else {
        // No se pudo consultar paciente, incluir por las dudas
        citasConPaciente.push({ ...cita, paciente_creado_hoy: true })
      }

      // Rate limiting entre consultas
      await new Promise(r => setTimeout(r, 200))
    }

    // Si pudimos detectar fechas, filtrar solo los creados hoy
    const hayFechas = citasConPaciente.some(c => campoFechaDetectado !== '')
    let citasNuevas: DentalinkCitaFull[]

    if (hayFechas) {
      citasNuevas = citasConPaciente.filter(c => c.paciente_creado_hoy)
      metodo = 'primera_vez+fecha_paciente'
    } else {
      citasNuevas = citasPrimeraVez
      metodo = 'primera_vez_only'
    }

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
      total_primera_vez: citasPrimeraVez.length,
      metodo,
      debug_pacientes: debugPacientes,
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
