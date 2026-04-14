import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()

  // Auth check: any authenticated user
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Get last 14 days of data (Argentina timezone)
  const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const hoyDate = new Date(fechaHoy + 'T12:00:00')
  const hace14 = new Date(hoyDate)
  hace14.setDate(hoyDate.getDate() - 13)
  const fechaDesde = hace14.toISOString().split('T')[0]

  const { data: pacientes, error } = await supabase
    .from('pacientes_nuevos')
    .select('fecha_afiliacion, primera_cita_sede, origen')
    .gte('fecha_afiliacion', fechaDesde)
    .lte('fecha_afiliacion', fechaHoy)

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
  })
}
