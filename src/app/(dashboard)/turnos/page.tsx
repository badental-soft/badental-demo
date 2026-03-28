'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  CalendarDays,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Ban,
  Search,
  CalendarPlus,
  MapPin,
  MessageSquare,
  TrendingUp,
} from 'lucide-react'
import type { Turno, Sede } from '@/types/database'
import { getArgentinaToday } from '@/lib/utils/dates'

type TurnoConSede = Turno & { sedes: Sede }
type TabId = 'agenda' | 'agendados'

const ESTADO_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  agendado: { bg: 'bg-blue-light', text: 'text-blue', label: 'Agendado' },
  atendido: { bg: 'bg-green-light', text: 'text-green-primary', label: 'Atendido' },
  no_asistio: { bg: 'bg-red-light', text: 'text-red', label: 'No asistió' },
  cancelado: { bg: 'bg-amber-light', text: 'text-amber', label: 'Cancelado' },
}

export default function TurnosPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('agenda')

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Turnos</h1>
        <p className="text-sm text-text-secondary">Agenda diaria y seguimiento de turnos agendados</p>
      </div>

      {/* Tabs */}
      {user?.rol === 'admin' && (
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'agenda'
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
            }`}
          >
            <CalendarDays size={16} />
            Agenda del día
          </button>
          <button
            onClick={() => setActiveTab('agendados')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'agendados'
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
            }`}
          >
            <CalendarPlus size={16} />
            Turnos dados
          </button>
        </div>
      )}

      {activeTab === 'agenda' && <AgendaTab />}
      {activeTab === 'agendados' && <AgendadosTab />}
    </div>
  )
}

// ============================================
// Tab: Agenda del día (existente)
// ============================================
function AgendaTab() {
  const { user } = useAuth()
  const supabase = createClient()
  const [turnos, setTurnos] = useState<TurnoConSede[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [fecha, setFecha] = useState(() => getArgentinaToday())
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTurnos = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('turnos')
      .select('*, sedes(*)')
      .eq('fecha', fecha)
      .order('hora', { ascending: true })

    if (sedeFilter !== 'todas') {
      query = query.eq('sede_id', sedeFilter)
    }

    if (user?.rol === 'rolC' && user.sede_id) {
      query = query.eq('sede_id', user.sede_id)
    }

    const { data } = await query
    setTurnos((data as TurnoConSede[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, sedeFilter, user])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchTurnos() }, [fetchTurnos])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-dentalink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 7 }),
      })
      const data = await res.json()
      if (data.error) {
        alert('Error: ' + data.error)
      } else {
        alert(`Sincronizado: ${data.insertados} turnos (${data.rango})`)
        fetchTurnos()
      }
    } catch {
      alert('Error al sincronizar')
    }
    setSyncing(false)
  }

  const changeDate = (offset: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setFecha(d.toISOString().split('T')[0])
  }

  const goToday = () => setFecha(getArgentinaToday())

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

  const isToday = fecha === getArgentinaToday()

  return (
    <>
      {/* Date nav + sync + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => changeDate(-1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronLeft size={18} className="text-text-secondary" />
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border-none bg-transparent text-sm font-medium text-text-primary focus:outline-none"
          />
          <button onClick={() => changeDate(1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronRight size={18} className="text-text-secondary" />
          </button>
          {!isToday && (
            <button onClick={goToday} className="text-xs text-green-primary hover:text-green-dark font-medium ml-1">
              Hoy
            </button>
          )}
        </div>

        <span className="text-sm text-text-secondary capitalize">{formatFecha(fecha)}</span>

        <div className="flex items-center gap-2 sm:ml-auto">
          {user?.rol === 'admin' && (
            <>
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
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sync...' : 'Sync'}
              </button>
            </>
          )}
        </div>
      </div>

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={<CalendarDays size={18} />} label="Total" value={total} color="text-text-primary" />
        <StatCard icon={<Clock size={18} />} label="Agendados" value={agendados} color="text-blue" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Atendidos" value={atendidos} color="text-green-primary" />
        <StatCard icon={<XCircle size={18} />} label="No asistió" value={noShows} color="text-red" />
        <StatCard icon={<Ban size={18} />} label="Cancelados" value={cancelados} color="text-amber" />
        <StatCard icon={<Users size={18} />} label="Tasa show" value={`${tasaShow}%`} color="text-green-primary" />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando turnos...</div>
        ) : turnosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            {busqueda ? `No se encontraron turnos para "${busqueda}"` : `No hay turnos para esta fecha${sedeFilter !== 'todas' ? ' en esta sede' : ''}`}
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
// Tab: Turnos dados (agendados en un día)
// ============================================
interface Agendado {
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
  fecha_actualizacion: string
}

const ORIGEN_COLORS: Record<string, { bg: string; text: string }> = {
  Instagram: { bg: 'bg-pink-50', text: 'text-pink-600' },
  Web: { bg: 'bg-blue-50', text: 'text-blue-600' },
  WhatsApp: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'Teléfono': { bg: 'bg-amber-50', text: 'text-amber-600' },
  Otro: { bg: 'bg-gray-50', text: 'text-gray-600' },
}

function AgendadosTab() {
  const [fecha, setFecha] = useState(() => getArgentinaToday())
  const [data, setData] = useState<{ total: number; por_sede: Record<string, number>; por_origen: Record<string, number>; agendados: Agendado[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sedeFilter, setSedeFilter] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dentalink-agendados?fecha=${fecha}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        console.error('Error:', json.error)
      }
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

  // Filter
  let agendados = data?.agendados || []
  if (sedeFilter !== 'todas') {
    agendados = agendados.filter(a => a.sede === sedeFilter)
  }
  if (busqueda.trim()) {
    const q = busqueda.toLowerCase()
    agendados = agendados.filter(a =>
      a.paciente.toLowerCase().includes(q) ||
      a.comentario.toLowerCase().includes(q) ||
      a.profesional.toLowerCase().includes(q)
    )
  }

  // Sedes list from data
  const sedesDisponibles = data ? Object.keys(data.por_sede).sort() : []

  return (
    <>
      {/* Date nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => changeDate(-1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronLeft size={18} className="text-text-secondary" />
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border-none bg-transparent text-sm font-medium text-text-primary focus:outline-none"
          />
          <button onClick={() => changeDate(1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronRight size={18} className="text-text-secondary" />
          </button>
          {!isToday && (
            <button onClick={() => setFecha(getArgentinaToday())} className="text-xs text-green-primary hover:text-green-dark font-medium ml-1">
              Hoy
            </button>
          )}
        </div>
        <span className="text-sm text-text-secondary capitalize">{formatFecha(fecha)}</span>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Filter size={14} className="text-text-muted" />
          <select
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedesDisponibles.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted text-sm">
          Consultando Dentalink...
        </div>
      ) : !data ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted text-sm">
          Error al cargar datos
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard icon={<CalendarPlus size={18} />} label="Turnos dados" value={data.total} color="text-text-primary" />
            <StatCard icon={<TrendingUp size={18} />} label="Sedes activas" value={Object.keys(data.por_sede).length} color="text-blue" />
            {Object.entries(data.por_origen).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([origen, count]) => (
              <StatCard key={origen} icon={<MessageSquare size={18} />} label={origen} value={count} color={ORIGEN_COLORS[origen]?.text || 'text-gray-600'} />
            ))}
          </div>

          {/* Por sede cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {Object.entries(data.por_sede).sort((a, b) => b[1] - a[1]).map(([sede, count]) => (
              <button
                key={sede}
                onClick={() => setSedeFilter(sedeFilter === sede ? 'todas' : sede)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  sedeFilter === sede ? 'bg-green-50 border-green-200 ring-2 ring-green-primary/20' : 'bg-surface border-border hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin size={14} className="text-text-muted" />
                  <span className="text-lg font-bold text-text-primary">{count}</span>
                </div>
                <p className="text-xs font-medium text-text-secondary truncate">{sede}</p>
              </button>
            ))}
          </div>

          {/* Por origen badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(data.por_origen).sort((a, b) => b[1] - a[1]).map(([origen, count]) => {
              const style = ORIGEN_COLORS[origen] || ORIGEN_COLORS.Otro
              return (
                <span key={origen} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
                  {origen}: {count}
                </span>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar paciente o comentario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full sm:w-80 pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary"
            />
          </div>

          {/* Table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {agendados.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">No hay turnos dados con estos filtros</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-beige/50">
                      <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Paciente</th>
                      <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Turno para</th>
                      <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Profesional</th>
                      <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Sede</th>
                      <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Origen</th>
                      <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendados.map(a => {
                      const origenStyle = ORIGEN_COLORS[a.origen] || ORIGEN_COLORS.Otro
                      return (
                        <tr key={a.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-text-primary">{a.paciente}</td>
                          <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                            {new Date(a.fecha_turno + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                            {a.hora ? ` ${a.hora}` : ''}
                          </td>
                          <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{a.profesional || '—'}</td>
                          <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{a.sede}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${origenStyle.bg} ${origenStyle.text}`}>
                              {a.origen}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs hidden lg:table-cell max-w-[200px] truncate">
                            {a.comentario || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-text-muted mt-3">
            {agendados.length} turno{agendados.length !== 1 ? 's' : ''} dado{agendados.length !== 1 ? 's' : ''}
            {sedeFilter !== 'todas' ? ` en ${sedeFilter}` : ''} · Datos en tiempo real de Dentalink
          </p>
        </>
      )}
    </>
  )
}

// ============================================
// Shared components
// ============================================
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-text-muted">{icon}</span>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}
