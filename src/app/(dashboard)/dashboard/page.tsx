'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  DollarSign,
  CalendarDays,
  TrendingUp,
  Clock,
  CheckSquare,
  XCircle,
  Building2,
  Filter,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Sede } from '@/types/database'
import { getArgentinaToday, getArgentinaDate, formatFechaHoyAR } from '@/lib/utils/dates'
import EmpleadoDashboard from '@/components/empleados/EmpleadoDashboard'
import SyncButton from '@/components/SyncButton'

interface TurnoStats {
  total: number
  atendidos: number
  noShows: number
  cancelados: number
  agendados: number
  tasaShow: number
}

interface TurnosPorSede {
  sede_nombre: string
  total: number
  atendidos: number
  noShows: number
}

interface CobranzaStats {
  hoy: number
  semana: number
  mes: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  if (!isAdmin) {
    return <EmpleadoDashboardWrapper />
  }

  return <AdminDashboard />
}

function EmpleadoDashboardWrapper() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Mi Panel</h1>
        <p className="text-sm text-text-secondary">Tu resumen diario</p>
      </div>
      <EmpleadoDashboard />
    </div>
  )
}

function AdminDashboard() {
  const { user } = useAuth()
  const supabase = createClient()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [turnoStats, setTurnoStats] = useState<TurnoStats>({ total: 0, atendidos: 0, noShows: 0, cancelados: 0, agendados: 0, tasaShow: 0 })
  const [turnosPorSede, setTurnosPorSede] = useState<TurnosPorSede[]>([])
  const [cobranzaStats, setCobranzaStats] = useState<CobranzaStats>({ hoy: 0, semana: 0, mes: 0 })
  const [deudasPendientes, setDeudasPendientes] = useState(0)
  const [tareasPendientes, setTareasPendientes] = useState(0)
  const [chartData, setChartData] = useState<{ dia: string; cobrado: number; gastos: number }[]>([])
  const [loading, setLoading] = useState(true)

  const hoy = getArgentinaToday()

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const inicioSemana = getInicioSemana()
      const inicioMes = hoy.slice(0, 7) + '-01'

      // Build all queries — cobranzas/gastos fetch all, filtered client-side for multi-sede
      let turnosQuery = supabase.from('turnos').select('*, sedes(nombre)').eq('fecha', hoy)
      if (sedeFilter !== 'todas') turnosQuery = turnosQuery.eq('sede_id', sedeFilter)

      const cobHoyQuery = supabase.from('cobranzas').select('monto, sede_id, sede_ids').eq('fecha', hoy)
      const cobSemQuery = supabase.from('cobranzas').select('monto, sede_id, sede_ids').gte('fecha', inicioSemana).lte('fecha', hoy)
      const cobMesQuery = supabase.from('cobranzas').select('monto, sede_id, sede_ids').gte('fecha', inicioMes).lte('fecha', hoy)

      const deudasQuery = supabase.from('deudas').select('monto_total, monto_cobrado, sede_id').in('estado', ['pendiente', 'parcial'])

      // Tareas: get plantillas (con rol) + completadas for today + all employees with roles
      const plantillasQuery = supabase.from('tarea_plantillas').select('id, rol').eq('activa', true)
      const completadasQuery = supabase.from('tarea_completadas').select('user_id, plantilla_id').eq('fecha', hoy).eq('completada', true)
      const empleadosQuery = supabase.from('users').select('id, rol').in('rol', ['rolA', 'rolB', 'rolC'])

      // Chart: cobranzas + gastos by day this month
      const chartCobQuery = supabase.from('cobranzas').select('fecha, monto, sede_id, sede_ids').gte('fecha', inicioMes).lte('fecha', hoy)
      const chartGasQuery = supabase.from('gastos').select('fecha, monto, sede_ids').gte('fecha', inicioMes).lte('fecha', hoy)
      const sedesQuery = supabase.from('sedes').select('*').eq('activa', true).order('nombre')

      // Run ALL queries in parallel
      const [turnosRes, cobHoyRes, cobSemRes, cobMesRes, deudasRes, plantillasRes, completadasTodayRes, empleadosRes, chartCobRes, chartGasRes, sedesRes] = await Promise.all([
        turnosQuery, cobHoyQuery, cobSemQuery, cobMesQuery, deudasQuery, plantillasQuery, completadasQuery, empleadosQuery, chartCobQuery, chartGasQuery, sedesQuery,
      ])

      const allSedes = (sedesRes.data || []) as Sede[]
      if (allSedes.length > 0) setSedes(allSedes)
      const sedesCount = allSedes.length || 1
      const cobMonto = (c: { monto: number; sede_id?: string | null; sede_ids?: string[] }): number => {
        const monto = Number(c.monto)
        if (sedeFilter === 'todas') return monto
        const ids = (c as { sede_ids?: string[] }).sede_ids || []
        if (ids.length > 1) return ids.includes(sedeFilter) ? monto / ids.length : 0
        if (ids.length === 1) return ids[0] === sedeFilter ? monto : 0
        if (c.sede_id) return c.sede_id === sedeFilter ? monto : 0
        return monto / sedesCount
      }
      const gasMonto = (g: { monto: number; sede_ids?: string[] }): number => {
        const monto = Number(g.monto)
        if (sedeFilter === 'todas') return monto
        const ids = (g as { sede_ids?: string[] }).sede_ids || []
        if (ids.length === 0) return monto / sedesCount
        return ids.includes(sedeFilter) ? monto / ids.length : 0
      }

      // Process turnos
      const turnosHoy = turnosRes.data || []
      const total = turnosHoy.length
      const atendidos = turnosHoy.filter((t: { estado: string }) => t.estado === 'atendido').length
      const noShows = turnosHoy.filter((t: { estado: string }) => t.estado === 'no_asistio').length
      const cancelados = turnosHoy.filter((t: { estado: string }) => t.estado === 'cancelado').length
      const agendados = turnosHoy.filter((t: { estado: string }) => t.estado === 'agendado').length
      const relevantes = atendidos + noShows
      const tasaShow = relevantes > 0 ? Math.round((atendidos / relevantes) * 100) : 0
      setTurnoStats({ total, atendidos, noShows, cancelados, agendados, tasaShow })

      // Process turnos por sede
      if (sedeFilter === 'todas') {
        const porSede: Record<string, TurnosPorSede> = {}
        turnosHoy.forEach((t: { sedes: { nombre: string } | null; estado: string }) => {
          const nombre = t.sedes?.nombre || 'Sin sede'
          if (!porSede[nombre]) porSede[nombre] = { sede_nombre: nombre, total: 0, atendidos: 0, noShows: 0 }
          porSede[nombre].total++
          if (t.estado === 'atendido') porSede[nombre].atendidos++
          if (t.estado === 'no_asistio') porSede[nombre].noShows++
        })
        setTurnosPorSede(Object.values(porSede).sort((a, b) => b.total - a.total))
      }

      // Process cobranzas with proportional sede filtering
      setCobranzaStats({
        hoy: (cobHoyRes.data || []).reduce((sum: number, c: { monto: number; sede_id?: string | null; sede_ids?: string[] }) => sum + cobMonto(c), 0),
        semana: (cobSemRes.data || []).reduce((sum: number, c: { monto: number; sede_id?: string | null; sede_ids?: string[] }) => sum + cobMonto(c), 0),
        mes: (cobMesRes.data || []).reduce((sum: number, c: { monto: number; sede_id?: string | null; sede_ids?: string[] }) => sum + cobMonto(c), 0),
      })

      // Process deudas
      const deudasData = (deudasRes.data || []) as { monto_total: number; monto_cobrado: number; sede_id?: string }[]
      const totalDeudas = sedeFilter === 'todas'
        ? deudasData.reduce((sum, d) => sum + (Number(d.monto_total) - Number(d.monto_cobrado)), 0)
        : deudasData.filter(d => d.sede_id === sedeFilter).reduce((sum, d) => sum + (Number(d.monto_total) - Number(d.monto_cobrado)), 0)
      setDeudasPendientes(totalDeudas)

      // Process tareas: count pending per employee (only their rol's plantillas)
      const plantillas = plantillasRes.data || []
      const completadasToday = completadasTodayRes.data || []
      const empleados = empleadosRes.data || []
      let pendientes = 0
      empleados.forEach((emp: { id: string; rol: string }) => {
        const empPlantillas = plantillas.filter((p: { id: number; rol: string }) => p.rol === emp.rol)
        const empCompletadas = completadasToday
          .filter((c: { user_id: string; plantilla_id: number }) => c.user_id === emp.id)
          .map((c: { plantilla_id: number }) => c.plantilla_id)
        pendientes += empPlantillas.filter((p: { id: number }) => !empCompletadas.includes(p.id)).length
      })
      setTareasPendientes(pendientes)

      // Process chart data with proportional sede filtering
      const cobByDay: Record<string, number> = {}
      const gasByDay: Record<string, number> = {}
      ;(chartCobRes.data || []).forEach((c: { fecha: string; monto: number; sede_id?: string | null; sede_ids?: string[] }) => {
        const m = cobMonto(c)
        if (m > 0) cobByDay[c.fecha] = (cobByDay[c.fecha] || 0) + m
      })
      ;(chartGasRes.data || []).forEach((g: { fecha: string; monto: number; sede_ids?: string[] }) => {
        const m = gasMonto(g)
        if (m > 0) gasByDay[g.fecha] = (gasByDay[g.fecha] || 0) + m
      })
      const allDays = new Set([...Object.keys(cobByDay), ...Object.keys(gasByDay)])
      const sorted = Array.from(allDays).sort()
      setChartData(sorted.map(d => ({
        dia: d.split('-')[2],
        cobrado: cobByDay[d] || 0,
        gastos: gasByDay[d] || 0,
      })))
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy, sedeFilter])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  const formatMoney = (n: number) => {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
  }

  const formatFechaHoy = () => {
    return formatFechaHoyAR()
  }

  if (user?.rol !== 'admin') {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted">
        El dashboard está disponible solo para administradores.
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Dashboard</h1>
          <p className="text-sm text-text-secondary capitalize">{formatFechaHoy()}</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton
            label="Sync todo"
            endpoints={[
              { url: '/api/sync-dentalink', body: { dias: 7 } },
              { url: '/api/sync-pagos', body: { dias: 7 } },
            ]}
            onDone={() => fetchDashboardData()}
          />
          <Filter size={14} className="text-text-muted" />
          <select
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-text-muted py-12 text-sm">Cargando dashboard...</div>
      ) : (
        <>
          {/* KPI Cards — top row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              icon={<DollarSign size={20} />}
              label="Cobrado hoy"
              value={formatMoney(cobranzaStats.hoy)}
              subtitle={`Semana: ${formatMoney(cobranzaStats.semana)}`}
              color="green"
            />
            <KPICard
              icon={<CalendarDays size={20} />}
              label="Turnos hoy"
              value={turnoStats.total.toString()}
              subtitle={`${turnoStats.agendados} pendientes`}
              color="blue"
            />
            <KPICard
              icon={<TrendingUp size={20} />}
              label="Tasa de show"
              value={`${turnoStats.tasaShow}%`}
              subtitle={`${turnoStats.atendidos} atendidos / ${turnoStats.noShows} no-shows`}
              color={turnoStats.tasaShow >= 80 ? 'green' : turnoStats.tasaShow >= 60 ? 'amber' : 'red'}
            />
            <KPICard
              icon={<Clock size={20} />}
              label="Por cobrar"
              value={formatMoney(deudasPendientes)}
              subtitle="Deudas activas"
              color="gold"
            />
          </div>

          {/* Second row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              icon={<DollarSign size={20} />}
              label="Cobrado mes"
              value={formatMoney(cobranzaStats.mes)}
              color="green"
            />
            <KPICard
              icon={<CheckSquare size={20} />}
              label="Tareas pendientes"
              value={tareasPendientes.toString()}
              subtitle="Del equipo hoy"
              color="purple"
            />
            <KPICard
              icon={<XCircle size={20} />}
              label="No-shows hoy"
              value={turnoStats.noShows.toString()}
              color="red"
            />
            <KPICard
              icon={<CalendarDays size={20} />}
              label="Cancelados hoy"
              value={turnoStats.cancelados.toString()}
              color="amber"
            />
          </div>

          {/* Chart: Cobranzas vs Gastos */}
          {chartData.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-text-muted" />
                Cobranzas vs Gastos — este mes
              </h2>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} width={40} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}
                      labelFormatter={(label: any) => `Día ${label}`}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="cobrado" name="Cobrado" fill="#4a7c59" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <div className="w-3 h-3 rounded-sm bg-[#4a7c59]" /> Cobrado
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <div className="w-3 h-3 rounded-sm bg-[#dc2626]" /> Gastos
                </div>
              </div>
            </div>
          )}

          {/* Turnos por sede */}
          {sedeFilter === 'todas' && turnosPorSede.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-text-muted" />
                Turnos por sede — hoy
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {turnosPorSede.map((s) => {
                  const tasa = (s.atendidos + s.noShows) > 0
                    ? Math.round((s.atendidos / (s.atendidos + s.noShows)) * 100)
                    : 0
                  return (
                    <div key={s.sede_nombre} className="flex items-center justify-between p-3 bg-beige rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{s.sede_nombre}</p>
                        <p className="text-xs text-text-secondary">
                          {s.total} turnos · {s.atendidos} atendidos · {s.noShows} no-shows
                        </p>
                      </div>
                      <div className={`text-lg font-semibold ${tasa >= 80 ? 'text-green-primary' : tasa >= 60 ? 'text-amber' : 'text-red'}`}>
                        {tasa}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-text-muted">
            Datos en tiempo real de todas las sedes.
          </p>
        </>
      )}
    </div>
  )
}

function KPICard({ icon, label, value, subtitle, color = 'green' }: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  color?: 'green' | 'blue' | 'red' | 'amber' | 'gold' | 'purple'
}) {
  const colorMap = {
    green: { bg: 'bg-green-light', icon: 'text-green-primary', value: 'text-green-primary' },
    blue: { bg: 'bg-blue-light', icon: 'text-blue', value: 'text-blue' },
    red: { bg: 'bg-red-light', icon: 'text-red', value: 'text-red' },
    amber: { bg: 'bg-amber-light', icon: 'text-amber', value: 'text-amber' },
    gold: { bg: 'bg-gold-light', icon: 'text-gold-dark', value: 'text-gold-dark' },
    purple: { bg: 'bg-purple-light', icon: 'text-purple', value: 'text-purple' },
  }

  const c = colorMap[color]

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.icon}>{icon}</span>
        </div>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${c.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
    </div>
  )
}

function getInicioSemana(): string {
  const d = getArgentinaDate()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}
