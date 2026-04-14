'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  CheckCircle2,
  Clock,
  CalendarDays,
  TrendingUp,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  Ban,
  XCircle,
} from 'lucide-react'
import { getArgentinaToday } from '@/lib/utils/dates'
import type { Turno, Sede } from '@/types/database'

type TurnoConSede = Turno & { sedes: Sede }

const ESTADO_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  agendado: { bg: 'bg-blue-light', text: 'text-blue', label: 'Agendado' },
  atendido: { bg: 'bg-green-light', text: 'text-green-primary', label: 'Atendido' },
  no_asistio: { bg: 'bg-red-light', text: 'text-red', label: 'No asistió' },
  cancelado: { bg: 'bg-amber-light', text: 'text-amber', label: 'Cancelado' },
}

const ORIGEN_COLORS: Record<string, { bg: string; text: string }> = {
  Instagram: { bg: 'bg-pink-50', text: 'text-pink-600' },
  Web: { bg: 'bg-blue-50', text: 'text-blue-600' },
  WhatsApp: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'Teléfono': { bg: 'bg-amber-50', text: 'text-amber-600' },
  Referido: { bg: 'bg-purple-50', text: 'text-purple-600' },
  Facebook: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  Otro: { bg: 'bg-gray-50', text: 'text-gray-600' },
}

interface HorasEmployee {
  id: string
  name: string
  gestion_user_id: string | null
}

interface HourEntry {
  employee_id: string
  date: string
  hours: number
}

interface HorasConfig {
  hourly_rate: number
  sunday_multiplier: number
}

// Feriados Argentina (same as HorasTab)
const HOLIDAYS: Record<number, [number, number][]> = {
  2025: [[0,1],[1,3],[1,4],[2,24],[3,2],[3,3],[4,1],[4,25],[5,16],[5,20],[6,9],[7,17],[9,12],[10,20],[11,8],[11,25]],
  2026: [[0,1],[1,16],[1,17],[2,24],[3,2],[3,3],[4,1],[4,25],[5,15],[5,20],[6,9],[7,17],[9,12],[10,23],[11,8],[11,25]],
  2027: [[0,1],[1,8],[1,9],[2,24],[3,2],[3,22],[3,23],[4,1],[4,25],[5,21],[5,20],[6,9],[7,16],[9,11],[10,22],[11,8],[11,25]],
}

function isDoubleDay(date: Date): boolean {
  if (date.getDay() === 0) return true
  const yr = HOLIDAYS[date.getFullYear()]
  if (!yr) return false
  return yr.some(h => h[0] === date.getMonth() && h[1] === date.getDate())
}

type EmpleadoTab = 'resumen' | 'agenda' | 'turnos_dados'

export default function EmpleadoDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<EmpleadoTab>('resumen')

  const tabs: { id: EmpleadoTab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumen', label: 'Mi Panel', icon: <CheckCircle2 size={16} /> },
    { id: 'agenda', label: 'Agenda del día', icon: <CalendarDays size={16} /> },
    { id: 'turnos_dados', label: 'Turnos dados', icon: <CalendarPlus size={16} /> },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 max-w-full overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' && <ResumenPanel />}
      {activeTab === 'agenda' && <AgendaPanel sedeId={user?.sede_id || null} />}
      {activeTab === 'turnos_dados' && <TurnosDadosPanel />}
    </div>
  )
}

// ============================================
// Panel: Resumen (tareas + horas)
// ============================================
function ResumenPanel() {
  const { user } = useAuth()
  const supabase = createClient()

  const [totalTareas, setTotalTareas] = useState(0)
  const [completadasHoy, setCompletadasHoy] = useState(0)
  const [pendientesAyer, setPendientesAyer] = useState(0)

  const [horasConfig, setHorasConfig] = useState<HorasConfig>({ hourly_rate: 8000, sunday_multiplier: 2 })
  const [horasMes, setHorasMes] = useState(0)
  const [horasNormales, setHorasNormales] = useState(0)
  const [horasDobles, setHorasDobles] = useState(0)
  const [totalPagar, setTotalPagar] = useState(0)
  const [diasTrabajados, setDiasTrabajados] = useState(0)
  const [horasMesAnterior, setHorasMesAnterior] = useState(0)

  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const hoy = getArgentinaToday()

      let plantillasQuery = supabase.from('tarea_plantillas').select('id').eq('activa', true)
      if (user.rol) {
        plantillasQuery = plantillasQuery.eq('rol', user.rol)
      }

      const [plantillasRes, completadasRes] = await Promise.all([
        plantillasQuery,
        supabase.from('tarea_completadas').select('plantilla_id, completada').eq('user_id', user.id).eq('fecha', hoy),
      ])

      const plantillas = plantillasRes.data || []
      const completadas = completadasRes.data || []
      setTotalTareas(plantillas.length)
      setCompletadasHoy(completadas.filter((c: { completada: boolean }) => c.completada).length)

      const ayer = new Date()
      ayer.setDate(ayer.getDate() - 1)
      const fechaAyer = ayer.toISOString().split('T')[0]
      const { data: ayerData } = await supabase
        .from('tarea_completadas')
        .select('plantilla_id')
        .eq('user_id', user.id)
        .eq('fecha', fechaAyer)
        .eq('completada', true)
      const completadasAyerIds = (ayerData || []).map((d: { plantilla_id: number }) => d.plantilla_id)
      const pendientes = plantillas.filter((p: { id: number }) => !completadasAyerIds.includes(p.id)).length
      setPendientesAyer(pendientes)

      const { data: empData } = await supabase
        .from('employees')
        .select('id, name, gestion_user_id')
        .eq('gestion_user_id', user.id)
        .single()

      if (empData) {
        const emp = empData as unknown as HorasEmployee

        const { data: cfgData } = await supabase.from('config').select('key, value')
        const cfg: Record<string, string> = {}
        if (cfgData) {
          (cfgData as unknown as { key: string; value: string }[]).forEach(d => { cfg[d.key] = d.value })
        }
        const rate = Number(cfg.hourly_rate) || 8000
        const mult = Number(cfg.sunday_multiplier) || 2
        setHorasConfig({ hourly_rate: rate, sunday_multiplier: mult })

        const now = new Date()
        const dbMonth = now.getMonth() + 1
        const lastDay = new Date(now.getFullYear(), dbMonth, 0).getDate()
        const startDate = `${now.getFullYear()}-${String(dbMonth).padStart(2, '0')}-01`
        const endDate = `${now.getFullYear()}-${String(dbMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        const { data: horasData } = await supabase
          .from('hour_entries')
          .select('employee_id, date, hours')
          .eq('employee_id', emp.id)
          .gte('date', startDate)
          .lte('date', endDate)

        const entries = (horasData as unknown as HourEntry[]) || []
        let normal = 0, doble = 0, dias = 0
        entries.forEach(e => {
          if (e.hours > 0) {
            dias++
            const d = new Date(e.date + 'T12:00:00')
            if (isDoubleDay(d)) doble += e.hours
            else normal += e.hours
          }
        })
        setHorasNormales(normal)
        setHorasDobles(doble)
        setHorasMes(normal + doble)
        setDiasTrabajados(dias)
        setTotalPagar(Math.round((normal * rate) + (doble * rate * mult)))

        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
        const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
        const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`

        const { data: prevData } = await supabase
          .from('hour_entries')
          .select('hours')
          .eq('employee_id', emp.id)
          .gte('date', prevStart)
          .lte('date', prevEnd)

        const prevEntries = (prevData as unknown as { hours: number }[]) || []
        setHorasMesAnterior(prevEntries.reduce((sum, e) => sum + e.hours, 0))
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <div className="text-center text-text-muted py-12 text-sm">Cargando tu panel...</div>
  }

  const tareasPct = totalTareas > 0 ? Math.round((completadasHoy / totalTareas) * 100) : 0
  const horasDiff = horasMes - horasMesAnterior
  const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const mesActual = MONTHS_ES[new Date().getMonth()]

  return (
    <div className="space-y-6">
      {/* Tareas de hoy */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-primary" />
            Tareas de hoy
          </h3>
          <span className={`text-lg font-bold ${tareasPct === 100 ? 'text-green-primary' : 'text-text-primary'}`}>
            {completadasHoy}/{totalTareas}
          </span>
        </div>

        <div className="w-full h-3 bg-beige rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tareasPct === 100 ? 'bg-green-primary' : tareasPct > 0 ? 'bg-amber' : 'bg-border'}`}
            style={{ width: `${tareasPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {tareasPct === 100 ? 'Todas completadas' : tareasPct === 0 ? 'Sin comenzar' : `${tareasPct}% completado`}
          </p>
          {pendientesAyer > 0 && (
            <p className="text-xs text-amber flex items-center gap-1">
              <Clock size={12} />
              {pendientesAyer} pendiente{pendientesAyer > 1 ? 's' : ''} de ayer
            </p>
          )}
        </div>
      </div>

      {/* Horas del mes (solo Rol A) */}
      {user?.rol === 'rolA' && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Clock size={16} className="text-green-primary" />
            Horas de {mesActual}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Total horas</p>
              <p className="text-2xl font-bold text-text-primary">{horasMes}h</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Normales</p>
              <p className="text-2xl font-bold text-text-primary">{horasNormales}h</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Dom/Feriado</p>
              <p className="text-2xl font-bold text-amber">{horasDobles}h</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Total a cobrar</p>
              <p className="text-2xl font-bold text-green-primary">${totalPagar.toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted border-t border-border-light pt-3">
            <span>{diasTrabajados} días trabajados · ${horasConfig.hourly_rate.toLocaleString('es-AR')}/h</span>
            {horasMesAnterior > 0 && (
              <span className={`flex items-center gap-1 font-medium ${horasDiff >= 0 ? 'text-green-primary' : 'text-red'}`}>
                <TrendingUp size={12} className={horasDiff < 0 ? 'rotate-180' : ''} />
                {horasDiff >= 0 ? '+' : ''}{horasDiff}h vs mes anterior
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Panel: Agenda del día
// ============================================
function AgendaPanel({ sedeId }: { sedeId: string | null }) {
  const supabase = createClient()
  const [turnos, setTurnos] = useState<TurnoConSede[]>([])
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(() => getArgentinaToday())
  const [busqueda, setBusqueda] = useState('')

  const fetchTurnos = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('turnos')
        .select('*, sedes(*)')
        .eq('fecha', fecha)
        .order('hora', { ascending: true })

      if (sedeId) {
        query = query.eq('sede_id', sedeId)
      }

      const { data } = await query
      setTurnos((data as unknown as TurnoConSede[]) || [])
    } catch (err) {
      console.error('Error fetching turnos:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, sedeId])

  useEffect(() => { fetchTurnos() }, [fetchTurnos])

  const changeDate = (offset: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setFecha(d.toISOString().split('T')[0])
  }

  const isToday = fecha === getArgentinaToday()

  const turnosFiltrados = busqueda.trim()
    ? turnos.filter(t =>
        t.paciente?.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.profesional?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : turnos

  const total = turnos.length
  const atendidos = turnos.filter(t => t.estado === 'atendido').length
  const noShows = turnos.filter(t => t.estado === 'no_asistio').length
  const cancelados = turnos.filter(t => t.estado === 'cancelado').length
  const agendados = turnos.filter(t => t.estado === 'agendado').length
  const efectivos = atendidos + noShows
  const tasaShow = efectivos > 0 ? Math.round((atendidos / efectivos) * 100) : 0

  const formatFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <>
      {/* Date nav */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => changeDate(-1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronLeft size={16} className="text-text-secondary" />
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border-none bg-transparent text-sm font-medium text-text-primary focus:outline-none w-[130px]"
          />
          <button onClick={() => changeDate(1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronRight size={16} className="text-text-secondary" />
          </button>
          {!isToday && (
            <button onClick={() => setFecha(getArgentinaToday())} className="text-xs text-green-primary hover:text-green-dark font-medium ml-1">
              Hoy
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-text-secondary capitalize mb-4">{formatFecha(fecha)}</p>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar paciente o profesional..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full sm:w-80 pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {[
          { icon: <CalendarDays size={16} />, label: 'Total', value: total, color: 'text-text-primary' },
          { icon: <Clock size={16} />, label: 'Agendados', value: agendados, color: 'text-blue' },
          { icon: <CheckCircle2 size={16} />, label: 'Atendidos', value: atendidos, color: 'text-green-primary' },
          { icon: <XCircle size={16} />, label: 'No asistió', value: noShows, color: 'text-red' },
          { icon: <Ban size={16} />, label: 'Cancelados', value: cancelados, color: 'text-amber' },
          { icon: <Users size={16} />, label: 'Tasa show', value: `${tasaShow}%`, color: 'text-green-primary' },
        ].map(s => (
          <div key={s.label} className="bg-surface rounded-lg border border-border p-3 text-center">
            <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando turnos...</div>
        ) : turnosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            {busqueda ? `No se encontraron turnos para "${busqueda}"` : 'No hay turnos para esta fecha'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Profesional</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Sede</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {turnosFiltrados.map((turno) => {
                  const estilo = ESTADO_STYLES[turno.estado] || ESTADO_STYLES.agendado
                  return (
                    <tr key={turno.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{turno.hora?.slice(0, 5)}</td>
                      <td className="px-4 py-3 text-text-primary">{turno.paciente}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{turno.profesional || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{turno.sedes?.nombre || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${estilo.bg} ${estilo.text}`}>
                          {estilo.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && turnos.length > 0 && (
        <p className="text-xs text-text-muted mt-3">
          {busqueda ? `${turnosFiltrados.length} de ` : ''}{turnos.length} turno{turnos.length !== 1 ? 's' : ''}
        </p>
      )}
    </>
  )
}

// ============================================
// Panel: Turnos dados
// ============================================
interface Agendado {
  id: number
  paciente: string
  fecha_turno: string
  hora: string
  profesional: string
  sede: string
  comentario: string
  origen: string
}

function TurnosDadosPanel() {
  const [fecha, setFecha] = useState(() => getArgentinaToday())
  const [data, setData] = useState<{ total: number; agendados: Agendado[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dentalink-agendados?fecha=${fecha}`)
      const json = await res.json()
      if (res.ok) setData(json)
    } catch (err) {
      console.error('Error fetching agendados:', err)
    } finally {
      setLoading(false)
    }
  }, [fecha])

  useEffect(() => { fetchData() }, [fetchData])

  const changeDate = (offset: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setFecha(d.toISOString().split('T')[0])
  }

  const isToday = fecha === getArgentinaToday()

  const formatFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  let agendados = data?.agendados || []
  if (busqueda.trim()) {
    const q = busqueda.toLowerCase()
    agendados = agendados.filter(a =>
      a.paciente.toLowerCase().includes(q) ||
      a.comentario?.toLowerCase().includes(q) ||
      a.profesional?.toLowerCase().includes(q)
    )
  }

  return (
    <>
      {/* Date nav */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => changeDate(-1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronLeft size={16} className="text-text-secondary" />
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border-none bg-transparent text-sm font-medium text-text-primary focus:outline-none w-[130px]"
          />
          <button onClick={() => changeDate(1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronRight size={16} className="text-text-secondary" />
          </button>
          {!isToday && (
            <button onClick={() => setFecha(getArgentinaToday())} className="text-xs text-green-primary hover:text-green-dark font-medium ml-1">
              Hoy
            </button>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg px-3 py-1.5">
          <span className="text-sm font-semibold text-green-primary">{data?.total || 0}</span>
          <span className="text-sm text-text-muted ml-1">turnos dados</span>
        </div>
      </div>

      <p className="text-sm text-text-secondary capitalize mb-4">{formatFecha(fecha)}</p>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar paciente, profesional o comentario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full sm:w-80 pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando turnos dados...</div>
        ) : agendados.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            {busqueda ? `No se encontraron resultados para "${busqueda}"` : 'No hay turnos dados para esta fecha'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Turno</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Profesional</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Sede</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Origen</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {agendados.map((a) => {
                  const origenStyle = ORIGEN_COLORS[a.origen] || ORIGEN_COLORS.Otro
                  return (
                    <tr key={a.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{a.paciente}</td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell whitespace-nowrap">
                        {a.fecha_turno} {a.hora?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{a.profesional || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{a.sede || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${origenStyle.bg} ${origenStyle.text}`}>
                          {a.origen}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs hidden lg:table-cell max-w-[200px] truncate">{a.comentario || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && agendados.length > 0 && (
        <p className="text-xs text-text-muted mt-3">
          {busqueda ? `${agendados.length} de ${data?.total || 0}` : `${agendados.length} turno${agendados.length !== 1 ? 's' : ''} dado${agendados.length !== 1 ? 's' : ''}`}
        </p>
      )}
    </>
  )
}
