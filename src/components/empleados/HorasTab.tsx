'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createHorasClient } from '@/lib/supabase/horas-client'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  DollarSign,
  Briefcase,
  Sun,
  CheckCircle2,
  X,
} from 'lucide-react'

interface Employee {
  id: string
  name: string
  token: string
  active: boolean
}

interface HourEntry {
  id: string
  employee_id: string
  date: string
  hours: number
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
  total_hours: number
  total_amount: number
  paid_at: string
}

interface Config {
  hourly_rate: string
  sunday_multiplier: string
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const HOLIDAYS: Record<number, [number, number, string][]> = {
  2025: [
    [0,1,'Año Nuevo'],[1,3,'Carnaval'],[1,4,'Carnaval'],[2,24,'Día de la Memoria'],[3,2,'Malvinas'],[3,3,'Viernes Santo'],
    [4,1,'Día del Trabajador'],[4,25,'Revolución de Mayo'],[5,16,'Güemes'],[5,20,'Belgrano'],[6,9,'Independencia'],
    [7,17,'San Martín'],[9,12,'Diversidad Cultural'],[10,20,'Soberanía Nacional'],[11,8,'Inmaculada Concepción'],[11,25,'Navidad']
  ],
  2026: [
    [0,1,'Año Nuevo'],[1,16,'Carnaval'],[1,17,'Carnaval'],[2,24,'Día de la Memoria'],[3,2,'Malvinas'],[3,3,'Viernes Santo'],
    [4,1,'Día del Trabajador'],[4,25,'Revolución de Mayo'],[5,15,'Güemes'],[5,20,'Belgrano'],[6,9,'Independencia'],
    [7,17,'San Martín'],[9,12,'Diversidad Cultural'],[10,23,'Soberanía Nacional'],[11,8,'Inmaculada Concepción'],[11,25,'Navidad']
  ],
  2027: [
    [0,1,'Año Nuevo'],[1,8,'Carnaval'],[1,9,'Carnaval'],[2,24,'Día de la Memoria'],[3,2,'Malvinas'],
    [3,22,'Jueves Santo'],[3,23,'Viernes Santo'],[4,1,'Día del Trabajador'],[4,25,'Revolución de Mayo'],
    [5,21,'Güemes'],[5,20,'Belgrano'],[6,9,'Independencia'],[7,16,'San Martín'],
    [9,11,'Diversidad Cultural'],[10,22,'Soberanía Nacional'],[11,8,'Inmaculada Concepción'],[11,25,'Navidad']
  ]
}

function getHoliday(y: number, m: number, d: number): string | null {
  const yr = HOLIDAYS[y]
  if (!yr) return null
  const found = yr.find(h => h[0] === m && h[1] === d)
  return found ? found[2] : null
}

function isSunday(y: number, m: number, d: number) { return new Date(y, m, d).getDay() === 0 }
function isHoliday(y: number, m: number, d: number) { return getHoliday(y, m, d) !== null }
function isDoubleDay(y: number, m: number, d: number) { return isSunday(y, m, d) || isHoliday(y, m, d) }
function isToday(y: number, m: number, d: number) { const t = new Date(); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d }
function isFuture(y: number, m: number, d: number) { const today = new Date(); today.setHours(0, 0, 0, 0); return new Date(y, m, d) > today }
function dateStr(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
function getMonthDays(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1 }
function getWeekNumber(y: number, m: number, d: number) { return Math.floor((getFirstDayOfWeek(y, m) + d - 1) / 7) }
function getWeeksInMonth(y: number, m: number) { return Math.ceil((getFirstDayOfWeek(y, m) + getMonthDays(y, m)) / 7) }

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR') }

export default function HorasTab() {
  const supabase = useMemo(() => createHorasClient(), [])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [hours, setHours] = useState<HourEntry[]>([])
  const [approvals, setApprovals] = useState<WeeklyApproval[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [config, setConfig] = useState<Config>({ hourly_rate: '0', sunday_multiplier: '2' })
  const [loading, setLoading] = useState(true)

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [hourInput, setHourInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'resumen' | 'calendario'>('resumen')

  const fetchAll = useCallback(async () => {
    setLoading(true)

    try {
      const [empRes, configRes, hoursRes, approvalsRes, paymentsRes] = await Promise.all([
        supabase.from('employees').select('*').eq('active', true).order('name'),
        supabase.from('config').select('*'),
        supabase.from('hour_entries').select('*')
          .gte('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
          .lte('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${getMonthDays(currentYear, currentMonth)}`),
        supabase.from('weekly_approvals').select('*')
          .eq('year', currentYear).eq('month', currentMonth),
        supabase.from('payment_records').select('*')
          .eq('year', currentYear).eq('month', currentMonth),
      ])

      if (empRes.data) {
        setEmployees(empRes.data)
        if (empRes.data.length > 0) {
          setSelectedEmployee(prev => prev ?? empRes.data[0].id)
        }
      }
      if (configRes.data) {
        const cfg: Record<string, string> = {}
        configRes.data.forEach((c: { key: string; value: string }) => { cfg[c.key] = c.value })
        setConfig({ hourly_rate: cfg.hourly_rate || '0', sunday_multiplier: cfg.sunday_multiplier || '2' })
      }
      if (hoursRes.data) setHours(hoursRes.data)
      if (approvalsRes.data) setApprovals(approvalsRes.data)
      if (paymentsRes.data) setPayments(paymentsRes.data)
    } catch (err) {
      console.error('Error fetching horas data:', err)
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth])

  useEffect(() => { fetchAll() }, [fetchAll])

  const getHoursForDay = (empId: string, d: number): number => {
    const ds = dateStr(currentYear, currentMonth, d)
    const entry = hours.find(h => h.employee_id === empId && h.date === ds)
    return entry ? Number(entry.hours) : 0
  }

  const isWeekApproved = (weekNum: number) => approvals.some(a => a.week_number === weekNum && a.approved)

  const calcEmployeeMonth = (empId: string) => {
    const days = getMonthDays(currentYear, currentMonth)
    const rate = Number(config.hourly_rate) || 0
    const mult = Number(config.sunday_multiplier) || 2
    let normalHrs = 0, doubleHrs = 0, workedDays = 0
    for (let d = 1; d <= days; d++) {
      const h = getHoursForDay(empId, d)
      if (h > 0) {
        workedDays++
        if (isDoubleDay(currentYear, currentMonth, d)) doubleHrs += h
        else normalHrs += h
      }
    }
    const totalHrs = normalHrs + doubleHrs
    const pay = (normalHrs * rate) + (doubleHrs * rate * mult)
    return { totalHrs, normalHrs, doubleHrs, workedDays, pay }
  }

  const handleSaveHours = async (empId: string, day: number) => {
    setSaving(true)
    const ds = dateStr(currentYear, currentMonth, day)
    const val = parseFloat(hourInput)

    if (isNaN(val) || val <= 0) {
      await supabase.from('hour_entries').delete().eq('employee_id', empId).eq('date', ds)
    } else {
      await supabase.from('hour_entries').upsert(
        { employee_id: empId, date: ds, hours: val, updated_at: new Date().toISOString() },
        { onConflict: 'employee_id,date' }
      )
    }

    setEditingDay(null)
    setHourInput('')
    setSaving(false)
    fetchAll()
  }

  const handleDeleteHours = async (empId: string, day: number) => {
    const ds = dateStr(currentYear, currentMonth, day)
    await supabase.from('hour_entries').delete().eq('employee_id', empId).eq('date', ds)
    setEditingDay(null)
    fetchAll()
  }

  const handleToggleApproval = async (weekNum: number, approve: boolean) => {
    if (approve) {
      await supabase.from('weekly_approvals').upsert(
        { year: currentYear, month: currentMonth, week_number: weekNum, approved: true, approved_at: new Date().toISOString(), approved_by: 'admin' },
        { onConflict: 'year,month,week_number' }
      )
    } else {
      await supabase.from('weekly_approvals').delete()
        .eq('year', currentYear).eq('month', currentMonth).eq('week_number', weekNum)
    }
    fetchAll()
  }

  const handleTogglePayment = async (empId: string, amount: number, markPaid: boolean) => {
    const empName = employees.find(e => e.id === empId)?.name || ''
    if (markPaid) {
      if (!confirm(`¿Confirmar pago de ${formatMoney(amount)} a ${empName}?`)) return
      await supabase.from('payment_records').insert({
        employee_id: empId, year: currentYear, month: currentMonth,
        total_amount: amount, paid_by: 'admin'
      })
    } else {
      if (!confirm(`¿Desmarcar pago de ${empName}?`)) return
      await supabase.from('payment_records').delete()
        .eq('employee_id', empId).eq('year', currentYear).eq('month', currentMonth)
    }
    fetchAll()
  }

  const prevMonth = () => {
    setEditingDay(null)
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  const nextMonth = () => {
    setEditingDay(null)
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  if (loading) {
    return <div className="text-center text-text-muted py-12 text-sm">Cargando horas...</div>
  }

  if (employees.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center">
        <p className="text-sm text-text-secondary">No hay empleados cargados en el sistema de horas.</p>
      </div>
    )
  }

  const mult = Number(config.sunday_multiplier) || 2

  return (
    <div>
      {/* View toggle + Month nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 w-fit">
          <button
            onClick={() => setView('resumen')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'resumen' ? 'bg-green-primary text-white' : 'text-text-secondary hover:bg-beige'}`}
          >
            Resumen
          </button>
          <button
            onClick={() => setView('calendario')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'calendario' ? 'bg-green-primary text-white' : 'text-text-secondary hover:bg-beige'}`}
          >
            Calendario
          </button>
        </div>

        <div className="flex items-center gap-3 sm:ml-auto">
          <button onClick={prevMonth} className="p-1.5 hover:bg-beige rounded-lg border border-border transition-colors">
            <ChevronLeft size={16} className="text-text-secondary" />
          </button>
          <span className="text-sm font-semibold text-text-primary min-w-[140px] text-center">
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-beige rounded-lg border border-border transition-colors">
            <ChevronRight size={16} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {view === 'resumen' ? (
        <ResumenView
          employees={employees}
          config={config}
          payments={payments}
          approvals={approvals}
          currentYear={currentYear}
          currentMonth={currentMonth}
          mult={mult}
          calcEmployeeMonth={calcEmployeeMonth}
          isWeekApproved={isWeekApproved}
          onToggleApproval={handleToggleApproval}
          onTogglePayment={handleTogglePayment}
        />
      ) : (
        <CalendarioView
          employees={employees}
          selectedEmployee={selectedEmployee}
          currentYear={currentYear}
          currentMonth={currentMonth}
          mult={mult}
          editingDay={editingDay}
          hourInput={hourInput}
          saving={saving}
          calcEmployeeMonth={calcEmployeeMonth}
          getHoursForDay={getHoursForDay}
          isWeekApproved={isWeekApproved}
          onSelectEmployee={setSelectedEmployee}
          onOpenDay={(d) => {
            setEditingDay(d)
            const h = selectedEmployee ? getHoursForDay(selectedEmployee, d) : 0
            setHourInput(h > 0 ? h.toString() : '')
          }}
          onCloseModal={() => { setEditingDay(null); setHourInput('') }}
          onHourInputChange={setHourInput}
          onSaveHours={handleSaveHours}
          onDeleteHours={handleDeleteHours}
        />
      )}
    </div>
  )
}

// ============================================
// RESUMEN VIEW
// ============================================
function ResumenView({
  employees, config, payments, approvals, currentYear, currentMonth, mult,
  calcEmployeeMonth, isWeekApproved, onToggleApproval, onTogglePayment
}: {
  employees: Employee[]
  config: Config
  payments: PaymentRecord[]
  approvals: WeeklyApproval[]
  currentYear: number
  currentMonth: number
  mult: number
  calcEmployeeMonth: (id: string) => { totalHrs: number; normalHrs: number; doubleHrs: number; workedDays: number; pay: number }
  isWeekApproved: (w: number) => boolean
  onToggleApproval: (w: number, approve: boolean) => void
  onTogglePayment: (empId: string, amount: number, markPaid: boolean) => void
}) {
  const rate = Number(config.hourly_rate) || 0
  let totalPay = 0
  employees.forEach(e => { totalPay += calcEmployeeMonth(e.id).pay })
  const weeks = getWeeksInMonth(currentYear, currentMonth)

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-green-primary" />
            <span className="text-xs font-medium text-text-muted uppercase">Total a pagar</span>
          </div>
          <p className="text-xl font-semibold text-green-primary">{formatMoney(totalPay)}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-text-muted" />
            <span className="text-xs font-medium text-text-muted uppercase">Tarifa/hora</span>
          </div>
          <p className="text-xl font-semibold text-text-primary">{formatMoney(rate)}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} className="text-text-muted" />
            <span className="text-xs font-medium text-text-muted uppercase">Pagadas</span>
          </div>
          <p className="text-xl font-semibold text-text-primary">{payments.length}/{employees.length}</p>
        </div>
      </div>

      {/* Employee cards */}
      <div className="space-y-3 mb-6">
        {employees.map(emp => {
          const s = calcEmployeeMonth(emp.id)
          const isPaid = payments.some(p => p.employee_id === emp.id)
          const paidRecord = payments.find(p => p.employee_id === emp.id)
          const paidDate = isPaid && paidRecord ? new Date(paidRecord.paid_at).toLocaleDateString('es-AR') : ''

          return (
            <div key={emp.id} className={`bg-surface rounded-xl border p-4 ${isPaid ? 'border-green-primary' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{emp.name}</p>
                  {isPaid && <p className="text-xs text-green-primary font-medium">Pagado el {paidDate}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-green-primary">{formatMoney(s.pay)}</span>
                  <button
                    onClick={() => onTogglePayment(emp.id, Math.round(s.pay), !isPaid)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      isPaid
                        ? 'bg-green-primary text-white border-green-primary'
                        : 'bg-green-light text-green-primary border-green-primary hover:bg-green-primary hover:text-white'
                    }`}
                  >
                    {isPaid ? '✓ Pagado' : 'Ya pagué'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary">
                <span>Normales: <strong className="text-text-primary">{s.normalHrs}h</strong></span>
                <span>Dom/Feriado: <strong className="text-text-primary">{s.doubleHrs}h (x{mult})</strong></span>
                <span>Días: <strong className="text-text-primary">{s.workedDays}</strong></span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Weekly approvals */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Aprobación semanal</h3>
        <div className="space-y-2">
          {Array.from({ length: weeks }, (_, w) => {
            const startDay = Math.max(1, w * 7 - getFirstDayOfWeek(currentYear, currentMonth) + 1)
            const endDay = Math.min(getMonthDays(currentYear, currentMonth), (w + 1) * 7 - getFirstDayOfWeek(currentYear, currentMonth))
            const approved = isWeekApproved(w)
            return (
              <div key={w} className="flex items-center justify-between py-2 border-b border-border-light last:border-b-0">
                <span className="text-sm text-text-secondary">
                  Semana {w + 1} · {startDay} al {endDay} de {MONTHS[currentMonth]}
                </span>
                <button
                  onClick={() => onToggleApproval(w, !approved)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    approved
                      ? 'bg-green-primary text-white border-green-primary'
                      : 'bg-green-light text-green-primary border-green-primary hover:bg-green-primary hover:text-white'
                  }`}
                >
                  {approved ? '✓ Aprobada' : 'Aprobar'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================
// CALENDARIO VIEW
// ============================================
function CalendarioView({
  employees, selectedEmployee, currentYear, currentMonth, mult,
  editingDay, hourInput, saving,
  calcEmployeeMonth, getHoursForDay, isWeekApproved,
  onSelectEmployee, onOpenDay, onCloseModal, onHourInputChange, onSaveHours, onDeleteHours
}: {
  employees: Employee[]
  selectedEmployee: string | null
  currentYear: number
  currentMonth: number
  mult: number
  editingDay: number | null
  hourInput: string
  saving: boolean
  calcEmployeeMonth: (id: string) => { totalHrs: number; normalHrs: number; doubleHrs: number; workedDays: number; pay: number }
  getHoursForDay: (empId: string, d: number) => number
  isWeekApproved: (w: number) => boolean
  onSelectEmployee: (id: string) => void
  onOpenDay: (d: number) => void
  onCloseModal: () => void
  onHourInputChange: (v: string) => void
  onSaveHours: (empId: string, d: number) => void
  onDeleteHours: (empId: string, d: number) => void
}) {
  if (!selectedEmployee) return null

  const stats = calcEmployeeMonth(selectedEmployee)
  const days = getMonthDays(currentYear, currentMonth)
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth)

  return (
    <div>
      {/* Employee selector */}
      <div className="flex items-center gap-1 flex-wrap mb-4">
        {employees.map(emp => (
          <button
            key={emp.id}
            onClick={() => onSelectEmployee(emp.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedEmployee === emp.id
                ? 'bg-green-primary text-white'
                : 'bg-surface border border-border text-text-secondary hover:bg-beige'
            }`}
          >
            {emp.name}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <MiniCard icon={<Clock size={14} />} label="Total horas" value={stats.totalHrs.toString()} />
        <MiniCard icon={<Calendar size={14} />} label="Días" value={stats.workedDays.toString()} />
        <MiniCard icon={<Briefcase size={14} />} label="Normales" value={`${stats.normalHrs}h`} />
        <MiniCard icon={<Sun size={14} />} label={`Dom/Fer (x${mult})`} value={`${stats.doubleHrs}h`} />
        <MiniCard icon={<DollarSign size={14} />} label="A pagar" value={formatMoney(stats.pay)} highlight />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-primary" /> Hoy</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold" /> Dom/Feriado (x{mult})</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-dark" /> Aprobada</span>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-text-muted uppercase py-1">{d}</div>
        ))}

        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`e${i}`} className="min-h-[48px]" />
        ))}

        {Array.from({ length: days }, (_, i) => {
          const d = i + 1
          const sun = isSunday(currentYear, currentMonth, d)
          const hol = isHoliday(currentYear, currentMonth, d)
          const dbl = isDoubleDay(currentYear, currentMonth, d)
          const today = isToday(currentYear, currentMonth, d)
          const future = isFuture(currentYear, currentMonth, d)
          const h = getHoursForDay(selectedEmployee, d)
          const wk = getWeekNumber(currentYear, currentMonth, d)
          const approved = isWeekApproved(wk)
          const holName = getHoliday(currentYear, currentMonth, d)

          return (
            <button
              key={d}
              onClick={() => !future && onOpenDay(d)}
              disabled={future}
              className={`relative min-h-[48px] rounded-lg border p-1 text-left transition-colors
                ${sun || hol ? 'bg-[#fff8e7] border-gold' : 'bg-surface border-border'}
                ${today ? '!border-green-primary border-2' : ''}
                ${future ? 'opacity-30 cursor-default' : 'hover:border-green-primary cursor-pointer'}
                ${approved ? 'opacity-80' : ''}
              `}
            >
              <span className={`text-[11px] font-semibold ${sun || hol ? 'text-gold' : 'text-text-muted'}`}>{d}</span>
              {h > 0 && (
                <div className={`text-center text-xs font-semibold mt-0.5 ${dbl ? 'text-gold' : 'text-green-primary'}`}>
                  {h}h{dbl ? ` x${mult}` : ''}
                </div>
              )}
              {holName && !sun && (
                <div className="text-[7px] text-gold truncate mt-0.5">{holName}</div>
              )}
              {approved && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-primary" />
              )}
            </button>
          )
        })}
      </div>

      {/* Edit modal */}
      {editingDay !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onCloseModal}>
          <div className="bg-white rounded-xl p-6 w-[320px] shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary capitalize">
                {new Date(currentYear, currentMonth, editingDay).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {isDoubleDay(currentYear, currentMonth, editingDay) && (
                  <span className="text-xs text-gold font-medium ml-2">
                    ({getHoliday(currentYear, currentMonth, editingDay) || 'Domingo'} x{mult})
                  </span>
                )}
              </h3>
              <button onClick={onCloseModal} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">Horas trabajadas</label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={hourInput}
              onChange={e => onHourInputChange(e.target.value)}
              placeholder="8"
              autoFocus
              className="w-full border border-border rounded-lg px-4 py-3 text-lg font-semibold text-center text-text-primary bg-white focus:outline-none focus:border-green-primary mb-4"
            />

            <div className="flex items-center gap-2 justify-end">
              {getHoursForDay(selectedEmployee, editingDay) > 0 && (
                <button
                  onClick={() => onDeleteHours(selectedEmployee, editingDay)}
                  className="px-3 py-2 rounded-lg text-sm text-red border border-red-light hover:bg-red-light transition-colors"
                >
                  Borrar
                </button>
              )}
              <button onClick={onCloseModal} className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-beige transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => onSaveHours(selectedEmployee, editingDay)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-primary text-white hover:bg-green-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-text-muted">{icon}</span>
        <span className="text-[10px] font-medium text-text-muted uppercase">{label}</span>
      </div>
      <p className={`text-base font-semibold ${highlight ? 'text-green-primary' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}
