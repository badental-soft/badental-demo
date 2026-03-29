'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import SyncButton from '@/components/SyncButton'
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
  TrendingUp,
  TrendingDown,
  CalendarClock,
} from 'lucide-react'
import type { Sede, Cobranza } from '@/types/database'
import { getArgentinaToday } from '@/lib/utils/dates'

type CobranzaConSede = Cobranza & { sedes: Sede }

type TabId = 'resumen' | 'cobranzas' | 'por-cobrar' | 'gastos'

function useDolarOficial() {
  const [cotizacion, setCotizacion] = useState<number | null>(null)
  const [loadingDolar, setLoadingDolar] = useState(false)

  const fetchDolar = useCallback(async () => {
    setLoadingDolar(true)
    try {
      const res = await fetch('/api/dolar')
      if (res.ok) {
        const data = await res.json()
        setCotizacion(data.venta)
      }
    } catch { /* ignore */ } finally {
      setLoadingDolar(false)
    }
  }, [])

  return { cotizacion, loadingDolar, fetchDolar }
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'resumen', label: 'Resumen', icon: <TrendingUp size={16} /> },
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
  const [activeTab, setActiveTab] = useState<TabId>('resumen')

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Finanzas</h1>
        <p className="text-sm text-text-secondary">Cobranzas, deudas pendientes y gastos</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit overflow-x-auto max-w-full">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0
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
      {activeTab === 'resumen' && <ResumenTab />}
      {activeTab === 'cobranzas' && <CobranzasTab />}
      {activeTab === 'por-cobrar' && <PorCobrarTab />}
      {activeTab === 'gastos' && <GastosTab />}
    </div>
  )
}

// ============================================
// RESUMEN TAB
// ============================================
function ResumenTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [cobradoMes, setCobradoMes] = useState(0)
  const [cobradoHoy, setCobradoHoy] = useState(0)
  const [gastosMesPagado, setGastosMesPagado] = useState(0)
  const [gastosMesPendiente, setGastosMesPendiente] = useState(0)
  const [deudasPendientes, setDeudasPendientes] = useState(0)
  const [proximosVencimientos, setProximosVencimientos] = useState<{ id: string; concepto: string; monto: number; fecha_vencimiento: string; categoria: string; sede_ids?: string[] }[]>([])

  const hoy = getArgentinaToday()
  const mesActual = hoy.slice(0, 7)

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchResumen = useCallback(async () => {
    setLoading(true)
    try {
      const inicioMes = mesActual + '-01'
      const [y, m] = mesActual.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const finMes = `${mesActual}-${String(lastDay).padStart(2, '0')}`

      const [cobMesRes, cobHoyRes, gastosMesRes, deudasRes, vencimientosRes, sedesRes] = await Promise.all([
        supabase.from('cobranzas').select('monto, sede_id, sede_ids').gte('fecha', inicioMes).lte('fecha', finMes),
        supabase.from('cobranzas').select('monto, sede_id, sede_ids').eq('fecha', hoy),
        supabase.from('gastos').select('monto, estado, sede_ids').gte('fecha', inicioMes).lte('fecha', finMes),
        supabase.from('deudas').select('monto_total, monto_cobrado, sede_id').in('estado', ['pendiente', 'parcial']),
        supabase.from('gastos').select('id, concepto, monto, fecha_vencimiento, categoria, sede_ids').eq('estado', 'pendiente').not('fecha_vencimiento', 'is', null).gte('fecha_vencimiento', hoy).order('fecha_vencimiento', { ascending: true }).limit(10),
        supabase.from('sedes').select('*').eq('activa', true).order('nombre'),
      ])

      const allSedes = (sedesRes.data || []) as Sede[]
      if (allSedes.length > 0) setSedes(allSedes)
      const sedesCount = allSedes.length || 1

      // Helper: calculate proportional monto for cobranza given sede filter
      const cobMonto = (c: { monto: number; sede_id?: string | null; sede_ids?: string[] }, filter: string): number => {
        const monto = Number(c.monto)
        if (filter === 'todas') return monto
        const ids = c.sede_ids || []
        if (ids.length > 1) {
          return ids.includes(filter) ? monto / ids.length : 0
        } else if (ids.length === 1) {
          return ids[0] === filter ? monto : 0
        } else if (c.sede_id) {
          return c.sede_id === filter ? monto : 0
        }
        // General: proportional
        return monto / sedesCount
      }

      // Helper: calculate proportional monto for gasto given sede filter
      const gasMonto = (g: { monto: number; sede_ids?: string[] }, filter: string): number => {
        const monto = Number(g.monto)
        if (filter === 'todas') return monto
        const ids = g.sede_ids || []
        if (ids.length === 0) return monto / sedesCount
        return ids.includes(filter) ? monto / ids.length : 0
      }

      const sf = sedeFilter

      setCobradoMes((cobMesRes.data || []).reduce((s: number, c: { monto: number; sede_id?: string | null; sede_ids?: string[] }) => s + cobMonto(c, sf), 0))
      setCobradoHoy((cobHoyRes.data || []).reduce((s: number, c: { monto: number; sede_id?: string | null; sede_ids?: string[] }) => s + cobMonto(c, sf), 0))

      const gastosData = (gastosMesRes.data || []) as { monto: number; estado: string; sede_ids?: string[] }[]
      setGastosMesPagado(gastosData.filter(g => g.estado === 'pagado').reduce((s, g) => s + gasMonto(g, sf), 0))
      setGastosMesPendiente(gastosData.filter(g => g.estado === 'pendiente').reduce((s, g) => s + gasMonto(g, sf), 0))

      if (sf === 'todas') {
        setDeudasPendientes((deudasRes.data || []).reduce((s: number, d: { monto_total: number; monto_cobrado: number }) => s + (Number(d.monto_total) - Number(d.monto_cobrado)), 0))
      } else {
        setDeudasPendientes((deudasRes.data || []).filter((d: { sede_id?: string }) => d.sede_id === sf).reduce((s: number, d: { monto_total: number; monto_cobrado: number }) => s + (Number(d.monto_total) - Number(d.monto_cobrado)), 0))
      }

      // Filter vencimientos by sede
      const vencData = (vencimientosRes.data || []) as { id: string; concepto: string; monto: number; fecha_vencimiento: string; categoria: string; sede_ids?: string[] }[]
      if (sf === 'todas') {
        setProximosVencimientos(vencData.slice(0, 5))
      } else {
        setProximosVencimientos(vencData.filter(v => {
          const ids = v.sede_ids || []
          return ids.length === 0 || ids.includes(sf)
        }).slice(0, 5))
      }
    } catch (err) {
      console.error('Error fetching resumen:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy, mesActual, sedeFilter])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchResumen() }, [fetchResumen])

  const formatMoney = (n: number) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

  const totalGastosMes = gastosMesPagado + gastosMesPendiente
  const resultado = cobradoMes - gastosMesPagado

  const formatFechaCorta = (fecha: string) => {
    const [y, m, d] = fecha.split('-')
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
  }

  if (loading) {
    return <div className="text-center text-text-muted py-12 text-sm">Cargando resumen...</div>
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <span className="text-sm text-text-secondary">Resumen financiero del mes</span>
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center">
              <DollarSign size={18} className="text-green-primary" />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Cobrado hoy</span>
          </div>
          <p className="text-xl font-semibold text-green-primary">{formatMoney(cobradoHoy)}</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center">
              <TrendingUp size={18} className="text-green-primary" />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Cobrado mes</span>
          </div>
          <p className="text-xl font-semibold text-green-primary">{formatMoney(cobradoMes)}</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-light flex items-center justify-center">
              <TrendingDown size={18} className="text-red" />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Gastos mes</span>
          </div>
          <p className="text-xl font-semibold text-red">{formatMoney(totalGastosMes)}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {formatMoney(gastosMesPagado)} pagado · {formatMoney(gastosMesPendiente)} pendiente
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg ${resultado >= 0 ? 'bg-green-light' : 'bg-red-light'} flex items-center justify-center`}>
              <TrendingUp size={18} className={resultado >= 0 ? 'text-green-primary' : 'text-red'} />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Resultado mes</span>
          </div>
          <p className={`text-xl font-semibold ${resultado >= 0 ? 'text-green-primary' : 'text-red'}`}>
            {formatMoney(resultado)}
          </p>
          <p className="text-xs text-text-muted mt-0.5">Cobrado - Gastos pagados</p>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center">
              <Clock size={18} className="text-gold-dark" />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Por cobrar</span>
          </div>
          <p className="text-xl font-semibold text-gold-dark">{formatMoney(deudasPendientes)}</p>
          <p className="text-xs text-text-muted mt-0.5">Deudas activas de pacientes</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-light flex items-center justify-center">
              <CalendarClock size={18} className="text-amber" />
            </div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Gastos pendientes</span>
          </div>
          <p className="text-xl font-semibold text-amber">{formatMoney(gastosMesPendiente)}</p>
          <p className="text-xs text-text-muted mt-0.5">Por pagar este mes</p>
        </div>
      </div>

      {/* Proximos vencimientos */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <CalendarClock size={16} className="text-text-muted" />
            Proximos vencimientos
          </h3>
        </div>
        {proximosVencimientos.length === 0 ? (
          <div className="p-6 text-center text-text-muted text-sm">
            No hay gastos con vencimientos pendientes
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {proximosVencimientos.map(v => {
              const colors = CATEGORIA_COLORS[v.categoria] || CATEGORIA_COLORS.otros
              const catLabel = GASTO_CATEGORIAS.find(c => c.value === v.categoria)?.label || v.categoria
              const diasRestantes = Math.ceil((new Date(v.fecha_vencimiento + 'T12:00:00').getTime() - new Date(hoy + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
              return (
                <div key={v.id} className="flex items-center justify-between px-5 py-3 hover:bg-beige/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-beige rounded-lg">
                      <span className="text-xs text-text-muted leading-tight">{formatFechaCorta(v.fecha_vencimiento).split(' ')[1]}</span>
                      <span className="text-lg font-semibold text-text-primary leading-tight">{formatFechaCorta(v.fecha_vencimiento).split(' ')[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{v.concepto}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {catLabel}
                        </span>
                        <span className={`text-xs ${diasRestantes <= 3 ? 'text-red font-medium' : 'text-text-muted'}`}>
                          {diasRestantes === 0 ? 'Hoy' : diasRestantes === 1 ? 'Manana' : `En ${diasRestantes} dias`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-text-primary whitespace-nowrap ml-4">
                    {formatMoney(Number(v.monto))}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
  const [fecha, setFecha] = useState(() => getArgentinaToday())
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // USD
  const { cotizacion, loadingDolar, fetchDolar } = useDolarOficial()

  const [formData, setFormData] = useState({
    paciente: '',
    tratamiento: '',
    monto: '',
    tipo_pago: 'efectivo' as string,
    es_cuota: false,
    notas: '',
    sede_ids: [] as string[],
    sedeMode: 'una' as 'una' | 'varias',
    moneda: 'ARS' as string,
    monto_usd: '',
    tipo_cambio: '',
  })

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCobranzas = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('cobranzas')
      .select('*, sedes(*)')
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })

    // sede filter applied client-side to include multi-sede entries

    if (user?.rol === 'rolC' && user.sede_id) {
      query = query.eq('sede_id', user.sede_id)
    }

    const { data } = await query
    setCobranzas((data as CobranzaConSede[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, user])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchCobranzas() }, [fetchCobranzas])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.paciente) return
    // General = array vacío (todas), seleccionar = las elegidas
    const sedeIds = formData.sedeMode === 'una' ? [] : formData.sede_ids

    const isUSD = formData.moneda === 'USD'
    let montoARS: number
    let montoOriginal: number | null = null
    let tipoCambio: number | null = null

    if (isUSD) {
      if (!formData.monto_usd || !formData.tipo_cambio) return
      montoOriginal = parseFloat(formData.monto_usd)
      tipoCambio = parseFloat(formData.tipo_cambio)
      montoARS = montoOriginal * tipoCambio
    } else {
      if (!formData.monto) return
      montoARS = parseFloat(formData.monto)
    }

    setSaving(true)
    const { error } = await supabase.from('cobranzas').insert({
      fecha,
      sede_id: sedeIds.length > 0 ? sedeIds[0] : null,
      sede_ids: sedeIds,
      user_id: user?.id,
      paciente: formData.paciente,
      tratamiento: formData.tratamiento || 'Sin especificar',
      tipo_pago: formData.tipo_pago,
      monto: montoARS,
      es_cuota: formData.es_cuota,
      notas: formData.notas || null,
      moneda: formData.moneda,
      monto_original: montoOriginal,
      tipo_cambio: tipoCambio,
    })

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setFormData({ ...formData, paciente: '', tratamiento: '', monto: '', monto_usd: '', tipo_cambio: '', es_cuota: false, notas: '', moneda: 'ARS' })
      setShowForm(false)
      fetchCobranzas()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cobranza?')) return
    const { error } = await supabase.from('cobranzas').delete().eq('id', id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    fetchCobranzas()
  }

  const changeDate = (offset: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setFecha(d.toISOString().split('T')[0])
  }

  const goToday = () => setFecha(getArgentinaToday())
  const isToday = fecha === getArgentinaToday()

  const formatMoney = (n: number) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

  const formatFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Client-side sede filter
  const cobranzasFiltradas = sedeFilter === 'todas'
    ? cobranzas
    : cobranzas.filter(c => {
        const ids = c.sede_ids || []
        if (ids.length > 0) return ids.includes(sedeFilter)
        if (c.sede_id) return c.sede_id === sedeFilter
        // General (sin sede): mostrar en todas
        return true
      })

  const totalCobrado = cobranzasFiltradas.reduce((s, c) => s + Number(c.monto), 0)
  const porTipo: Record<string, number> = {}
  cobranzasFiltradas.forEach(c => {
    porTipo[c.tipo_pago] = (porTipo[c.tipo_pago] || 0) + Number(c.monto)
  })

  // Per-sede totals (proporcional)
  const porSedeCobranza: Record<string, number> = {}
  cobranzas.forEach(c => {
    const monto = Number(c.monto)
    const ids = c.sede_ids || []
    if (ids.length > 1) {
      // Multi-sede: dividir proporcionalmente
      ids.forEach((sid: string) => {
        porSedeCobranza[sid] = (porSedeCobranza[sid] || 0) + monto / ids.length
      })
    } else if (ids.length === 1) {
      porSedeCobranza[ids[0]] = (porSedeCobranza[ids[0]] || 0) + monto
    } else if (c.sede_id) {
      // Dentalink o entrada vieja con sede_id: sumar directo a esa sede
      porSedeCobranza[c.sede_id] = (porSedeCobranza[c.sede_id] || 0) + monto
    } else {
      // General (sin sede_id ni sede_ids): dividir entre todas
      sedes.forEach(s => {
        porSedeCobranza[s.id] = (porSedeCobranza[s.id] || 0) + monto / sedes.length
      })
    }
  })

  const getCobranzaSedeLabel = (c: CobranzaConSede): string => {
    const ids = c.sede_ids || []
    if (ids.length === 0) {
      // Old entries without sede_ids: fall back to sede join
      if (c.sedes?.nombre) return c.sedes.nombre
      return 'General'
    }
    if (ids.length === sedes.length) return 'Todas'
    if (ids.length === 1) return sedes.find(s => s.id === ids[0])?.nombre || '\u2014'
    return ids.map(id => sedes.find(s => s.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center gap-2 mb-4">
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
              <label className="block text-xs font-medium text-text-secondary mb-1">Moneda</label>
              <select
                value={formData.moneda}
                onChange={e => {
                  const moneda = e.target.value
                  setFormData({ ...formData, moneda, monto: '', monto_usd: '', tipo_cambio: '' })
                  if (moneda === 'USD' && !cotizacion) fetchDolar()
                }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              >
                <option value="ARS">ARS (Pesos)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
            {formData.moneda === 'ARS' ? (
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
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Monto USD *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.monto_usd}
                    onChange={e => {
                      const usd = e.target.value
                      const tc = formData.tipo_cambio ? parseFloat(formData.tipo_cambio) : 0
                      setFormData({ ...formData, monto_usd: usd, monto: usd && tc ? String(parseFloat(usd) * tc) : '' })
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Tipo de cambio *
                    {loadingDolar && <span className="ml-1 text-text-muted">(cargando...)</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.tipo_cambio}
                      onChange={e => {
                        const tc = e.target.value
                        const usd = formData.monto_usd ? parseFloat(formData.monto_usd) : 0
                        setFormData({ ...formData, tipo_cambio: tc, monto: usd && tc ? String(usd * parseFloat(tc)) : '' })
                      }}
                      placeholder={cotizacion ? `Oficial: $${cotizacion}` : ''}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                      required
                    />
                    {cotizacion && (
                      <button
                        type="button"
                        onClick={() => {
                          const usd = formData.monto_usd ? parseFloat(formData.monto_usd) : 0
                          setFormData({ ...formData, tipo_cambio: String(cotizacion), monto: usd ? String(usd * cotizacion) : '' })
                        }}
                        className="px-2 py-1 text-xs bg-blue-light text-blue rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        Usar oficial
                      </button>
                    )}
                  </div>
                  {formData.monto_usd && formData.tipo_cambio && (
                    <p className="text-xs text-text-muted mt-1">
                      = {formatMoney(parseFloat(formData.monto_usd) * parseFloat(formData.tipo_cambio))}
                    </p>
                  )}
                </div>
              </>
            )}
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
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-text-secondary mb-1">Sedes</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.sedeMode === 'una'}
                    onChange={() => setFormData({ ...formData, sedeMode: 'una', sede_ids: [] })}
                    className="accent-green-primary"
                  />
                  <span className="text-text-primary">General (todas)</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.sedeMode === 'varias'}
                    onChange={() => setFormData({ ...formData, sedeMode: 'varias' })}
                    className="accent-green-primary"
                  />
                  <span className="text-text-primary">Seleccionar sedes</span>
                </label>
                {formData.sedeMode === 'varias' && (
                  <div className="flex flex-wrap gap-2 ml-2">
                    {sedes.map(s => {
                      const checked = formData.sede_ids.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                            checked
                              ? 'bg-green-100 border-green-300 text-green-700'
                              : 'bg-beige border-border text-text-secondary hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const newIds = checked
                                ? formData.sede_ids.filter(id => id !== s.id)
                                : [...formData.sede_ids, s.id]
                              setFormData({ ...formData, sede_ids: newIds })
                            }}
                            className="hidden"
                          />
                          {s.nombre}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
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
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
          {user?.rol === 'admin' && (
            <SyncButton
              label="Sync Pagos"
              endpoints={[{ url: '/api/sync-pagos', body: { dias: 7 } }]}
              onDone={() => fetchCobranzas()}
            />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-surface rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="text-green-primary" />
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total</span>
          </div>
          <p className="text-xl font-semibold text-green-primary">{formatMoney(totalCobrado)}</p>
          <p className="text-xs text-text-secondary mt-0.5">{cobranzasFiltradas.length} cobros</p>
        </div>
        {Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, monto]) => {
          const style = TIPO_PAGO_LABELS[tipo] || TIPO_PAGO_LABELS.efectivo
          return (
            <div key={tipo} className="bg-surface rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={style.text}>{style.icon}</span>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{style.label}</span>
              </div>
              <p className={`text-lg font-semibold ${style.text}`}>{formatMoney(monto)}</p>
            </div>
          )
        })}
      </div>

      {/* Per-sede breakdown */}
      {cobranzas.length > 0 && sedes.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4 mb-6">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Cobrado por sede (proporcional)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sedes.map(s => {
              const total = porSedeCobranza[s.id] || 0
              return (
                <button
                  key={s.id}
                  onClick={() => setSedeFilter(sedeFilter === s.id ? 'todas' : s.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-all ${
                    sedeFilter === s.id
                      ? 'bg-green-50 border-green-200 ring-2 ring-green-primary/20'
                      : 'border-border hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs text-text-muted truncate">{s.nombre}</p>
                  <p className="text-sm font-semibold text-green-primary">{formatMoney(total)}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando cobranzas...</div>
        ) : cobranzasFiltradas.length === 0 ? (
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
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Sedes</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Medio</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Notas</th>
                  {user?.rol === 'admin' && (
                    <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide w-16"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {cobranzasFiltradas.map((c) => {
                  const style = TIPO_PAGO_LABELS[c.tipo_pago] || TIPO_PAGO_LABELS.efectivo
                  const isDentalink = c.tratamiento === 'Dentalink'
                  const sedeLabel = getCobranzaSedeLabel(c)
                  const sedeIds = c.sede_ids || []
                  const cantSedes = sedeIds.length > 1 ? sedeIds.length : 1
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
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-text-secondary text-xs">{sedeLabel}</span>
                        {cantSedes > 1 && (
                          <span className="text-text-muted text-[10px] ml-1">
                            ({formatMoney(Number(c.monto) / cantSedes)} c/u)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.icon}
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary whitespace-nowrap">
                        {formatMoney(Number(c.monto))}
                        {c.moneda === 'USD' && c.monto_original && (
                          <span className="block text-[10px] text-blue font-medium">
                            US$ {Number(c.monto_original).toLocaleString('es-AR')} @ ${Number(c.tipo_cambio).toLocaleString('es-AR')}
                          </span>
                        )}
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

      {!loading && cobranzasFiltradas.length > 0 && (
        <p className="text-xs text-text-muted mt-3">
          {cobranzasFiltradas.length} cobro{cobranzasFiltradas.length !== 1 ? 's' : ''} · Total: {formatMoney(totalCobrado)}
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
// GASTOS TAB
// ============================================

const GASTO_CATEGORIAS: { value: string; label: string }[] = [
  { value: 'personal', label: 'Personal de trabajo' },
  { value: 'laboratorio', label: 'Laboratorio / Coronas' },
  { value: 'sueldos', label: 'Sueldos' },
  { value: 'publicidad', label: 'Publicidad / Marketing' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'implantes', label: 'Implantes' },
  { value: 'insumos', label: 'Insumos / Materiales' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'servicios', label: 'Servicios (luz, internet, etc)' },
  { value: 'otros', label: 'Otros' },
]

const CATEGORIA_COLORS: Record<string, { bg: string; text: string }> = {
  personal: { bg: 'bg-blue-light', text: 'text-blue' },
  laboratorio: { bg: 'bg-purple-light', text: 'text-purple' },
  sueldos: { bg: 'bg-green-light', text: 'text-green-primary' },
  publicidad: { bg: 'bg-amber-light', text: 'text-amber' },
  limpieza: { bg: 'bg-blue-light', text: 'text-blue' },
  implantes: { bg: 'bg-red-light', text: 'text-red' },
  insumos: { bg: 'bg-gold-light', text: 'text-gold-dark' },
  alquiler: { bg: 'bg-purple-light', text: 'text-purple' },
  servicios: { bg: 'bg-amber-light', text: 'text-amber' },
  otros: { bg: 'bg-beige', text: 'text-text-secondary' },
}

interface GastoRow {
  id: string
  fecha: string
  fecha_vencimiento: string | null
  sede_ids: string[]
  concepto: string
  categoria: string
  monto: number
  estado: 'pendiente' | 'pagado'
  pagado_por: string | null
  tipo_pago: string | null
  moneda: string
  monto_original: number | null
  tipo_cambio: number | null
  user_id: string | null
  created_at: string
}

function GastosTab() {
  const { user } = useAuth()
  const supabase = createClient()

  const [gastos, setGastos] = useState<GastoRow[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Filters
  const [mesFilter, setMesFilter] = useState(() => getArgentinaToday().slice(0, 7)) // YYYY-MM
  const [sedeFilter, setSedeFilter] = useState('todas')
  const [catFilter, setCatFilter] = useState('todas')

  // Filters
  const [estadoFilter, setEstadoFilter] = useState('todos')

  // USD
  const { cotizacion, loadingDolar, fetchDolar } = useDolarOficial()

  // Form
  const [form, setForm] = useState({
    fecha: getArgentinaToday(),
    fecha_vencimiento: '',
    sede_ids: [] as string[],
    sedeMode: 'general' as 'general' | 'algunas',
    concepto: '',
    categoria: 'otros',
    monto: '',
    estado: 'pendiente' as string,
    pagado_por: '',
    tipo_pago: 'efectivo' as string,
    moneda: 'ARS' as string,
    monto_usd: '',
    tipo_cambio: '',
  })

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    try {
      const inicioMes = mesFilter + '-01'
      const [y, m] = mesFilter.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const finMes = `${mesFilter}-${String(lastDay).padStart(2, '0')}`

      let query = supabase
        .from('gastos')
        .select('*')
        .gte('fecha', inicioMes)
        .lte('fecha', finMes)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })

      // sede filter is applied client-side to include general gastos (empty sede_ids)
      if (catFilter !== 'todas') query = query.eq('categoria', catFilter)
      if (estadoFilter !== 'todos') query = query.eq('estado', estadoFilter)

      const { data, error } = await query
      if (error) console.error('Error fetching gastos:', error)
      setGastos((data as GastoRow[]) || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFilter, catFilter, estadoFilter])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchGastos() }, [fetchGastos])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.concepto) return

    const isUSD = form.moneda === 'USD'
    let montoARS: number
    let montoOriginal: number | null = null
    let tipoCambio: number | null = null

    if (isUSD) {
      if (!form.monto_usd || !form.tipo_cambio) return
      montoOriginal = parseFloat(form.monto_usd)
      tipoCambio = parseFloat(form.tipo_cambio)
      montoARS = montoOriginal * tipoCambio
    } else {
      if (!form.monto) return
      montoARS = parseFloat(form.monto)
    }

    setSaving(true)
    const sedeIds = form.sedeMode === 'general' ? [] : form.sede_ids
    const { error } = await supabase.from('gastos').insert({
      fecha: form.fecha,
      fecha_vencimiento: form.fecha_vencimiento || null,
      sede_ids: sedeIds,
      concepto: form.concepto.trim(),
      categoria: form.categoria,
      monto: montoARS,
      estado: form.estado,
      tipo: 'variable',
      pagado_por: form.pagado_por.trim() || null,
      tipo_pago: form.tipo_pago,
      moneda: form.moneda,
      monto_original: montoOriginal,
      tipo_cambio: tipoCambio,
      user_id: user?.id,
    })
    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setForm({ ...form, concepto: '', monto: '', monto_usd: '', tipo_cambio: '', pagado_por: '', fecha_vencimiento: '', sede_ids: [], sedeMode: 'general', moneda: 'ARS' })
      setShowForm(false)
      fetchGastos()
    }
    setSaving(false)
  }

  const toggleEstado = async (g: GastoRow) => {
    const newEstado = g.estado === 'pendiente' ? 'pagado' : 'pendiente'
    const { error } = await supabase.from('gastos').update({ estado: newEstado }).eq('id', g.id)
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    fetchGastos()
  }

  const handleDeleteGasto = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    fetchGastos()
  }

  const changeMonth = (offset: number) => {
    const [y, m] = mesFilter.split('-').map(Number)
    const d = new Date(y, m - 1 + offset, 1)
    setMesFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const formatMoney = (n: number) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

  const formatMes = (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${meses[m - 1]} ${y}`
  }

  // Client-side sede filter: include gastos that contain the sede OR are general (empty sede_ids)
  const gastosFiltrados = sedeFilter === 'todas'
    ? gastos
    : gastos.filter(g => {
        const ids = g.sede_ids || []
        return ids.length === 0 || ids.includes(sedeFilter)
      })

  const totalMes = gastosFiltrados.reduce((s, g) => s + Number(g.monto), 0)
  const totalPendiente = gastosFiltrados.filter(g => g.estado === 'pendiente').reduce((s, g) => s + Number(g.monto), 0)
  const totalPagado = gastosFiltrados.filter(g => g.estado === 'pagado').reduce((s, g) => s + Number(g.monto), 0)

  // Group by category for summary
  const porCategoria: Record<string, number> = {}
  gastosFiltrados.forEach(g => {
    porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.monto)
  })
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  // Per-sede totals (proporcional) — always calculated from ALL gastos (not filtered)
  const porSede: Record<string, number> = {}
  gastos.forEach(g => {
    const monto = Number(g.monto)
    const sedeIds = g.sede_ids || []
    if (sedeIds.length === 0) {
      // General: dividir entre todas las sedes
      sedes.forEach(s => {
        porSede[s.id] = (porSede[s.id] || 0) + monto / sedes.length
      })
    } else {
      // Dividir entre las sedes seleccionadas
      sedeIds.forEach((sid: string) => {
        porSede[sid] = (porSede[sid] || 0) + monto / sedeIds.length
      })
    }
  })

  const getSedeLabel = (g: GastoRow): string => {
    const ids = g.sede_ids || []
    if (ids.length === 0) return 'General'
    if (ids.length === sedes.length) return 'Todas'
    return ids.map(id => sedes.find(s => s.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Nuevo Gasto'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Registrar gasto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Descripcion *</label>
              <input
                type="text"
                value={form.concepto}
                onChange={e => setForm({ ...form, concepto: e.target.value })}
                placeholder="Ej: Corona paciente X, Sueldo Rosita..."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Categoria *</label>
              <select
                value={form.categoria}
                onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              >
                {GASTO_CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Moneda</label>
              <select
                value={form.moneda}
                onChange={e => {
                  const moneda = e.target.value
                  setForm({ ...form, moneda, monto: '', monto_usd: '', tipo_cambio: '' })
                  if (moneda === 'USD' && !cotizacion) fetchDolar()
                }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              >
                <option value="ARS">ARS (Pesos)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
            {form.moneda === 'ARS' ? (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Monto *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.monto}
                  onChange={e => setForm({ ...form, monto: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Monto USD *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.monto_usd}
                    onChange={e => {
                      const usd = e.target.value
                      const tc = form.tipo_cambio ? parseFloat(form.tipo_cambio) : 0
                      setForm({ ...form, monto_usd: usd, monto: usd && tc ? String(parseFloat(usd) * tc) : '' })
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Tipo de cambio *
                    {loadingDolar && <span className="ml-1 text-text-muted">(cargando...)</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.tipo_cambio}
                      onChange={e => {
                        const tc = e.target.value
                        const usd = form.monto_usd ? parseFloat(form.monto_usd) : 0
                        setForm({ ...form, tipo_cambio: tc, monto: usd && tc ? String(usd * parseFloat(tc)) : '' })
                      }}
                      placeholder={cotizacion ? `Oficial: $${cotizacion}` : ''}
                      className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
                      required
                    />
                    {cotizacion && (
                      <button
                        type="button"
                        onClick={() => {
                          const usd = form.monto_usd ? parseFloat(form.monto_usd) : 0
                          setForm({ ...form, tipo_cambio: String(cotizacion), monto: usd ? String(usd * cotizacion) : '' })
                        }}
                        className="px-2 py-1 text-xs bg-blue-light text-blue rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        Usar oficial
                      </button>
                    )}
                  </div>
                  {form.monto_usd && form.tipo_cambio && (
                    <p className="text-xs text-text-muted mt-1">
                      = {formatMoney(parseFloat(form.monto_usd) * parseFloat(form.tipo_cambio))}
                    </p>
                  )}
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Medio de pago</label>
              <select
                value={form.tipo_pago}
                onChange={e => setForm({ ...form, tipo_pago: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta_debito">Tarjeta Débito</option>
                <option value="tarjeta_credito">Tarjeta Crédito</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-text-secondary mb-1">Sedes</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={form.sedeMode === 'general'}
                    onChange={() => setForm({ ...form, sedeMode: 'general', sede_ids: [] })}
                    className="accent-green-primary"
                  />
                  <span className="text-text-primary">General (todas)</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={form.sedeMode === 'algunas'}
                    onChange={() => setForm({ ...form, sedeMode: 'algunas' })}
                    className="accent-green-primary"
                  />
                  <span className="text-text-primary">Seleccionar sedes</span>
                </label>
                {form.sedeMode === 'algunas' && (
                  <div className="flex flex-wrap gap-2 ml-2">
                    {sedes.map(s => {
                      const checked = form.sede_ids.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                            checked
                              ? 'bg-green-100 border-green-300 text-green-700'
                              : 'bg-beige border-border text-text-secondary hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const newIds = checked
                                ? form.sede_ids.filter(id => id !== s.id)
                                : [...form.sede_ids, s.id]
                              setForm({ ...form, sede_ids: newIds })
                            }}
                            className="hidden"
                          />
                          {s.nombre}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Pagado por</label>
              <input
                type="text"
                value={form.pagado_por}
                onChange={e => setForm({ ...form, pagado_por: e.target.value })}
                placeholder="Ej: Lean, Ani (opcional)"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Vencimiento</label>
              <input
                type="date"
                value={form.fecha_vencimiento}
                onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text-primary focus:outline-none focus:border-green-primary"
              >
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {/* Month nav + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronLeft size={18} className="text-text-secondary" />
          </button>
          <span className="text-sm font-medium text-text-primary px-2 min-w-[140px] text-center">
            {formatMes(mesFilter)}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 hover:bg-beige rounded transition-colors">
            <ChevronRight size={18} className="text-text-secondary" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Filter size={14} className="text-text-muted" />
          <select
            value={sedeFilter}
            onChange={e => setSedeFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las categorias</option>
            {GASTO_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-surface rounded-lg border border-border px-4 py-3">
          <p className="text-xs text-text-muted font-medium">Total del mes</p>
          <p className="text-xl font-semibold text-red">{formatMoney(totalMes)}</p>
          <p className="text-xs text-text-muted">{gastos.length} gastos</p>
        </div>
        <div className="bg-surface rounded-lg border border-border px-4 py-3">
          <p className="text-xs text-text-muted font-medium">Pagado</p>
          <p className="text-lg font-semibold text-green-700">{formatMoney(totalPagado)}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border px-4 py-3">
          <p className="text-xs text-text-muted font-medium">Pendiente</p>
          <p className="text-lg font-semibold text-amber-600">{formatMoney(totalPendiente)}</p>
        </div>
        {categoriasOrdenadas.slice(0, 4).map(([cat, monto]) => {
          const catInfo = GASTO_CATEGORIAS.find(c => c.value === cat)
          const colors = CATEGORIA_COLORS[cat] || CATEGORIA_COLORS.otros
          return (
            <div key={cat} className="bg-surface rounded-lg border border-border px-4 py-3">
              <p className="text-xs text-text-muted font-medium">{catInfo?.label || cat}</p>
              <p className={`text-lg font-semibold ${colors.text}`}>{formatMoney(monto)}</p>
            </div>
          )
        })}
      </div>

      {/* Per-sede breakdown */}
      {gastos.length > 0 && sedes.length > 0 && (
        <div className="bg-surface rounded-xl border border-border p-4 mb-6">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Gasto por sede (proporcional)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sedes.map(s => {
              const total = porSede[s.id] || 0
              return (
                <button
                  key={s.id}
                  onClick={() => setSedeFilter(sedeFilter === s.id ? 'todas' : s.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-all ${
                    sedeFilter === s.id
                      ? 'bg-green-50 border-green-200 ring-2 ring-green-primary/20'
                      : 'border-border hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs text-text-muted truncate">{s.nombre}</p>
                  <p className="text-sm font-semibold text-text-primary">{formatMoney(total)}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando gastos...</div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            No hay gastos registrados en {formatMes(mesFilter)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Descripcion</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Sedes</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Medio</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Monto</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Vence</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden xl:table-cell">Pagado por</th>
                  <th className="text-center px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map(g => {
                  const colors = CATEGORIA_COLORS[g.categoria] || CATEGORIA_COLORS.otros
                  const catLabel = GASTO_CATEGORIAS.find(c => c.value === g.categoria)?.label || g.categoria
                  const sedeLabel = getSedeLabel(g)
                  const sedeIds = g.sede_ids || []
                  const cantSedes = sedeIds.length === 0 ? sedes.length : sedeIds.length
                  const [, m, d] = g.fecha.split('-')
                  return (
                    <tr key={g.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                      <td className="px-4 py-3 text-text-primary whitespace-nowrap">{d}/{m}</td>
                      <td className="px-4 py-3 text-text-primary max-w-[250px] truncate">{g.concepto}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {catLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-text-secondary text-xs">{sedeLabel}</span>
                        {cantSedes > 1 && (
                          <span className="text-text-muted text-[10px] ml-1">
                            ({formatMoney(Number(g.monto) / cantSedes)} c/u)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {g.tipo_pago && TIPO_PAGO_LABELS[g.tipo_pago] ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_PAGO_LABELS[g.tipo_pago].bg} ${TIPO_PAGO_LABELS[g.tipo_pago].text}`}>
                            {TIPO_PAGO_LABELS[g.tipo_pago].label}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary whitespace-nowrap">
                        {formatMoney(Number(g.monto))}
                        {g.moneda === 'USD' && g.monto_original && (
                          <span className="block text-[10px] text-blue font-medium">
                            US$ {Number(g.monto_original).toLocaleString('es-AR')} @ ${Number(g.tipo_cambio).toLocaleString('es-AR')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleEstado(g)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            g.estado === 'pagado'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                          title="Click para cambiar estado"
                        >
                          {g.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs hidden lg:table-cell whitespace-nowrap">
                        {g.fecha_vencimiento ? (() => { const [, vm, vd] = g.fecha_vencimiento!.split('-'); return `${vd}/${vm}` })() : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs hidden xl:table-cell">{g.pagado_por || '\u2014'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteGasto(g.id)}
                          className="text-text-muted hover:text-red transition-colors"
                          title="Eliminar"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && gastosFiltrados.length > 0 && (
        <p className="text-xs text-text-muted mt-3">
          {gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''} · Total: {formatMoney(totalMes)}
        </p>
      )}
    </div>
  )
}
