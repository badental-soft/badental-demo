import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createServerClient()

  // Auth check: any authenticated user
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sedeFilter = searchParams.get('sede') || ''

  // Get last 14 days of data (Argentina timezone)
  const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const hoyDate = new Date(fechaHoy + 'T12:00:00')
  const hace14 = new Date(hoyDate)
  hace14.setDate(hoyDate.getDate() - 13)
  const fechaDesde = hace14.toISOString().split('T')[0]

  // Current month range
  const [year, month] = fechaHoy.split('-').map(Number)
  const mesStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const mesEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Previous month range
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevMesStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
  const prevMesEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`

  let q14d = supabase.from('pacientes_nuevos').select('fecha_afiliacion, primera_cita_sede, origen').gte('fecha_afiliacion', fechaDesde).lte('fecha_afiliacion', fechaHoy)
  let qMes = supabase.from('pacientes_nuevos').select('id', { count: 'exact', head: true }).gte('fecha_afiliacion', mesStart).lte('fecha_afiliacion', mesEnd)
  let qPrevMes = supabase.from('pacientes_nuevos').select('id', { count: 'exact', head: true }).gte('fecha_afiliacion', prevMesStart).lte('fecha_afiliacion', prevMesEnd)

  if (sedeFilter) {
    q14d = q14d.eq('primera_cita_sede', sedeFilter)
    qMes = qMes.eq('primera_cita_sede', sedeFilter)
    qPrevMes = qPrevMes.eq('primera_cita_sede', sedeFilter)
  }

  const [res14d, resMes, resPrevMes] = await Promise.all([q14d, qMes, qPrevMes])

  const { data: pacientes, error } = res14d

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (pacientes || []) as unknown as Array<{
    fecha_afiliacion: string
    primera_cita_sede: string | null
    origen: string | null
  }>

  // Daily counts
  const porDia: Record<string, number> = {}
  const porOrigen: Record<string, number> = {}
  const porSede: Record<string, number> = {}

  for (const r of rows) {
    const f = r.fecha_afiliacion
    porDia[f] = (porDia[f] || 0) + 1
    const origen = r.origen || 'Otro'
    porOrigen[origen] = (porOrigen[origen] || 0) + 1
    const sede = r.primera_cita_sede || 'Sin sede'
    porSede[sede] = (porSede[sede] || 0) + 1
  }

  // Build 14-day array (fill gaps with 0)
  const dias: Array<{ fecha: string; total: number }> = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(hace14)
    d.setDate(hace14.getDate() + i)
    const f = d.toISOString().split('T')[0]
    dias.push({ fecha: f, total: porDia[f] || 0 })
  }

  // Week splits: last 7 days vs previous 7 days
  const semanaActual = dias.slice(7).reduce((s, d) => s + d.total, 0)
  const semanaAnterior = dias.slice(0, 7).reduce((s, d) => s + d.total, 0)

  // Days with data in current week (for average)
  const diasConDatos = dias.slice(7).filter(d => d.total > 0).length || 1

  return NextResponse.json({
    dias,
    semana_actual: semanaActual,
    semana_anterior: semanaAnterior,
    promedio_diario: Math.round((semanaActual / diasConDatos) * 10) / 10,
    por_origen: porOrigen,
    por_sede: porSede,
    total_14d: rows.length,
    total_mes: resMes.count || 0,
    total_mes_anterior: resPrevMes.count || 0,
  })
}
