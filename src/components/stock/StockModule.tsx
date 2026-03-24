'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import type { Sede, ProductoStock, MovimientoStock } from '@/types/database'
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  Building2,
  Filter,
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

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'resumen', label: 'Stock Actual' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'productos', label: 'Productos' },
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
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => openModal('entrada')}
          className="flex items-center gap-2 px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-dark transition-colors"
        >
          <Plus size={16} /> Entrada
        </button>
        <button
          onClick={() => openModal('salida')}
          className="flex items-center gap-2 px-4 py-2 bg-red text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
        >
          <Minus size={16} /> Salida
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
      {activeTab === 'productos' && (
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
  const filtered = stockMap.filter(s => {
    if (sedeFilter !== 'todas' && s.sede.id !== sedeFilter) return false
    if (productoFilter !== 'todos' && s.producto.id !== productoFilter) return false
    return true
  })

  // Group by sede
  const bySede: Record<string, StockPorSedeProducto[]> = {}
  filtered.forEach(s => {
    if (!bySede[s.sede.id]) bySede[s.sede.id] = []
    bySede[s.sede.id].push(s)
  })

  // Alerts
  const lowStock = stockMap.filter(s => s.cantidad <= s.producto.stock_minimo && s.cantidad > 0)
  const outOfStock = stockMap.filter(s => s.cantidad <= 0)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <select
            value={sedeFilter}
            onChange={e => setSedeFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <select
          value={productoFilter}
          onChange={e => setProductoFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
        >
          <option value="todos">Todos los productos</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Alerts */}
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="space-y-2">
          {outOfStock.map(s => (
            <div key={`out-${s.producto.id}-${s.sede.id}`} className="flex items-center gap-2 px-4 py-2 bg-red-light rounded-lg text-sm">
              <AlertTriangle size={14} className="text-red flex-shrink-0" />
              <span className="text-red font-medium">Sin stock:</span>
              <span className="text-text-primary">{s.producto.nombre} en {s.sede.nombre}</span>
            </div>
          ))}
          {lowStock.map(s => (
            <div key={`low-${s.producto.id}-${s.sede.id}`} className="flex items-center gap-2 px-4 py-2 bg-amber-light rounded-lg text-sm">
              <AlertTriangle size={14} className="text-amber flex-shrink-0" />
              <span className="text-amber font-medium">Stock bajo ({s.cantidad}):</span>
              <span className="text-text-primary">{s.producto.nombre} en {s.sede.nombre} (min: {s.producto.stock_minimo})</span>
            </div>
          ))}
        </div>
      )}

      {/* Cards by sede */}
      {Object.entries(bySede).map(([sedeId, items]) => {
        const sede = sedes.find(s => s.id === sedeId)
        if (!sede) return null
        return (
          <div key={sedeId} className="bg-surface rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-text-muted" />
              {sede.nombre}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(item => {
                const isLow = item.cantidad <= item.producto.stock_minimo && item.cantidad > 0
                const isOut = item.cantidad <= 0
                return (
                  <div
                    key={`${item.producto.id}-${item.sede.id}`}
                    className={`p-3 rounded-lg border ${
                      isOut ? 'border-red bg-red-light' : isLow ? 'border-amber bg-amber-light' : 'border-border bg-beige'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={14} className={isOut ? 'text-red' : isLow ? 'text-amber' : 'text-text-muted'} />
                      <span className="text-sm font-medium text-text-primary">{item.producto.nombre}</span>
                    </div>
                    <p className={`text-2xl font-semibold ${
                      isOut ? 'text-red' : isLow ? 'text-amber' : 'text-green-primary'
                    }`}>
                      {item.cantidad}
                    </p>
                    <p className="text-xs text-text-muted">{item.producto.unidad}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {Object.keys(bySede).length === 0 && (
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted text-sm">
          No hay datos de stock. Registra movimientos de entrada para comenzar.
        </div>
      )}
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <select
            value={sedeFilter}
            onChange={e => setSedeFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <select
          value={productoFilter}
          onChange={e => setProductoFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
        >
          <option value="todos">Todos los productos</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

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
                        {prod?.nombre || '-'}
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
        unidad,
        stock_minimo: stockMinimo,
        precio_compra: precioCompra ? Number(precioCompra) : null,
      })
      if (insertError) {
        if (insertError.code === '23505') {
          setError(`Ya existe un producto con el nombre "${nombre.trim()}"`)
        } else {
          setError(insertError.message)
        }
        return
      }
      setNombre('')
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
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
      <div className="bg-white rounded-xl border border-border shadow-lg w-full max-w-md">
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
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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

          <div className="grid grid-cols-2 gap-3">
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
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white text-text-primary focus:outline-none focus:border-green-primary"
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
