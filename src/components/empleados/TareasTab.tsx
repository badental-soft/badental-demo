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
  // Rol A
  agenda: { bg: 'bg-blue-light', text: 'text-blue' },
  mensajes: { bg: 'bg-green-light', text: 'text-green-primary' },
  visto: { bg: 'bg-amber-light', text: 'text-amber' },
  cierre: { bg: 'bg-red-light', text: 'text-red' },
  // Rol B
  consulta: { bg: 'bg-blue-light', text: 'text-blue' },
  venta: { bg: 'bg-green-light', text: 'text-green-primary' },
  registro: { bg: 'bg-amber-light', text: 'text-amber' },
  seguimiento: { bg: 'bg-purple-50', text: 'text-purple-600' },
  // Rol C
  recepcion: { bg: 'bg-blue-light', text: 'text-blue' },
  clinico: { bg: 'bg-green-light', text: 'text-green-primary' },
  admin: { bg: 'bg-gray-100', text: 'text-gray-600' },
  // Rol D
  higiene: { bg: 'bg-pink-50', text: 'text-pink-600' },
  stock: { bg: 'bg-amber-light', text: 'text-amber' },
}

const ROL_LABELS: Record<string, string> = {
  rolA: 'Rol A — Recepcionista digital',
  rolB: 'Rol B — Vendedor',
  rolC: 'Rol C — Recepcionista físico',
  rolD: 'Rol D — Asistente',
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

  // Fetch task templates (filtered by user's rol, or all for admin)
  const fetchPlantillas = useCallback(async () => {
    let query = supabase
      .from('tarea_plantillas')
      .select('*')
      .eq('activa', true)
      .order('orden')

    // Non-admin: only their rol's tasks
    if (!isAdmin && user?.rol) {
      query = query.eq('rol', user.rol)
    }

    const { data } = await query
    if (data) setPlantillas(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.rol])

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

    // Check yesterday's pending tasks (only if user had activity yesterday)
    const ayer = new Date(fecha + 'T12:00:00')
    ayer.setDate(ayer.getDate() - 1)
    const fechaAyer = ayer.toISOString().split('T')[0]

    if (plantillas.length > 0) {
      // Filtrar plantillas por el rol del empleado seleccionado
      const empRol = isAdmin
        ? empleados.find(e => e.id === userId)?.rol || ''
        : user?.rol || ''
      const plantillasEmp = empRol
        ? plantillas.filter(p => p.rol === empRol)
        : plantillas

      const { data: ayerAllData } = await supabase
        .from('tarea_completadas')
        .select('plantilla_id, completada')
        .eq('user_id', userId)
        .eq('fecha', fechaAyer)

      // Solo mostrar pendientes si el usuario tuvo actividad ayer
      if (ayerAllData && ayerAllData.length > 0) {
        const ayerAllIds = ayerAllData.map((d: { plantilla_id: number }) => d.plantilla_id)
        const ayerIncompletas = ayerAllData
          .filter((d: { completada: boolean }) => !d.completada)
          .map((d: { plantilla_id: number }) => d.plantilla_id)
        const nuncaCreadas = plantillasEmp.filter(p => !ayerAllIds.includes(p.id)).map(p => p.id)
        setPendientesAyer([...ayerIncompletas, ...nuncaCreadas])
      } else {
        setPendientesAyer([])
      }
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedEmpleado, user?.id, user?.rol, fecha, plantillas, empleados])

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

  // Filter plantillas by the selected employee's rol (admin detail view)
  const selectedRol = isAdmin
    ? empleados.find(e => e.id === selectedEmpleado)?.rol || ''
    : user?.rol || ''
  const plantillasFiltradas = selectedRol
    ? plantillas.filter(p => p.rol === selectedRol)
    : plantillas

  const completadasCount = completadas.filter(c => c.completada && plantillasFiltradas.some(p => p.id === c.plantilla_id)).length
  const totalTareas = plantillasFiltradas.length

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
          <div className="space-y-6">
            {['rolA', 'rolB', 'rolC', 'rolD'].map(rol => {
              const empsDelRol = empleados.filter(e => e.rol === rol)
              if (empsDelRol.length === 0) return null
              const plantillasDelRol = plantillas.filter(p => p.rol === rol)
              const totalRol = plantillasDelRol.length

              return (
                <div key={rol}>
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                    {ROL_LABELS[rol] || rol} ({empsDelRol.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {empsDelRol.map(emp => {
                      const empCompletadas = allCompletadas[emp.id] || []
                      // Count only completions for this rol's templates
                      const plantillaIds = plantillasDelRol.map(p => p.id)
                      const done = empCompletadas.filter(c => plantillaIds.includes(c.plantilla_id)).length
                      const pct = totalRol > 0 ? Math.round((done / totalRol) * 100) : 0

                      return (
                        <button
                          key={emp.id}
                          onClick={() => { setSelectedEmpleado(emp.id); setOverviewMode(false) }}
                          className="bg-surface rounded-xl border border-border p-5 text-left hover:border-green-primary transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-text-primary">{emp.nombre}</h3>
                            <span className={`text-sm font-semibold ${pct === 100 ? 'text-green-primary' : pct > 0 ? 'text-amber' : 'text-text-muted'}`}>
                              {done}/{totalRol}
                            </span>
                          </div>
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
                  </div>
                </div>
              )
            })}
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
              {empleados.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} ({e.rol})</option>
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
          {plantillasFiltradas.map(p => {
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
