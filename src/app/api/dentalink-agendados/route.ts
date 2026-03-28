import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'

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

/**
 * Obtiene el max ID de citas de días anteriores para saber cuáles son nuevas.
 * Busca hacia atrás hasta 7 días hasta encontrar citas actualizadas.
 */
async function getMaxIdAnterior(fecha: string): Promise<number> {
  const d = new Date(fecha + 'T12:00:00')

  for (let i = 1; i <= 7; i++) {
    const prev = new Date(d)
    prev.setDate(prev.getDate() - i)
    const prevStr = prev.toISOString().split('T')[0]

    const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha_actualizacion: [
        { gte: `${prevStr} 00:00:00` },
        { lte: `${prevStr} 23:59:59` },
      ],
    })

    if (citas.length > 0) {
      return Math.max(...citas.map(c => c.id))
    }
  }

  return 0
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
    // 1. Obtener max ID del día anterior (baseline)
    const maxIdAnterior = await getMaxIdAnterior(fecha)

    // 2. Traer citas actualizadas en la fecha seleccionada
    const citasHoy = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha_actualizacion: [
        { gte: `${fecha} 00:00:00` },
        { lte: `${fecha} 23:59:59` },
      ],
    })

    // 3. Filtrar: solo citas con ID > maxIdAnterior (nuevas, no modificaciones)
    const citasPorId = maxIdAnterior > 0
      ? citasHoy.filter(c => c.id > maxIdAnterior)
      : citasHoy // fallback si no hay baseline

    // 4. Filtrar solo pacientes "primera vez" por comentario
    function esPrimeraVez(comentario: string): boolean {
      const c = (comentario || '').toLowerCase()
      return (
        c.includes('primera vez') ||
        c.includes('1ra vez') ||
        c.includes('1° vez') ||
        c.includes('1era vez') ||
        c.includes('primer vez') ||
        c.includes('pv') ||
        c.includes('primera consulta') ||
        c.includes('paciente nuevo') ||
        c.includes('pac nuevo') ||
        c.includes('pac nueva')
      )
    }

    const citasNuevas = citasPorId.filter(c => esPrimeraVez(c.comentarios))

    // Detectar origen del comentario
    function detectarOrigen(comentario: string): string {
      const c = (comentario || '').toLowerCase()
      if (c.includes('ig') || c.includes('instagram')) return 'Instagram'
      if (c.includes('web')) return 'Web'
      if (c.includes('wp') || c.includes('whatsapp')) return 'WhatsApp'
      if (c.includes('tel') || c.includes('llamad')) return 'Teléfono'
      return 'Otro'
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
      total_ids_nuevos: citasPorId.length,
      max_id_anterior: maxIdAnterior,
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
