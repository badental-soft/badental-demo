'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  X,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  Clock,
  Receipt,
  AlertCircle,
} from 'lucide-react'
import type { Sede, Cobranza } from '@/types/database'

type CobranzaConSede = Cobranza & { sedes: Sede }

type TabId = 'cobranzas' | 'por-cobrar' | 'gastos'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'cobranzas', label: 'Cobranzas', icon: <DollarSign size={16} /> },
  { id: 'por-cobrar', label: 'Por Cobrar', icon: <Clock size={16} /> },
  { id: 'gastos', label: 'Gastos', icon: <Receipt size={16} /> },
]

const TIPO_PAGO_LABELS: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  efectivo: { label: 'Efectivo', icon: <Banknote size={14} />, bg: 'bg-green-light', text: 'text-green-primary' },
  transferencia: { label: 'Transferencia', icon: <ArrowLeftRight size={14} />, bg: 'bg-blue-light', text: 'text-blue' },
  tarjeta_debito: { label: 'Débito', icon: <CreditCard size={14} />, bg: 'bg-purple-light', text: 'text-purple' },
  tarjeta_credito: { label: 'Crédito', icon: <CreditCard size={14} />, bg: 'bg-amber-light', text: 'text-amber' },
}

export default function FinanzasPage() {
  const [activeTab, setActiveTab] = useState<TabId>('cobranzas')

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Finanzas</h1>
        <p className="text-sm text-text-secondary">Cobranzas, deudas pendientes y gastos</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'cobranzas' && <CobranzasTab />}
      {activeTab === 'por-cobrar' && <PorCobrarTab />}
      {activeTab === 'gastos' && <GastosTab />}
    </div>
  )
}

// ============================================
// COBRANZAS TAB (fully functional)
// ============================================
function CobranzasTab() {
  const { user } = useAuth()
  const supabase = createClient()
  const [cobranzas, setCobranzas] = useState<CobranzaConSede[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    paciente: '',
    tratamiento: '',
    monto: '',
    tipo_pago: 'efectivo' as string,
    es_cuota: false,
    notas: '',
    sede_id: '',
  })

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data)
  }, [supabase])

  const fetchCobranzas = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('cobranzas')
      .select('*, sedes(*)')
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })

    if (sedeFilter !== 'todas') {
      query = query.eq('sede_id', sedeFilter)
    }

    if (user?.rol === 'rolC' && user.sede_id) {
      query = query.eq('sede_id', user.sede_id)
    }

    const { data } = await query
    setCobranzas((data as CobranzaConSede[]) || [])
    setLoading(false)
  }, [supabase, fecha, sedeFilter, user])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchCobranzas() }, [fetchCobranzas])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 7 }),
      })
      const data = await res.json()
      if (data.error) {
        alert('Error: ' + data.error)
      } else {
        alert(`Sincronizado: ${data.insertados} pagos (${data.rango})`)
        fetchCobranzas()
      }
    } catch {
      alert('Error al sincronizar pagos')
    }
    setSyncing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.paciente || !formData.monto || !formData.sede_id) return

    setSaving(true)
    const { error } = await supabase.from('cobranzas').insert({
      fecha,
      sede_id: formData.sede_id,
      user_id: user?.id,
      paciente: formData.paciente,
      tratamiento: formData.tratamiento || 'Sin especificar',
      tipo_pago: formData.tipo_pago,
      monto: parseFloat(formData.monto),
      es_cuota: formData.es_cuota,
      notas: formData.notas || null,
    })

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setFormData({ paciente: '', tratamiento: '', monto: '', tipo_pago: 'efectivo', es_cuota: false, notas: '', sede_id: formData.sede_id })
      setShowForm(false)
      fetchCobranzas()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cobranza?')) return
    await supabase.from('cobranzas').delete().eq('id', id)
    fetchCobranzas()
  }

  const changeDate = (offset: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setFecha(d.toISOString().split('T')[0])
  }

  const goToday = () => setFecha(new Date().toISOString().split('T')[0])
  const isToday = fecha === new Date().toISOString().split('T')[0]

  const formatMoney = (n: number) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

  const formatFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const totalCobrado = cobranzas.reduce((s, c) => s + Number(c.monto), 0)
  const porTipo: Record<string, number> = {}
  cobranzas.forEach(c => {
    porTipo[c.tipo_pago] = (porTipo[c.tipo_pago] || 0) + Number(c.monto)
  })

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center gap-2 mb-4">
        {user?.rol === 'admin' && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sync Pagos'}
          </button>
        )}
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Agregar'}
        </button>
      </div>

      {/* Manual entry form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Nueva cobranza manual</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Paciente *</label>
              <input
                type="text"
                value={formData.paciente}
                onChange={e => setFormData({ ...formData, paciente: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tratamiento</label>
              <input
                type="text"
                value={formData.tratamiento}
                onChange={e => setFormData({ ...formData, tratamiento: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Monto *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={formData.monto}
                onChange={e => setFormData({ ...formData, monto: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Medio de pago *</label>
              <select
                value={formData.tipo_pago}
                onChange={e => setFormData({ ...formData, tipo_pago: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta_debito">Tarjeta Débito</option>
                <option value="tarjeta_credito">Tarjeta Crédito</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sede *</label>
              <select
                value={formData.sede_id}
                onChange={e => setFormData({ ...formData, sede_id: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                required
              >
                <option value="">Seleccionar sede</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Notas</label>
              <input
                type="text"
                value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={formData.es_cuota}
                onChange={e => setFormData({ ...formData, es_cuota: e.target.checked })}
                className="rounded border-border"
              />
              Es cuota
            </label>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto px-5 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {/* Date nav + filters */}
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

        {user?.rol === 'admin' && (
          <div className="flex items-center gap-2 sm:ml-auto">
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
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="text-green-primary" />
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total</span>
          </div>
          <p className="text-xl font-semibold text-green-primary">{formatMoney(totalCobrado)}</p>
          <p className="text-xs text-text-secondary mt-0.5">{cobranzas.length} cobros</p>
        </div>
        {Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, monto]) => {
          const style = TIPO_PAGO_LABELS[tipo] || TIPO_PAGO_LABELS.efectivo
          return (
            <div key={tipo} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={style.text}>{style.icon}</span>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{style.label}</span>
              </div>
              <p className={`text-lg font-semibold ${style.text}`}>{formatMoney(monto)}</p>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando cobranzas...</div>
        ) : cobranzas.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            No hay cobranzas para esta fecha
            {sedeFilter !== 'todas' ? ' en esta sede' : ''}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Tratamiento</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Sede</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Medio</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Notas</th>
                  {user?.rol === 'admin' && (
                    <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide w-16"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {cobranzas.map((c) => {
                  const style = TIPO_PAGO_LABELS[c.tipo_pago] || TIPO_PAGO_LABELS.efectivo
                  const isDentalink = c.tratamiento === 'Dentalink'
                  return (
                    <tr key={c.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                      <td className="px-4 py-3 text-text-primary">
                        {c.paciente}
                        {c.es_cuota && (
                          <span className="ml-2 text-xs bg-purple-light text-purple px-1.5 py-0.5 rounded-full">cuota</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                        {isDentalink ? (
                          <span className="text-xs bg-blue-light text-blue px-2 py-0.5 rounded-full">Dentalink</span>
                        ) : (
                          c.tratamiento || '\u2014'
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">
                        {c.sedes?.nombre || '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.icon}
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary whitespace-nowrap">
                        {formatMoney(Number(c.monto))}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs hidden lg:table-cell max-w-[200px] truncate">
                        {c.notas || '\u2014'}
                      </td>
                      {user?.rol === 'admin' && (
                        <td className="px-4 py-3 text-center">
                          {!isDentalink && (
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="text-text-muted hover:text-red transition-colors"
                              title="Eliminar"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && cobranzas.length > 0 && (
        <p className="text-xs text-text-muted mt-3">
          {cobranzas.length} cobro{cobranzas.length !== 1 ? 's' : ''} · Total: {formatMoney(totalCobrado)}
        </p>
      )}
    </div>
  )
}

// ============================================
// POR COBRAR TAB (placeholder)
// ============================================
function PorCobrarTab() {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Por Cobrar</h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        Deudas y saldos pendientes de pacientes. Este modulo se activara cuando se carguen los datos desde el Excel de deudas.
      </p>
    </div>
  )
}

// ============================================
// GASTOS TAB (placeholder)
// ============================================
function GastosTab() {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Gastos</h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        Control de gastos por categoria y sede. Este modulo se activara cuando se carguen los datos desde el Excel de gastos.
      </p>
    </div>
  )
}
