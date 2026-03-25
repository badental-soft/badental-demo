'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createHorasClient } from '@/lib/supabase/horas-client'
import { useAuth } from '@/components/AuthProvider'
import {
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { getArgentinaToday } from '@/lib/utils/dates'

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

export default function EmpleadoDashboard() {
  const { user } = useAuth()
  const supabase = createClient()
  const horasSupabase = createHorasClient()

  // Tareas state
  const [totalTareas, setTotalTareas] = useState(0)
  const [completadasHoy, setCompletadasHoy] = useState(0)
  const [pendientesAyer, setPendientesAyer] = useState(0)

  // Horas state
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

      // --- TAREAS ---
      const [plantillasRes, completadasRes] = await Promise.all([
        supabase.from('tarea_plantillas').select('id').eq('activa', true),
        supabase.from('tarea_completadas').select('plantilla_id, completada').eq('user_id', user.id).eq('fecha', hoy),
      ])

      const plantillas = plantillasRes.data || []
      const completadas = completadasRes.data || []
      setTotalTareas(plantillas.length)
      setCompletadasHoy(completadas.filter((c: { completada: boolean }) => c.completada).length)

      // Check yesterday's pending
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

      // --- HORAS ---
      // Get employee mapping
      const { data: empData } = await horasSupabase
        .from('employees')
        .select('id, name, gestion_user_id')
        .eq('gestion_user_id', user.id)
        .single()

      if (empData) {
        const emp = empData as unknown as HorasEmployee

        // Get config
        const { data: cfgData } = await horasSupabase.from('config').select('key, value')
        const cfg: Record<string, string> = {}
        if (cfgData) {
          (cfgData as unknown as { key: string; value: string }[]).forEach(d => { cfg[d.key] = d.value })
        }
        const rate = Number(cfg.hourly_rate) || 8000
        const mult = Number(cfg.sunday_multiplier) || 2
        setHorasConfig({ hourly_rate: rate, sunday_multiplier: mult })

        // Current month entries
        const now = new Date()
        const dbMonth = now.getMonth() + 1
        const startDate = `${now.getFullYear()}-${String(dbMonth).padStart(2, '0')}-01`
        const endDate = `${now.getFullYear()}-${String(dbMonth).padStart(2, '0')}-31`

        const { data: horasData } = await horasSupabase
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

        // Previous month for comparison
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
        const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-31`

        const { data: prevData } = await horasSupabase
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
      {/* Row 1: Tareas de hoy */}
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

        {/* Progress bar */}
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

      {/* Row 2: Horas del mes */}
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

      {/* Row 3: Turnos agendados */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
          <CalendarDays size={16} className="text-green-primary" />
          Turnos agendados
        </h3>
        <div className="flex items-center gap-3 text-text-muted">
          <AlertCircle size={32} className="text-text-muted/50" />
          <p className="text-sm text-text-secondary">
            Próximamente vas a poder ver cuántos turnos agendaste hoy y en la semana.
            <br />
            <span className="text-xs text-text-muted">Pendiente de integración con Dentalink.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
