'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
} from 'lucide-react'
import { getArgentinaToday } from '@/lib/utils/dates'

interface Plantilla {
  id: number
  titulo: string
  categoria: string
  rol: string
  orden: number
}

interface Completada {
  id: string
  user_id: string
  plantilla_id: number
  fecha: string
  completada: boolean
  completed_at: string | null
}

interface UserProfile {
  id: string
  nombre: string
  rol: string
  sede_id: string | null
}

const CATEGORIA_STYLES: Record<string, { bg: string; text: string }> = {
  agenda: { bg: 'bg-blue-light', text: 'text-blue' },
  mensajes: { bg: 'bg-green-light', text: 'text-green-primary' },
  visto: { bg: 'bg-amber-light', text: 'text-amber' },
  cierre: { bg: 'bg-red-light', text: 'text-red' },
}

export default function TareasTab({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth()
  const supabase = createClient()
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [completadas, setCompletadas] = useState<Completada[]>([])
  const [empleados, setEmpleados] = useState<UserProfile[]>([])
  const [selectedEmpleado, setSelectedEmpleado] = useState<string>('')
  const [fecha, setFecha] = useState(() => getArgentinaToday())
  const [loading, setLoading] = useState(true)
  const [pendientesAyer, setPendientesAyer] = useState<number[]>([])

  // Fetch task templates
  const fetchPlantillas = useCallback(async () => {
    const { data } = await supabase
      .from('tarea_plantillas')
      .select('*')
      .eq('activa', true)
      .order('orden')
    if (data) setPlantillas(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch employees (admin only)
  const fetchEmpleados = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase
      .from('users')
      .select('id, nombre, rol, sede_id')
      .neq('rol', 'admin')
      .order('nombre')
    if (data) {
      setEmpleados(data)
      if (data.length > 0 && !selectedEmpleado) {
        setSelectedEmpleado(data[0].id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // Fetch completions for selected user + date
  const fetchCompletadas = useCallback(async () => {
    const userId = isAdmin ? selectedEmpleado : user?.id
    if (!userId) return
    setLoading(true)

    const { data } = await supabase
      .from('tarea_completadas')
      .select('*')
      .eq('user_id', userId)
      .eq('fecha', fecha)
    setCompletadas(data || [])

    // Check yesterday's pending tasks
    const ayer = new Date(fecha + 'T12:00:00')
    ayer.setDate(ayer.getDate() - 1)
    const fechaAyer = ayer.toISOString().split('T')[0]
    const { data: ayerData } = await supabase
      .from('tarea_completadas')
      .select('plantilla_id')
      .eq('user_id', userId)
      .eq('fecha', fechaAyer)
      .eq('completada', false)

    // Also check tasks that weren't created yesterday (= not done)
    if (plantillas.length > 0) {
      const ayerCompletadasIds = (ayerData || []).map((d: { plantilla_id: number }) => d.plantilla_id)
      const { data: ayerAllData } = await supabase
        .from('tarea_completadas')
        .select('plantilla_id')
        .eq('user_id', userId)
        .eq('fecha', fechaAyer)
      const ayerAllIds = (ayerAllData || []).map((d: { plantilla_id: number }) => d.plantilla_id)
      // Pending = explicitly incomplete + never created yesterday
      const pendientes = [
        ...ayerCompletadasIds,
        ...plantillas.filter(p => !ayerAllIds.includes(p.id)).map(p => p.id),
      ]
      setPendientesAyer(pendientes)
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedEmpleado, user?.id, fecha, plantillas])

  useEffect(() => { fetchPlantillas() }, [fetchPlantillas])
  useEffect(() => { fetchEmpleados() }, [fetchEmpleados])
  useEffect(() => {
    if (plantillas.length > 0) fetchCompletadas()
  }, [fetchCompletadas, plantillas])

  const toggleTarea = async (plantillaId: number) => {
    const userId = isAdmin ? selectedEmpleado : user?.id
    if (!userId) return

    const existing = completadas.find(c => c.plantilla_id === plantillaId)

    if (existing) {
      // Toggle
      const newVal = !existing.completada
      await supabase
        .from('tarea_completadas')
        .update({
          completada: newVal,
          completed_at: newVal ? new Date().toISOString() : null,
        })
        .eq('id', existing.id)

      setCompletadas(prev =>
        prev.map(c =>
          c.id === existing.id
            ? { ...c, completada: newVal, completed_at: newVal ? new Date().toISOString() : null }
            : c
        )
      )
    } else {
      // Create as completed
      const { data } = await supabase
        .from('tarea_completadas')
        .insert({
          user_id: userId,
          plantilla_id: plantillaId,
          fecha,
          completada: true,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (data) setCompletadas(prev => [...prev, data])
    }
  }

  const changeDate = (offset: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setFecha(d.toISOString().split('T')[0])
  }

  const isToday = fecha === getArgentinaToday()
  const completadasCount = completadas.filter(c => c.completada).length
  const totalTareas = plantillas.length

  const formatFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Admin: overview of all employees for today
  const [overviewMode, setOverviewMode] = useState(true)
  const [allCompletadas, setAllCompletadas] = useState<Record<string, Completada[]>>({})

  const fetchAllCompletadas = useCallback(async () => {
    if (!isAdmin || empleados.length === 0) return
    const { data } = await supabase
      .from('tarea_completadas')
      .select('*')
      .eq('fecha', fecha)
      .eq('completada', true)

    const byUser: Record<string, Completada[]> = {}
    empleados.forEach(e => { byUser[e.id] = [] })
    ;(data || []).forEach((c: Completada) => {
      if (byUser[c.user_id]) byUser[c.user_id].push(c)
      else byUser[c.user_id] = [c]
    })
    setAllCompletadas(byUser)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, empleados, fecha])

  useEffect(() => {
    if (overviewMode) fetchAllCompletadas()
  }, [fetchAllCompletadas, overviewMode])

  // Admin overview
  if (isAdmin && overviewMode) {
    return (
      <div>
        {/* Date nav */}
        <div className="flex items-center gap-3 mb-6">
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
        </div>

        {empleados.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <Users size={40} className="mx-auto text-text-muted mb-3" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No hay empleados cargados</h3>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Agregá empleados desde la pestaña Config para ver sus tareas acá.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {empleados.filter(e => e.rol === 'rolA').map(emp => {
              const empCompletadas = allCompletadas[emp.id] || []
              const done = empCompletadas.length
              const pct = totalTareas > 0 ? Math.round((done / totalTareas) * 100) : 0

              return (
                <button
                  key={emp.id}
                  onClick={() => { setSelectedEmpleado(emp.id); setOverviewMode(false) }}
                  className="bg-surface rounded-xl border border-border p-5 text-left hover:border-green-primary transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-text-primary">{emp.nombre}</h3>
                    <span className={`text-sm font-semibold ${pct === 100 ? 'text-green-primary' : pct > 0 ? 'text-amber' : 'text-text-muted'}`}>
                      {done}/{totalTareas}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-beige rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-primary' : 'bg-amber'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    {pct === 100 ? 'Todas completadas' : pct === 0 ? 'Sin comenzar' : `${pct}% completado`}
                  </p>
                </button>
              )
            })}
            {empleados.filter(e => e.rol !== 'rolA').length > 0 && (
              <p className="col-span-full text-xs text-text-muted mt-2">
                Solo se muestran empleados con Rol A. Los demás roles aún no tienen tareas asignadas.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Detail view (employee or admin drilling into one employee)
  return (
    <div>
      {/* Back button for admin */}
      {isAdmin && (
        <button
          onClick={() => setOverviewMode(true)}
          className="text-sm text-green-primary hover:text-green-dark font-medium mb-4 flex items-center gap-1"
        >
          ← Volver al resumen
        </button>
      )}

      {/* Header with date nav */}
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

        {isAdmin && selectedEmpleado && (
          <div className="sm:ml-auto flex items-center gap-2">
            <Users size={14} className="text-text-muted" />
            <select
              value={selectedEmpleado}
              onChange={(e) => setSelectedEmpleado(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
            >
              {empleados.filter(e => e.rol === 'rolA').map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Progress header */}
      <div className="bg-surface rounded-xl border border-border p-4 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Tareas del día</h3>
          {pendientesAyer.length > 0 && isToday && (
            <p className="text-xs text-amber mt-0.5">
              <Clock size={12} className="inline mr-1" />
              {pendientesAyer.length} tarea{pendientesAyer.length > 1 ? 's' : ''} pendiente{pendientesAyer.length > 1 ? 's' : ''} de ayer
            </p>
          )}
        </div>
        <span className={`text-lg font-bold ${completadasCount === totalTareas && totalTareas > 0 ? 'text-green-primary' : 'text-text-primary'}`}>
          {completadasCount} / {totalTareas}
        </span>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="text-center text-text-muted py-8 text-sm">Cargando tareas...</div>
      ) : (
        <div className="bg-surface rounded-xl border border-border divide-y divide-border-light">
          {plantillas.map(p => {
            const comp = completadas.find(c => c.plantilla_id === p.id)
            const isDone = comp?.completada || false
            const isPendienteAyer = pendientesAyer.includes(p.id) && !isDone && isToday
            const cat = CATEGORIA_STYLES[p.categoria] || CATEGORIA_STYLES.agenda

            return (
              <button
                key={p.id}
                onClick={() => toggleTarea(p.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-beige/30 transition-colors ${isDone ? 'opacity-60' : ''}`}
              >
                {isDone ? (
                  <CheckCircle2 size={22} className="text-green-primary flex-shrink-0" />
                ) : (
                  <Circle size={22} className="text-text-muted flex-shrink-0" />
                )}
                <span className={`flex-1 text-sm ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {p.titulo}
                  {isPendienteAyer && (
                    <span className="ml-2 text-xs text-amber font-medium">pendiente de ayer</span>
                  )}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>
                  {p.categoria}
                </span>
                {isDone && comp?.completed_at && (
                  <span className="text-xs text-text-muted hidden sm:block">
                    {new Date(comp.completed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
