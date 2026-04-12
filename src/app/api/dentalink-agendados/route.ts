import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

  // Consultar desde Supabase — instantáneo y exacto
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
  })
}
