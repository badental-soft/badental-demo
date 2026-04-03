'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import type { Sede, ProductoStock, MovimientoStock } from '@/types/database'
import { getArgentinaToday } from '@/lib/utils/dates'
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  Building2,
  Filter,
  Search,
  X,
  Loader2,
  Settings,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────

interface StockPorSedeProducto {
  producto: ProductoStock
  sede: Sede
  cantidad: number
}

type ViewTab = 'resumen' | 'movimientos' | 'productos'

// ── Main Component ───────────────────────────────────

export default function StockModule() {
  const { user } = useAuth()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<ViewTab>('resumen')
  const [sedes, setSedes] = useState<Sede[]>([])
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [todosProductos, setTodosProductos] = useState<ProductoStock[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([])
  const [stockMap, setStockMap] = useState<StockPorSedeProducto[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [productoFilter, setProductoFilter] = useState<string>('todos')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'entrada' | 'salida'>('entrada')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sedesRes, productosRes, movRes] = await Promise.all([
        supabase.from('sedes').select('*').eq('activa', true).order('nombre'),
        supabase.from('stock_productos').select('*').order('nombre'),
        supabase.from('stock_movimientos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      ])

      if (sedesRes.error) console.error('Error sedes:', sedesRes.error)
      if (productosRes.error) console.error('Error productos:', productosRes.error)
      if (movRes.error) console.error('Error movimientos:', movRes.error)

      const sedesData = (sedesRes.data || []) as Sede[]
      const allProductos = (productosRes.data || []) as ProductoStock[]
      const activeProductos = allProductos.filter(p => p.activo)
      const movData = (movRes.data || []) as MovimientoStock[]

      setSedes(sedesData)
      setProductos(activeProductos)
      setTodosProductos(allProductos)
      setMovimientos(movData)

      // Calculate stock per product per sede
      const map: Record<string, StockPorSedeProducto> = {}
      sedesData.forEach(sede => {
        activeProductos.forEach(prod => {
          const key = `${prod.id}-${sede.id}`
          map[key] = { producto: prod, sede, cantidad: 0 }
        })
      })

      movData.forEach(mov => {
        const key = `${mov.producto_id}-${mov.sede_id}`
        if (map[key]) {
          if (mov.tipo === 'entrada') {
            map[key].cantidad += mov.cantidad
          } else {
            map[key].cantidad -= mov.cantidad
          }
        }
      })

      setStockMap(Object.values(map))
    } catch (err) {
      console.error('Error fetching stock data:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (type: 'entrada' | 'salida') => {
    setModalType(type)
    setShowModal(true)
  }

  const isAdmin = user?.rol === 'admin'
  const canManage = isAdmin // solo admin puede gestionar productos y entradas
  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'resumen', label: 'Stock Actual' },
    { id: 'movimientos', label: 'Movimientos' },
    ...(canManage ? [{ id: 'productos' as ViewTab, label: 'Productos' }] : []),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Cargando stock...
      </div>
    )
  }

  return (
    <div>
      {/* Header: actions */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => openModal('entrada')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-primary text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-dark transition-colors whitespace-nowrap"
            >
              <Plus size={14} /> Entrada
            </button>
          )}
          <button
            onClick={() => openModal('salida')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red text-white rounded-lg text-xs sm:text-sm font-medium hover:opacity-90 transition-colors whitespace-nowrap"
          >
            <Minus size={14} /> Salida
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 max-w-full overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'productos' && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            value={sedeFilter}
            onChange={e => setSedeFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select
            value={productoFilter}
            onChange={e => setProductoFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todos">Todos los productos</option>
            {productos.map(p => <option key={p.id} value={p.id}>{prodLabel(p)}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      {activeTab === 'resumen' && (
        <StockResumen
          stockMap={stockMap}
          sedes={sedes}
          productos={productos}
          sedeFilter={sedeFilter}
          setSedeFilter={setSedeFilter}
          productoFilter={productoFilter}
          setProductoFilter={setProductoFilter}
        />
      )}
      {activeTab === 'movimientos' && (
        <MovimientosView
          movimientos={movimientos}
          sedes={sedes}
          productos={productos}
          sedeFilter={sedeFilter}
          setSedeFilter={setSedeFilter}
          productoFilter={productoFilter}
          setProductoFilter={setProductoFilter}
        />
      )}
      {activeTab === 'productos' && canManage && (
        <ProductosView
          productos={todosProductos}
          onRefresh={fetchData}
        />
      )}

      {/* Modal */}
      {showModal && (
        <MovimientoModal
          type={modalType}
          sedes={sedes}
          productos={productos}
          userId={user?.id || ''}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

// ── Stock Resumen ────────────────────────────────────

function StockResumen({
  stockMap, sedes, productos, sedeFilter, setSedeFilter, productoFilter, setProductoFilter,
}: {
  stockMap: StockPorSedeProducto[]
  sedes: Sede[]
  productos: ProductoStock[]
  sedeFilter: string
  setSedeFilter: (v: string) => void
  productoFilter: string
  setProductoFilter: (v: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')

  const filtered = stockMap.filter(s => {
    if (sedeFilter !== 'todas' && s.sede.id !== sedeFilter) return false
    if (productoFilter !== 'todos' && s.producto.id !== productoFilter) return false
    if (busqueda && !prodLabel(s.producto).toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  // Alerts (compact, inline)
  const alerts = stockMap.filter(s => s.cantidad <= s.producto.stock_minimo)

  // Totals per product (across all sedes)
  const totalsPorProducto: Record<string, { nombre: string; total: number; minimo: number }> = {}
  stockMap.forEach(s => {
    if (!totalsPorProducto[s.producto.id]) {
      totalsPorProducto[s.producto.id] = { nombre: prodLabel(s.producto), total: 0, minimo: s.producto.stock_minimo }
    }
    totalsPorProducto[s.producto.id].total += s.cantidad
  })

  // Sort: by sede name, then product name
  const sorted = [...filtered].sort((a, b) => {
    const sedeCompare = a.sede.nombre.localeCompare(b.sede.nombre)
    if (sedeCompare !== 0) return sedeCompare
    return a.producto.nombre.localeCompare(b.producto.nombre)
  })

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {Object.keys(totalsPorProducto).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.values(totalsPorProducto).map(t => (
            <div key={t.nombre} className="bg-surface rounded-lg border border-border px-4 py-3 flex items-center gap-3">
              <Package size={16} className="text-text-muted" />
              <div>
                <p className="text-xs text-text-muted font-medium">{t.nombre}</p>
                <p className={`text-lg font-semibold ${t.total <= 0 ? 'text-red' : t.total <= t.minimo * sedes.length ? 'text-amber' : 'text-green-primary'}`}>
                  {t.total} <span className="text-xs font-normal text-text-muted">total</span>
                </p>
              </div>
            </div>
          ))}
          {alerts.length > 0 && (
            <div className="bg-red-light rounded-lg border border-red/20 px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red" />
              <div>
                <p className="text-xs text-text-muted font-medium">Alertas</p>
                <p className="text-lg font-semibold text-red">{alerts.length}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="text-sm border border-border rounded-lg pl-8 pr-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-beige">
                <th className="text-left px-4 py-3 font-medium text-text-muted">Sede</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Producto</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Min</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    No hay datos de stock. Registra movimientos de entrada para comenzar.
                  </td>
                </tr>
              ) : (
                sorted.map(item => {
                  const isLow = item.cantidad <= item.producto.stock_minimo && item.cantidad > 0
                  const isOut = item.cantidad <= 0
                  return (
                    <tr
                      key={`${item.producto.id}-${item.sede.id}`}
                      className={`border-b border-border last:border-0 ${
                        isOut ? 'bg-red-light/50' : isLow ? 'bg-amber-light/50' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-text-primary">
                        <span className="flex items-center gap-2">
                          <Building2 size={14} className="text-text-muted flex-shrink-0" />
                          {item.sede.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">
                        <span className="flex items-center gap-2">
                          <Package size={14} className="text-text-muted flex-shrink-0" />
                          {prodLabel(item.producto)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-lg font-semibold ${
                          isOut ? 'text-red' : isLow ? 'text-amber' : 'text-green-primary'
                        }`}>
                          {item.cantidad}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-text-muted">
                        {item.producto.stock_minimo}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-light text-red">
                            <AlertTriangle size={11} /> Sin stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-light text-amber">
                            <AlertTriangle size={11} /> Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-light text-green-primary">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Movimientos View ─────────────────────────────────

function MovimientosView({
  movimientos, sedes, productos, sedeFilter, setSedeFilter, productoFilter, setProductoFilter,
}: {
  movimientos: MovimientoStock[]
  sedes: Sede[]
  productos: ProductoStock[]
  sedeFilter: string
  setSedeFilter: (v: string) => void
  productoFilter: string
  setProductoFilter: (v: string) => void
}) {
  const filtered = movimientos.filter(m => {
    if (sedeFilter !== 'todas' && m.sede_id !== sedeFilter) return false
    if (productoFilter !== 'todos' && m.producto_id !== productoFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-beige">
                <th className="text-left px-4 py-3 font-medium text-text-muted">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Sede</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Tipo</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">Cantidad</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Descripcion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No hay movimientos registrados.
                  </td>
                </tr>
              ) : (
                filtered.map(mov => {
                  const prod = productos.find(p => p.id === mov.producto_id)
                  const sede = sedes.find(s => s.id === mov.sede_id)
                  return (
                    <tr key={mov.id} className="border-b border-border last:border-0 hover:bg-beige/50">
                      <td className="px-4 py-3 text-text-primary whitespace-nowrap">
                        {formatDate(mov.fecha)}
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {prod ? prodLabel(prod) : '-'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {sede?.nombre || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          mov.tipo === 'entrada'
                            ? 'bg-green-light text-green-primary'
                            : 'bg-red-light text-red'
                        }`}>
                          {mov.tipo === 'entrada' ? <Plus size={12} /> : <Minus size={12} />}
                          {mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-text-primary">
                        {mov.cantidad}
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs max-w-[200px] truncate">
                        {mov.descripcion || '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Productos View (CRUD) ────────────────────────────

function ProductosView({ productos, onRefresh }: { productos: ProductoStock[]; onRefresh: () => void }) {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [medida, setMedida] = useState('')
  const [unidad, setUnidad] = useState('unidades')
  const [stockMinimo, setStockMinimo] = useState(3)
  const [precioCompra, setPrecioCompra] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!nombre.trim()) return
    setError('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('stock_productos').insert({
        nombre: nombre.trim(),
        medida: medida.trim() || null,
        unidad,
        stock_minimo: stockMinimo,
        precio_compra: precioCompra ? Number(precioCompra) : null,
      })
      if (insertError) {
        if (insertError.code === '23505') {
          setError(`Ya existe "${nombre.trim()}${medida.trim() ? ' ' + medida.trim() : ''}"`)
        } else {
          setError(insertError.message)
        }
        return
      }
      setNombre('')
      setMedida('')
      setUnidad('unidades')
      setStockMinimo(3)
      setPrecioCompra('')
      setShowForm(false)
      onRefresh()
    } catch (err) {
      console.error('Error adding product:', err)
      setError('Error inesperado al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (prod: ProductoStock) => {
    const { error: updateError } = await supabase.from('stock_productos').update({ activo: !prod.activo }).eq('id', prod.id)
    if (updateError) {
      console.error('Error toggling product:', updateError)
      return
    }
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Settings size={16} className="text-text-muted" />
          Administrar Productos
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-dark transition-colors"
        >
          <Plus size={14} /> Nuevo Producto
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Nombre</label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Biofix"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Medida (opcional)</label>
              <input
                value={medida}
                onChange={e => setMedida(e.target.value)}
                placeholder="Ej: 3.5x10"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Unidad</label>
              <input
                value={unidad}
                onChange={e => setUnidad(e.target.value)}
                placeholder="unidades"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Stock minimo</label>
              <input
                type="number"
                value={stockMinimo}
                onChange={e => setStockMinimo(Number(e.target.value))}
                min={0}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Precio compra ($)</label>
              <input
                type="number"
                value={precioCompra}
                onChange={e => setPrecioCompra(e.target.value)}
                placeholder="Opcional"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !nombre.trim()}
              className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-beige transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-beige">
              <th className="text-left px-4 py-3 font-medium text-text-muted">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-text-muted">Medida</th>
              <th className="text-left px-4 py-3 font-medium text-text-muted">Unidad</th>
              <th className="text-center px-4 py-3 font-medium text-text-muted">Stock Min</th>
              <th className="text-right px-4 py-3 font-medium text-text-muted">Precio Compra</th>
              <th className="text-center px-4 py-3 font-medium text-text-muted">Estado</th>
            </tr>
          </thead>
          <tbody>
            {productos.map(prod => (
              <tr key={prod.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-text-primary">{prod.nombre}</td>
                <td className="px-4 py-3 text-text-secondary">{prod.medida || '-'}</td>
                <td className="px-4 py-3 text-text-secondary">{prod.unidad}</td>
                <td className="px-4 py-3 text-center text-text-primary">{prod.stock_minimo}</td>
                <td className="px-4 py-3 text-right text-text-primary">
                  {prod.precio_compra ? `$${Number(prod.precio_compra).toLocaleString('es-AR')}` : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(prod)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      prod.activo ? 'bg-green-light text-green-primary' : 'bg-red-light text-red'
                    }`}
                  >
                    {prod.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Movement Modal ───────────────────────────────────

function MovimientoModal({
  type, sedes, productos, userId, onClose, onSaved,
}: {
  type: 'entrada' | 'salida'
  sedes: Sede[]
  productos: ProductoStock[]
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  const [sedeId, setSedeId] = useState(sedes[0]?.id || '')
  const [cantidad, setCantidad] = useState(1)
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(getArgentinaToday())
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!productoId || !sedeId || cantidad <= 0) return
    setError('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('stock_movimientos').insert({
        producto_id: productoId,
        sede_id: sedeId,
        tipo: type,
        cantidad,
        descripcion: descripcion.trim() || null,
        fecha,
        created_by: userId,
      })
      if (insertError) {
        setError(insertError.message)
        return
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Error saving movimiento:', err)
      setError('Error inesperado al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-border shadow-lg w-full max-w-md mx-4 sm:mx-0">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            {type === 'entrada' ? (
              <><Plus size={18} className="text-green-primary" /> Registrar Entrada</>
            ) : (
              <><Minus size={18} className="text-red" /> Registrar Salida</>
            )}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Producto</label>
            <select
              value={productoId}
              onChange={e => setProductoId(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
            >
              {productos.map(p => <option key={p.id} value={p.id}>{prodLabel(p)}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Sede</label>
            <select
              value={sedeId}
              onChange={e => setSedeId(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
            >
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Cantidad</label>
              <input
                type="number"
                value={cantidad}
                onChange={e => setCantidad(Number(e.target.value))}
                min={1}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full min-w-0 text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Descripcion (opcional)</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Compra proveedor X, Uso en paciente..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
            />
          </div>
          {error && <p className="text-sm text-red">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-beige transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !productoId || !sedeId || cantidad <= 0}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              type === 'entrada'
                ? 'bg-green-primary hover:bg-green-dark'
                : 'bg-red hover:opacity-90'
            }`}
          >
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function prodLabel(p: ProductoStock): string {
  return p.medida ? `${p.nombre} ${p.medida}` : p.nombre
}
