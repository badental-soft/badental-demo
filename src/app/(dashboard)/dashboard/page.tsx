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
import type { Sede } from '@/types/database'

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
  const supabase = createClient()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [turnoStats, setTurnoStats] = useState<TurnoStats>({ total: 0, atendidos: 0, noShows: 0, cancelados: 0, agendados: 0, tasaShow: 0 })
  const [turnosPorSede, setTurnosPorSede] = useState<TurnosPorSede[]>([])
  const [cobranzaStats, setCobranzaStats] = useState<CobranzaStats>({ hoy: 0, semana: 0, mes: 0 })
  const [deudasPendientes, setDeudasPendientes] = useState(0)
  const [tareasPendientes, setTareasPendientes] = useState(0)
  const [loading, setLoading] = useState(true)

  const hoy = new Date().toISOString().split('T')[0]

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)

    const inicioSemana = getInicioSemana()
    const inicioMes = hoy.slice(0, 7) + '-01'

    // Build all queries
    let turnosQuery = supabase.from('turnos').select('*').eq('fecha', hoy)
    if (sedeFilter !== 'todas') turnosQuery = turnosQuery.eq('sede_id', sedeFilter)

    let cobHoyQuery = supabase.from('cobranzas').select('monto').eq('fecha', hoy)
    if (sedeFilter !== 'todas') cobHoyQuery = cobHoyQuery.eq('sede_id', sedeFilter)

    let cobSemQuery = supabase.from('cobranzas').select('monto').gte('fecha', inicioSemana).lte('fecha', hoy)
    if (sedeFilter !== 'todas') cobSemQuery = cobSemQuery.eq('sede_id', sedeFilter)

    let cobMesQuery = supabase.from('cobranzas').select('monto').gte('fecha', inicioMes).lte('fecha', hoy)
    if (sedeFilter !== 'todas') cobMesQuery = cobMesQuery.eq('sede_id', sedeFilter)

    let deudasQuery = supabase.from('deudas').select('monto_total, monto_cobrado').in('estado', ['pendiente', 'parcial'])
    if (sedeFilter !== 'todas') deudasQuery = deudasQuery.eq('sede_id', sedeFilter)

    let tareasQuery = supabase.from('tareas').select('id').eq('fecha', hoy).eq('completada', false)
    if (sedeFilter !== 'todas') tareasQuery = tareasQuery.eq('sede_id', sedeFilter)

    // Fire ALL queries in parallel
    const [
      sedesRes,
      turnosRes,
      turnosSedeRes,
      cobHoyRes,
      cobSemRes,
      cobMesRes,
      deudasRes,
      tareasRes,
    ] = await Promise.all([
      supabase.from('sedes').select('*').eq('activa', true).order('nombre'),
      turnosQuery,
      sedeFilter === 'todas'
        ? supabase.from('turnos').select('*, sedes(nombre)').eq('fecha', hoy)
        : Promise.resolve({ data: null }),
      cobHoyQuery,
      cobSemQuery,
      cobMesQuery,
      deudasQuery,
      tareasQuery,
    ])

    // Process sedes
    if (sedesRes.data) setSedes(sedesRes.data)

    // Process turnos
    const turnosHoy = turnosRes.data as { estado: string }[] | null
    if (turnosHoy) {
      const total = turnosHoy.length
      const atendidos = turnosHoy.filter(t => t.estado === 'atendido').length
      const noShows = turnosHoy.filter(t => t.estado === 'no_asistio').length
      const cancelados = turnosHoy.filter(t => t.estado === 'cancelado').length
      const agendados = turnosHoy.filter(t => t.estado === 'agendado').length
      const relevantes = atendidos + noShows
      const tasaShow = relevantes > 0 ? Math.round((atendidos / relevantes) * 100) : 0
      setTurnoStats({ total, atendidos, noShows, cancelados, agendados, tasaShow })
    }

    // Process turnos por sede
    if (turnosSedeRes.data) {
      const porSede: Record<string, TurnosPorSede> = {}
      turnosSedeRes.data.forEach((t: { sedes: { nombre: string } | null; estado: string }) => {
        const nombre = t.sedes?.nombre || 'Sin sede'
        if (!porSede[nombre]) porSede[nombre] = { sede_nombre: nombre, total: 0, atendidos: 0, noShows: 0 }
        porSede[nombre].total++
        if (t.estado === 'atendido') porSede[nombre].atendidos++
        if (t.estado === 'no_asistio') porSede[nombre].noShows++
      })
      setTurnosPorSede(Object.values(porSede).sort((a, b) => b.total - a.total))
    }

    // Process cobranzas
    const cobHoyData = cobHoyRes.data as { monto: number }[] | null
    const cobSemData = cobSemRes.data as { monto: number }[] | null
    const cobMesData = cobMesRes.data as { monto: number }[] | null
    setCobranzaStats({
      hoy: cobHoyData?.reduce((sum, c) => sum + Number(c.monto), 0) || 0,
      semana: cobSemData?.reduce((sum, c) => sum + Number(c.monto), 0) || 0,
      mes: cobMesData?.reduce((sum, c) => sum + Number(c.monto), 0) || 0,
    })

    // Process deudas
    const deudasData = deudasRes.data as { monto_total: number; monto_cobrado: number }[] | null
    const totalDeudas = deudasData?.reduce((sum, d) => sum + (Number(d.monto_total) - Number(d.monto_cobrado)), 0) || 0
    setDeudasPendientes(totalDeudas)

    // Process tareas
    setTareasPendientes(tareasRes.data?.length || 0)

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy, sedeFilter])

  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  const formatMoney = (n: number) => {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
  }

  const formatFechaHoy = () => {
    return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
        <div className="flex items-center gap-2">
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
              subtitle="Para hoy"
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

          {/* Footer note */}
          <p className="text-xs text-text-muted">
            Los datos de cobranzas, deudas y tareas se llenarán cuando construyamos esos módulos. Los turnos ya son reales de Dentalink.
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
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}
