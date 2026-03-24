'use client'

import { useState, useEffect, useCallback } from 'react'
import { createHorasClient } from '@/lib/supabase/horas-client'
import { useAuth } from '@/components/AuthProvider'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  DollarSign,
  Calendar,
} from 'lucide-react'

interface HorasEmployee {
  id: string
  name: string
  active: boolean
  gestion_user_id: string | null
}

interface HourEntry {
  id: string
  employee_id: string
  date: string
  hours: number
}

interface HorasConfig {
  hourly_rate: number
  sunday_multiplier: number
}

export default function HorasTab({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth()
  const supabase = createHorasClient()
  const [employees, setEmployees] = useState<HorasEmployee[]>([])
  const [entries, setEntries] = useState<HourEntry[]>([])
  const [config, setConfig] = useState<HorasConfig>({ hourly_rate: 8000, sunday_multiplier: 2 })
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await supabase.from('config').select('key, value')
      if (data) {
        const rows = data as unknown as { key: string; value: string }[]
        const cfg: Record<string, string> = {}
        rows.forEach((d) => { cfg[d.key] = d.value })
        setConfig({
          hourly_rate: Number(cfg.hourly_rate) || 8000,
          sunday_multiplier: Number(cfg.sunday_multiplier) || 2,
        })
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, name, active, gestion_user_id')
        .eq('active', true)
        .order('name')
      if (data) {
        const emps = data as unknown as HorasEmployee[]
        setEmployees(emps)
        if (emps.length > 0 && selectedEmployee === null) {
          if (!isAdmin && user?.id) {
            // Non-admin: find their own employee record by gestion_user_id
            const myEmp = emps.find(e => e.gestion_user_id === user.id)
            if (myEmp) setSelectedEmployee(myEmp.id)
          } else {
            setSelectedEmployee(emps[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.id])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const { year, month } = currentMonth
      const dbMonth = month + 1
      const startDate = `${year}-${String(dbMonth).padStart(2, '0')}-01`
      const endDate = `${year}-${String(dbMonth).padStart(2, '0')}-31`

      let query = supabase
        .from('hour_entries')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)

      if (!isAdmin && selectedEmployee) {
        query = query.eq('employee_id', selectedEmployee)
      }

      const { data } = await query
      setEntries((data as unknown as HourEntry[]) || [])
    } catch (err) {
      console.error('Error fetching entries:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, isAdmin, selectedEmployee])

  useEffect(() => { fetchConfig() }, [fetchConfig])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => {
    if (selectedEmployee !== null) fetchEntries()
  }, [fetchEntries, selectedEmployee])

  const upsertHours = async (employeeId: string, date: string, hours: number) => {
    setSaving(true)
    try {
      if (hours === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('hour_entries') as any)
          .delete()
          .eq('employee_id', employeeId)
          .eq('date', date)
        setEntries(prev => prev.filter(e => !(e.employee_id === employeeId && e.date === date)))
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from('hour_entries') as any)
          .upsert(
            { employee_id: employeeId, date, hours, updated_at: new Date().toISOString() },
            { onConflict: 'employee_id,date' }
          )
          .select()
          .single()
        if (data) {
          const entry = data as unknown as HourEntry
          setEntries(prev => {
            const existing = prev.findIndex(e => e.employee_id === employeeId && e.date === date)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = entry
              return updated
            }
            return [...prev, entry]
          })
        }
      }
    } catch (err) {
      console.error('Error saving hours:', err)
    } finally {
      setSaving(false)
    }
  }

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => {
      let m = prev.month + offset
      let y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  const isCurrentMonth = (() => {
    const now = new Date()
    return currentMonth.year === now.getFullYear() && currentMonth.month === now.getMonth()
  })()

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })

  // Generate calendar days for the month
  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    // Pad start with empty slots for alignment (Monday = 0)
    const startPad = (firstDay.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
    return { days, startPad }
  }

  const { days, startPad } = getDaysInMonth(currentMonth.year, currentMonth.month)

  const getEntryForDay = (employeeId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return entries.find(e => e.employee_id === employeeId && e.date === dateStr)
  }

  const isSunday = (date: Date) => date.getDay() === 0

  // Calculate totals
  const getEmployeeTotals = (employeeId: string) => {
    const empEntries = entries.filter(e => e.employee_id === employeeId)
    let totalHours = 0
    let totalPay = 0

    empEntries.forEach(entry => {
      totalHours += entry.hours
      const d = new Date(entry.date + 'T12:00:00')
      const multiplier = d.getDay() === 0 ? config.sunday_multiplier : 1
      totalPay += entry.hours * config.hourly_rate * multiplier
    })

    return { totalHours, totalPay }
  }

  // Admin overview
  if (isAdmin && selectedEmployee === null) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <Users size={40} className="mx-auto text-text-muted mb-3" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">No hay empleados cargados</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          No se encontraron empleados en el sistema de horas.
        </p>
      </div>
    )
  }

  // Admin overview: show all employees summary
  if (isAdmin) {
    return (
      <div>
        {/* Month nav */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-beige rounded transition-colors">
              <ChevronLeft size={18} className="text-text-secondary" />
            </button>
            <span className="text-sm font-medium text-text-primary capitalize px-2 min-w-[140px] text-center">
              {monthLabel}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-beige rounded transition-colors">
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={() => {
                  const now = new Date()
                  setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() })
                }}
                className="text-xs text-green-primary hover:text-green-dark font-medium ml-1"
              >
                Hoy
              </button>
            )}
          </div>
        </div>

        {/* Employee selector */}
        <div className="flex items-center gap-2 mb-4">
          <Users size={14} className="text-text-muted" />
          <select
            value={selectedEmployee ?? ''}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* Summary cards */}
        {selectedEmployee && (() => {
          const { totalHours, totalPay } = getEmployeeTotals(selectedEmployee)
          const empName = employees.find(e => e.id === selectedEmployee)?.name || ''
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={16} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Horas totales</span>
                </div>
                <p className="text-xl font-semibold text-text-primary">{totalHours}h</p>
              </div>
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total a pagar</span>
                </div>
                <p className="text-xl font-semibold text-green-primary">
                  ${totalPay.toLocaleString('es-AR')}
                </p>
              </div>
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={16} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Empleada</span>
                </div>
                <p className="text-xl font-semibold text-text-primary">{empName}</p>
              </div>
            </div>
          )
        })()}

        {/* Calendar grid */}
        {loading ? (
          <div className="text-center text-text-muted py-8 text-sm">Cargando horas...</div>
        ) : (
          <CalendarGrid
            days={days}
            startPad={startPad}
            employeeId={selectedEmployee!}
            getEntryForDay={getEntryForDay}
            isSunday={isSunday}
            onSave={upsertHours}
            saving={saving}
            config={config}
          />
        )}

        <p className="text-xs text-text-muted mt-3">
          Valor hora: ${config.hourly_rate.toLocaleString('es-AR')} · Domingos x{config.sunday_multiplier}
        </p>
      </div>
    )
  }

  // Employee view (non-admin) — show their own hours
  // For now, employees can only view (not edit) from this dashboard
  const empTotals = selectedEmployee ? getEmployeeTotals(selectedEmployee) : { totalHours: 0, totalPay: 0 }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronLeft size={18} className="text-text-secondary" />
          </button>
          <span className="text-sm font-medium text-text-primary capitalize px-2 min-w-[140px] text-center">
            {monthLabel}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronRight size={18} className="text-text-secondary" />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => {
                const now = new Date()
                setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() })
              }}
              className="text-xs text-green-primary hover:text-green-dark font-medium ml-1"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-text-muted" />
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Horas del mes</span>
          </div>
          <p className="text-xl font-semibold text-text-primary">{empTotals.totalHours}h</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-text-muted" />
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total</span>
          </div>
          <p className="text-xl font-semibold text-green-primary">
            ${empTotals.totalPay.toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="text-center text-text-muted py-8 text-sm">Cargando horas...</div>
      ) : selectedEmployee ? (
        <CalendarGrid
          days={days}
          startPad={startPad}
          employeeId={selectedEmployee}
          getEntryForDay={getEntryForDay}
          isSunday={isSunday}
          onSave={upsertHours}
          saving={saving}
          config={config}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Clock size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">No se encontró tu perfil en el sistema de horas.</p>
        </div>
      )}

      <p className="text-xs text-text-muted mt-3">
        Valor hora: ${config.hourly_rate.toLocaleString('es-AR')} · Domingos x{config.sunday_multiplier}
      </p>
    </div>
  )
}

function CalendarGrid({
  days,
  startPad,
  employeeId,
  getEntryForDay,
  isSunday,
  onSave,
  saving,
  config,
}: {
  days: Date[]
  startPad: number
  employeeId: string
  getEntryForDay: (empId: string, date: Date) => HourEntry | undefined
  isSunday: (date: Date) => boolean
  onSave: (empId: string, date: string, hours: number) => Promise<void>
  saving: boolean
  config: HorasConfig
}) {
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  const handleSave = async (date: Date) => {
    const hours = parseFloat(editValue) || 0
    const dateStr = date.toISOString().split('T')[0]
    await onSave(employeeId, dateStr, hours)
    setEditingDay(null)
    setEditValue('')
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {dayNames.map(d => (
          <div key={d} className="text-center text-xs font-medium text-text-muted py-2 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {/* Empty start padding */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="border-b border-r border-border-light p-2 min-h-[70px] bg-beige/20" />
        ))}

        {days.map(day => {
          const dateStr = day.toISOString().split('T')[0]
          const entry = getEntryForDay(employeeId, day)
          const sunday = isSunday(day)
          const isToday = dateStr === today
          const isEditing = editingDay === dateStr

          return (
            <div
              key={dateStr}
              className={`border-b border-r border-border-light p-2 min-h-[70px] cursor-pointer hover:bg-beige/30 transition-colors
                ${sunday ? 'bg-amber-light/30' : ''}
                ${isToday ? 'ring-2 ring-inset ring-green-primary/30' : ''}
              `}
              onClick={() => {
                if (!isEditing && !saving) {
                  setEditingDay(dateStr)
                  setEditValue(entry?.hours?.toString() || '')
                }
              }}
            >
              <div className="flex items-start justify-between">
                <span className={`text-xs font-medium ${isToday ? 'text-green-primary' : sunday ? 'text-amber' : 'text-text-secondary'}`}>
                  {day.getDate()}
                </span>
                {sunday && (
                  <span className="text-[10px] text-amber font-medium">x{config.sunday_multiplier}</span>
                )}
              </div>

              {isEditing ? (
                <div className="mt-1">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(day)
                      if (e.key === 'Escape') { setEditingDay(null); setEditValue('') }
                    }}
                    onBlur={() => handleSave(day)}
                    autoFocus
                    min="0"
                    max="24"
                    step="0.5"
                    className="w-full text-sm px-1 py-0.5 border border-green-primary rounded bg-white text-text-primary focus:outline-none text-center"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : entry && entry.hours > 0 ? (
                <div className="mt-1 text-center">
                  <span className="text-sm font-semibold text-green-primary">{entry.hours}h</span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
