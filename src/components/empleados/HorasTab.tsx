'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  DollarSign,
  Calendar,
  CheckCircle2,
  BarChart3,
} from 'lucide-react'
import { getArgentinaToday, getArgentinaDate } from '@/lib/utils/dates'

// --- Types ---

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

interface WeeklyApproval {
  id: string
  year: number
  month: number
  week_number: number
  approved: boolean
}

interface PaymentRecord {
  id: string
  employee_id: string
  year: number
  month: number
  total_amount: number
  paid_at: string
}

// --- Feriados Argentina ---

const HOLIDAYS: Record<number, [number, number, string][]> = {
  2025: [
    [0,1,'Año Nuevo'],[1,3,'Carnaval'],[1,4,'Carnaval'],[2,24,'Día de la Memoria'],[3,2,'Malvinas'],[3,3,'Viernes Santo'],
    [4,1,'Día del Trabajador'],[4,25,'Revolución de Mayo'],[5,16,'Güemes'],[5,20,'Belgrano'],[6,9,'Independencia'],
    [7,17,'San Martín'],[9,12,'Diversidad Cultural'],[10,20,'Soberanía Nacional'],[11,8,'Inmaculada Concepción'],[11,25,'Navidad'],
  ],
  2026: [
    [0,1,'Año Nuevo'],[1,16,'Carnaval'],[1,17,'Carnaval'],[2,24,'Día de la Memoria'],[3,2,'Malvinas'],[3,3,'Viernes Santo'],
    [4,1,'Día del Trabajador'],[4,25,'Revolución de Mayo'],[5,15,'Güemes'],[5,20,'Belgrano'],[6,9,'Independencia'],
    [7,17,'San Martín'],[9,12,'Diversidad Cultural'],[10,23,'Soberanía Nacional'],[11,8,'Inmaculada Concepción'],[11,25,'Navidad'],
  ],
  2027: [
    [0,1,'Año Nuevo'],[1,8,'Carnaval'],[1,9,'Carnaval'],[2,24,'Día de la Memoria'],[3,2,'Malvinas'],
    [3,22,'Jueves Santo'],[3,23,'Viernes Santo'],[4,1,'Día del Trabajador'],[4,25,'Revolución de Mayo'],
    [5,21,'Güemes'],[5,20,'Belgrano'],[6,9,'Independencia'],[7,16,'San Martín'],
    [9,11,'Diversidad Cultural'],[10,22,'Soberanía Nacional'],[11,8,'Inmaculada Concepción'],[11,25,'Navidad'],
  ],
}

function getHoliday(year: number, month: number, day: number): string | null {
  const yr = HOLIDAYS[year]
  if (!yr) return null
  const found = yr.find(h => h[0] === month && h[1] === day)
  return found ? found[2] : null
}

function isHoliday(year: number, month: number, day: number): boolean {
  return getHoliday(year, month, day) !== null
}

function isDoubleDay(date: Date): boolean {
  return date.getDay() === 0 || isHoliday(date.getFullYear(), date.getMonth(), date.getDate())
}

// --- Sub-views for admin ---
type AdminView = 'resumen' | 'calendario'

// --- Main Component ---

export default function HorasTab({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth()
  const supabase = createClient()
  const [employees, setEmployees] = useState<HorasEmployee[]>([])
  const [entries, setEntries] = useState<HourEntry[]>([])
  const [config, setConfig] = useState<HorasConfig>({ hourly_rate: 8000, sunday_multiplier: 2 })
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = getArgentinaDate()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approvals, setApprovals] = useState<WeeklyApproval[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [adminView, setAdminView] = useState<AdminView>('resumen')

  // --- Data fetching ---

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

  const fetchApprovals = useCallback(async () => {
    try {
      const { year, month } = currentMonth
      const { data } = await supabase
        .from('weekly_approvals')
        .select('*')
        .eq('year', year)
        .eq('month', month + 1)
      setApprovals((data as unknown as WeeklyApproval[]) || [])
    } catch (err) {
      console.error('Error fetching approvals:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  const fetchPayments = useCallback(async () => {
    if (!isAdmin) return
    try {
      const { year, month } = currentMonth
      const { data } = await supabase
        .from('payment_records')
        .select('*')
        .eq('year', year)
        .eq('month', month + 1)
      setPayments((data as unknown as PaymentRecord[]) || [])
    } catch (err) {
      console.error('Error fetching payments:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, isAdmin])

  useEffect(() => { fetchConfig() }, [fetchConfig])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => {
    if (selectedEmployee !== null || isAdmin) fetchEntries()
  }, [fetchEntries, selectedEmployee, isAdmin])
  useEffect(() => { fetchApprovals() }, [fetchApprovals])
  useEffect(() => { fetchPayments() }, [fetchPayments])

  // --- Actions ---

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

  const toggleApproval = async (weekNumber: number, approve: boolean) => {
    try {
      const { year, month } = currentMonth
      const m = month + 1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tbl = supabase.from('weekly_approvals') as any
      // Delete existing row first to avoid duplicates (no unique constraint)
      await tbl.delete().eq('year', year).eq('month', m).eq('week_number', weekNumber)
      if (approve) {
        const { error } = await tbl.insert({ year, month: m, week_number: weekNumber, approved: true })
        if (error) console.error('Error approving week:', error)
      }
      fetchApprovals()
    } catch (err) {
      console.error('Error toggling approval:', err)
    }
  }

  const togglePayment = async (employeeId: string, amount: number, markPaid: boolean) => {
    try {
      const { year, month } = currentMonth
      if (markPaid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('payment_records') as any)
          .insert({
            employee_id: employeeId,
            year,
            month: month + 1,
            total_amount: amount,
          })
        if (error) console.error('Error inserting payment:', error)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('payment_records') as any)
          .delete()
          .eq('employee_id', employeeId)
          .eq('year', year)
          .eq('month', month + 1)
        if (error) console.error('Error deleting payment:', error)
      }
      fetchPayments()
    } catch (err) {
      console.error('Error toggling payment:', err)
    }
  }

  const updateConfigValue = async (key: string, value: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('config') as any)
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      fetchConfig()
    } catch (err) {
      console.error('Error updating config:', err)
    }
  }

  // --- Helpers ---

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
    const now = getArgentinaDate()
    return currentMonth.year === now.getFullYear() && currentMonth.month === now.getMonth()
  })()

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })

  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    const startPad = (firstDay.getDay() + 6) % 7
    return { days, startPad }
  }

  const { days, startPad } = getDaysInMonth(currentMonth.year, currentMonth.month)

  const getEntryForDay = (employeeId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return entries.find(e => e.employee_id === employeeId && e.date === dateStr)
  }

  const isWeekApproved = (weekNumber: number) => {
    return approvals.some(a => a.week_number === weekNumber && a.approved)
  }

  const getWeekNumber = (day: number) => {
    const firstDayOffset = (new Date(currentMonth.year, currentMonth.month, 1).getDay() + 6) % 7
    return Math.floor((firstDayOffset + day - 1) / 7)
  }

  const getWeeksInMonth = () => {
    const firstDayOffset = (new Date(currentMonth.year, currentMonth.month, 1).getDay() + 6) % 7
    const totalDays = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
    return Math.ceil((firstDayOffset + totalDays) / 7)
  }

  const calcEmployeeTotals = (employeeId: string) => {
    const empEntries = entries.filter(e => e.employee_id === employeeId)
    let normalHrs = 0
    let doubleHrs = 0
    let workedDays = 0

    empEntries.forEach(entry => {
      if (entry.hours > 0) {
        workedDays++
        const d = new Date(entry.date + 'T12:00:00')
        if (isDoubleDay(d)) {
          doubleHrs += entry.hours
        } else {
          normalHrs += entry.hours
        }
      }
    })

    const totalHrs = normalHrs + doubleHrs
    const pay = (normalHrs * config.hourly_rate) + (doubleHrs * config.hourly_rate * config.sunday_multiplier)
    return { totalHrs, normalHrs, doubleHrs, workedDays, pay }
  }

  // --- Month Navigation (shared) ---
  const MonthNav = () => (
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
  )

  // --- No employees fallback ---
  if (employees.length === 0 && !loading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <Users size={40} className="mx-auto text-text-muted mb-3" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">No hay empleadas cargadas</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          No se encontraron empleadas en el sistema de horas.
        </p>
      </div>
    )
  }

  // --- Employee not found (non-admin) ---
  if (!isAdmin && selectedEmployee === null && !loading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <Clock size={40} className="mx-auto text-text-muted mb-3" />
        <p className="text-sm text-text-secondary">No se encontró tu perfil en el sistema de horas.</p>
      </div>
    )
  }

  // =====================
  // ADMIN VIEW
  // =====================
  if (isAdmin) {
    return (
      <div>
        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit">
          {([
            { id: 'resumen' as AdminView, label: 'Resumen', icon: <BarChart3 size={14} /> },
            { id: 'calendario' as AdminView, label: 'Calendario', icon: <Calendar size={14} /> },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setAdminView(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${adminView === tab.id
                  ? 'bg-green-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-beige'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <MonthNav />

        {loading ? (
          <div className="text-center text-text-muted py-8 text-sm">Cargando horas...</div>
        ) : adminView === 'resumen' ? (
          <AdminResumen
            employees={employees}
            calcTotals={calcEmployeeTotals}
            config={config}
            payments={payments}
            togglePayment={togglePayment}
            approvals={approvals}
            isWeekApproved={isWeekApproved}
            toggleApproval={toggleApproval}
            getWeeksInMonth={getWeeksInMonth}
            currentMonth={currentMonth}
          />
        ) : adminView === 'calendario' ? (
          <>
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

            {selectedEmployee && (() => {
              const totals = calcEmployeeTotals(selectedEmployee)
              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  <SummaryCard icon={<Clock size={16} />} label="Horas totales" value={`${totals.totalHrs}h`} />
                  <SummaryCard icon={<Calendar size={16} />} label="Días trabajados" value={totals.workedDays} />
                  <SummaryCard label="Hs normales" value={`${totals.normalHrs}h`} />
                  <SummaryCard label="Hs dom/feriado" value={`${totals.doubleHrs}h`} color="text-amber" />
                  <SummaryCard icon={<DollarSign size={16} />} label="Total a pagar" value={`$${Math.round(totals.pay).toLocaleString('es-AR')}`} color="text-green-primary" />
                </div>
              )
            })()}

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-primary" /> Hoy</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" /> Dom/Feriado (x{config.sunday_multiplier})</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-dark" /> Semana aprobada</span>
            </div>

            {selectedEmployee && (
              <CalendarGrid
                days={days}
                startPad={startPad}
                employeeId={selectedEmployee}
                getEntryForDay={getEntryForDay}
                onSave={upsertHours}
                saving={saving}
                config={config}
                isAdmin={true}
                isWeekApproved={isWeekApproved}
                getWeekNumber={getWeekNumber}
                currentMonth={currentMonth}
              />
            )}
          </>
        ) : null}
      </div>
    )
  }

  // =====================
  // EMPLOYEE VIEW
  // =====================
  const empTotals = selectedEmployee ? calcEmployeeTotals(selectedEmployee) : { totalHrs: 0, normalHrs: 0, doubleHrs: 0, workedDays: 0, pay: 0 }

  return (
    <div>
      <MonthNav />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard icon={<Clock size={16} />} label="Horas del mes" value={`${empTotals.totalHrs}h`} />
        <SummaryCard label="Hs normales" value={`${empTotals.normalHrs}h`} />
        <SummaryCard label="Hs dom/feriado" value={`${empTotals.doubleHrs}h`} color="text-amber" />
        <SummaryCard icon={<DollarSign size={16} />} label="Total" value={`$${Math.round(empTotals.pay).toLocaleString('es-AR')}`} color="text-green-primary" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-primary" /> Hoy</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" /> Dom/Feriado (x{config.sunday_multiplier})</span>
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
          onSave={upsertHours}
          saving={saving}
          config={config}
          isAdmin={false}
          isWeekApproved={isWeekApproved}
          getWeekNumber={getWeekNumber}
          currentMonth={currentMonth}
        />
      ) : null}

      <p className="text-xs text-text-muted mt-3">
        Valor hora: ${config.hourly_rate.toLocaleString('es-AR')} · Dom/Feriados x{config.sunday_multiplier}
      </p>
    </div>
  )
}

// =====================
// SUMMARY CARD
// =====================

function SummaryCard({ icon, label, value, color }: { icon?: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-text-muted">{icon}</span>}
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${color || 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

// =====================
// ADMIN RESUMEN
// =====================

function AdminResumen({
  employees,
  calcTotals,
  config,
  payments,
  togglePayment,
  approvals,
  isWeekApproved,
  toggleApproval,
  getWeeksInMonth,
  currentMonth,
}: {
  employees: HorasEmployee[]
  calcTotals: (id: string) => { totalHrs: number; normalHrs: number; doubleHrs: number; workedDays: number; pay: number }
  config: HorasConfig
  payments: PaymentRecord[]
  togglePayment: (empId: string, amount: number, markPaid: boolean) => Promise<void>
  approvals: WeeklyApproval[]
  isWeekApproved: (wk: number) => boolean
  toggleApproval: (wk: number, approve: boolean) => Promise<void>
  getWeeksInMonth: () => number
  currentMonth: { year: number; month: number }
}) {
  let totalPay = 0
  const empData = employees.map(emp => {
    const totals = calcTotals(emp.id)
    totalPay += totals.pay
    const isPaid = payments.some(p => p.employee_id === emp.id)
    const paidRecord = payments.find(p => p.employee_id === emp.id)
    return { emp, totals, isPaid, paidRecord }
  })

  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const weeks = getWeeksInMonth()
  const firstDayOffset = (new Date(currentMonth.year, currentMonth.month, 1).getDay() + 6) % 7
  const totalDays = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()

  return (
    <div>
      {/* Top summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <SummaryCard icon={<DollarSign size={16} />} label="Total a pagar" value={`$${Math.round(totalPay).toLocaleString('es-AR')}`} color="text-green-primary" />
        <SummaryCard label="Tarifa/hora" value={`$${config.hourly_rate.toLocaleString('es-AR')}`} />
        <SummaryCard icon={<CheckCircle2 size={16} />} label="Pagadas" value={`${payments.length}/${employees.length}`} />
      </div>

      {/* Employee cards */}
      <div className="space-y-3 mb-8">
        {empData.map(({ emp, totals, isPaid, paidRecord }) => (
          <div key={emp.id} className={`bg-surface rounded-xl border p-4 ${isPaid ? 'border-green-primary' : 'border-border'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="font-semibold text-text-primary">{emp.name}</h4>
                {isPaid && paidRecord && (
                  <p className="text-xs text-green-primary font-medium">
                    Pagado el {new Date(paidRecord.paid_at).toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-green-primary">
                  ${Math.round(totals.pay).toLocaleString('es-AR')}
                </span>
                <button
                  onClick={() => togglePayment(emp.id, Math.round(totals.pay), !isPaid)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    isPaid
                      ? 'bg-green-primary text-white border-green-primary'
                      : 'bg-green-light text-green-dark border-green-primary hover:bg-green-primary hover:text-white'
                  }`}
                >
                  {isPaid ? '✓ Pagado' : 'Ya pagué'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary">
              <span>Normales: <strong className="text-text-primary">{totals.normalHrs}h</strong></span>
              <span>Dom/Feriado: <strong className="text-text-primary">{totals.doubleHrs}h (x{config.sunday_multiplier})</strong></span>
              <span>Días: <strong className="text-text-primary">{totals.workedDays}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly approvals */}
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Aprobación semanal</h4>
      <div className="bg-surface rounded-xl border border-border divide-y divide-border-light">
        {Array.from({ length: weeks }).map((_, w) => {
          const startDay = Math.max(1, w * 7 - firstDayOffset + 1)
          const endDay = Math.min(totalDays, (w + 1) * 7 - firstDayOffset)
          const approved = isWeekApproved(w)

          return (
            <div key={w} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-primary">
                Semana {w + 1} · {startDay} al {endDay} de {MONTHS_ES[currentMonth.month]}
              </span>
              <button
                onClick={() => toggleApproval(w, !approved)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  approved
                    ? 'bg-green-primary text-white border-green-primary'
                    : 'bg-green-light text-green-dark border-green-primary hover:bg-green-primary hover:text-white'
                }`}
              >
                {approved ? '✓ Aprobada' : 'Aprobar'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================
// ADMIN CONFIG
// =====================

export function AdminConfig({
  config,
  onUpdateConfig,
  employees,
  fetchEmployees,
}: {
  config: HorasConfig
  onUpdateConfig: (key: string, value: string) => Promise<void>
  employees: HorasEmployee[]
  fetchEmployees: () => Promise<void>
}) {
  const supabase = createClient()
  const [rate, setRate] = useState(String(config.hourly_rate))
  const [mult, setMult] = useState(String(config.sunday_multiplier))
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    setRate(String(config.hourly_rate))
    setMult(String(config.sunday_multiplier))
  }, [config])

  const handleSaveRate = async () => {
    setSavingConfig(true)
    await onUpdateConfig('hourly_rate', rate)
    setSavingConfig(false)
  }

  const handleSaveMult = async () => {
    setSavingConfig(true)
    await onUpdateConfig('sunday_multiplier', mult)
    setSavingConfig(false)
  }

  const addEmployee = async () => {
    if (!newName.trim() || !newToken.trim()) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('employees') as any)
        .insert({ name: newName.trim(), token: newToken.trim(), active: true })
      setNewName('')
      setNewToken('')
      fetchEmployees()
    } catch (err) {
      console.error('Error adding employee:', err)
    }
  }

  const removeEmployee = async (id: string, name: string) => {
    if (!confirm(`¿Seguro que querés quitar a ${name}?`)) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('employees') as any)
        .update({ active: false })
        .eq('id', id)
      fetchEmployees()
    } catch (err) {
      console.error('Error removing employee:', err)
    }
  }

  return (
    <div>
      {/* Tarifa */}
      <div className="bg-surface rounded-xl border border-border p-5 mb-4">
        <h4 className="text-sm font-semibold text-text-primary mb-4">Tarifa</h4>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary min-w-[120px]">Valor hora ($)</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              min="0"
              step="100"
              className="w-28 px-3 py-1.5 text-sm border border-border rounded-lg bg-white text-text-primary focus:outline-none focus:border-green-primary"
            />
            <button
              onClick={handleSaveRate}
              disabled={savingConfig}
              className="text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-beige transition-colors"
            >
              Guardar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary min-w-[120px]">Multiplicador dom/fer.</label>
            <input
              type="number"
              value={mult}
              onChange={(e) => setMult(e.target.value)}
              min="1"
              max="3"
              step="0.5"
              className="w-28 px-3 py-1.5 text-sm border border-border rounded-lg bg-white text-text-primary focus:outline-none focus:border-green-primary"
            />
            <button
              onClick={handleSaveMult}
              disabled={savingConfig}
              className="text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-beige transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Empleadas */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-4">Empleadas</h4>
        <div className="divide-y divide-border-light">
          {employees.map(e => (
            <div key={e.id} className="flex items-center justify-between py-3">
              <div>
                <span className="text-sm font-medium text-text-primary">{e.name}</span>
              </div>
              <button
                onClick={() => removeEmployee(e.id, e.name)}
                className="text-xs text-red font-medium px-3 py-1 border border-red-light rounded-lg hover:bg-red-light transition-colors"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border-light">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary"
          />
          <input
            type="text"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder="Token (ej: maria-2024)"
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary"
          />
          <button
            onClick={addEmployee}
            className="px-4 py-2 text-sm font-medium bg-green-primary text-white rounded-lg hover:bg-green-dark transition-colors"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================
// CALENDAR GRID
// =====================

function CalendarGrid({
  days,
  startPad,
  employeeId,
  getEntryForDay,
  onSave,
  saving,
  config,
  isAdmin,
  isWeekApproved,
  getWeekNumber,
  currentMonth,
}: {
  days: Date[]
  startPad: number
  employeeId: string
  getEntryForDay: (empId: string, date: Date) => HourEntry | undefined
  onSave: (empId: string, date: string, hours: number) => Promise<void>
  saving: boolean
  config: HorasConfig
  isAdmin: boolean
  isWeekApproved: (wk: number) => boolean
  getWeekNumber: (day: number) => number
  currentMonth: { year: number; month: number }
}) {
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const todayStr = getArgentinaToday()

  const handleSave = async (date: Date) => {
    const hours = parseFloat(editValue) || 0
    const dateStr = date.toISOString().split('T')[0]
    await onSave(employeeId, dateStr, hours)
    setEditingDay(null)
    setEditValue('')
  }

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
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="border-b border-r border-border-light p-2 min-h-[70px] bg-beige/20" />
        ))}

        {days.map(day => {
          const dateStr = day.toISOString().split('T')[0]
          const entry = getEntryForDay(employeeId, day)
          const dbl = isDoubleDay(day)
          const sunday = day.getDay() === 0
          const holName = getHoliday(day.getFullYear(), day.getMonth(), day.getDate())
          const isToday = dateStr === todayStr
          const isEditing = editingDay === dateStr
          const future = day > new Date()
          const weekNum = getWeekNumber(day.getDate())
          const weekApproved = isWeekApproved(weekNum)
          const locked = weekApproved && !isAdmin
          const cantClick = (!isAdmin && future) || locked

          return (
            <div
              key={dateStr}
              className={`border-b border-r border-border-light p-2 min-h-[70px] transition-colors relative
                ${dbl ? 'bg-amber-light/30' : ''}
                ${isToday ? 'ring-2 ring-inset ring-green-primary/30' : ''}
                ${cantClick ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-beige/30'}
                ${weekApproved ? '' : ''}
              `}
              onClick={() => {
                if (cantClick || saving) return
                if (!isEditing) {
                  setEditingDay(dateStr)
                  setEditValue(entry?.hours?.toString() || '')
                }
              }}
            >
              {/* Approved dot */}
              {weekApproved && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-primary" />
              )}

              <div className="flex items-start justify-between">
                <span className={`text-xs font-medium ${isToday ? 'text-green-primary' : dbl ? 'text-amber' : 'text-text-secondary'}`}>
                  {day.getDate()}
                </span>
                {dbl && (
                  <span className="text-[10px] text-amber font-medium">x{config.sunday_multiplier}</span>
                )}
              </div>

              {/* Holiday name */}
              {holName && !sunday && (
                <div className="text-[8px] text-amber truncate mt-0.5">{holName}</div>
              )}

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
                  <span className={`text-sm font-semibold ${dbl ? 'text-amber' : 'text-green-primary'}`}>
                    {entry.hours}h
                  </span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
