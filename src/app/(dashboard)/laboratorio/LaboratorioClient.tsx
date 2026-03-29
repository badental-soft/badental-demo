'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  FlaskConical,
  Plus,
  X,
  ChevronRight,
  Filter,
  ScanLine,
  Send,
  Cog,
  PackageCheck,
  CircleCheck,
  AlertTriangle,
  Clock,
  History,
  MapPin,
} from 'lucide-react'
import type { EstadoLaboratorio, LaboratorioCaso, LaboratorioHistorial, Sede } from '@/types/database'

// Config de estados
const ESTADOS: { id: EstadoLaboratorio; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { id: 'escaneado', label: 'Escaneados', icon: <ScanLine size={18} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { id: 'enviada', label: 'Enviadas', icon: <Send size={18} />, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { id: 'en_proceso', label: 'En Proceso', icon: <Cog size={18} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { id: 'retirada', label: 'Retiradas', icon: <PackageCheck size={18} />, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { id: 'colocada', label: 'Colocadas', icon: <CircleCheck size={18} />, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  { id: 'a_revisar', label: 'A Revisar', icon: <AlertTriangle size={18} />, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
]

const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.id, e]))

// Orden de avance
const ESTADO_ORDER: EstadoLaboratorio[] = ['escaneado', 'enviada', 'en_proceso', 'retirada', 'colocada']

function nextEstado(current: EstadoLaboratorio): EstadoLaboratorio | null {
  const idx = ESTADO_ORDER.indexOf(current)
  if (idx === -1 || idx >= ESTADO_ORDER.length - 1) return null
  return ESTADO_ORDER[idx + 1]
}

export default function LaboratorioClient() {
  const { user } = useAuth()
  const supabase = createClient()
  const [casos, setCasos] = useState<LaboratorioCaso[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<EstadoLaboratorio | 'todos'>('todos')
  const [filtroSede, setFiltroSede] = useState('todas')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [historialCaso, setHistorialCaso] = useState<LaboratorioCaso | null>(null)
  const [historial, setHistorial] = useState<LaboratorioHistorial[]>([])
  const [editingCaso, setEditingCaso] = useState<LaboratorioCaso | null>(null)

  const fetchCasos = useCallback(async () => {
    try {
      let query = supabase
        .from('laboratorio_casos')
        .select('*, sede:sedes(nombre)')
        .order('updated_at', { ascending: false })

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }
      if (filtroSede !== 'todas') {
        query = query.eq('sede_id', filtroSede)
      }

      const { data, error } = await query
      if (error) {
        console.error('Error fetching casos:', error)
        return
      }
      setCasos((data || []) as unknown as LaboratorioCaso[])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, filtroSede])

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data as unknown as Sede[])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchCasos() }, [fetchCasos])

  // Conteos por estado (sobre todos los casos, no filtrados)
  const [conteos, setConteos] = useState<Record<string, number>>({})
  const fetchConteos = useCallback(async () => {
    const { data } = await supabase.from('laboratorio_casos').select('estado')
    if (data) {
      const counts: Record<string, number> = {}
      ;(data as unknown as { estado: string }[]).forEach(d => {
        counts[d.estado] = (counts[d.estado] || 0) + 1
      })
      setConteos(counts)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { fetchConteos() }, [fetchConteos])

  const handleAdvanceEstado = async (caso: LaboratorioCaso) => {
    const next = nextEstado(caso.estado)
    if (!next) return
    await changeEstado(caso, next)
  }

  const handleSetRevisar = async (caso: LaboratorioCaso) => {
    await changeEstado(caso, 'a_revisar')
  }

  const changeEstado = async (caso: LaboratorioCaso, nuevoEstado: EstadoLaboratorio) => {
    // Insert historial
    const { error: histError } = await supabase.from('laboratorio_historial').insert({
      caso_id: caso.id,
      estado_anterior: caso.estado,
      estado_nuevo: nuevoEstado,
      user_id: user?.id || null,
    })
    if (histError) {
      console.error('Error inserting historial:', histError)
      return
    }

    // Update caso
    const { error } = await supabase
      .from('laboratorio_casos')
      .update({ estado: nuevoEstado })
      .eq('id', caso.id)
    if (error) {
      console.error('Error updating estado:', error)
      return
    }

    fetchCasos()
    fetchConteos()
  }

  const handleCreate = async (form: { paciente: string; sede_id: string; profesional: string; tipo: string; laboratorio: string; notas: string }) => {
    const { error } = await supabase.from('laboratorio_casos').insert({
      paciente: form.paciente.trim(),
      sede_id: form.sede_id || null,
      profesional: form.profesional.trim() || null,
      tipo: form.tipo || 'corona',
      laboratorio: form.laboratorio.trim() || null,
      notas: form.notas.trim() || null,
      estado: 'escaneado',
      created_by: user?.id || null,
    })
    if (error) {
      console.error('Error creating caso:', error)
      return false
    }

    // Insert initial historial
    // We need the ID — fetch it
    const { data: newCaso } = await supabase
      .from('laboratorio_casos')
      .select('id')
      .eq('paciente', form.paciente.trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (newCaso) {
      await supabase.from('laboratorio_historial').insert({
        caso_id: (newCaso as unknown as { id: string }).id,
        estado_anterior: null,
        estado_nuevo: 'escaneado',
        user_id: user?.id || null,
      })
    }

    setShowCreateModal(false)
    fetchCasos()
    fetchConteos()
    return true
  }

  const handleUpdate = async (id: string, form: { paciente: string; sede_id: string; profesional: string; tipo: string; laboratorio: string; notas: string }) => {
    const { error } = await supabase
      .from('laboratorio_casos')
      .update({
        paciente: form.paciente.trim(),
        sede_id: form.sede_id || null,
        profesional: form.profesional.trim() || null,
        tipo: form.tipo || 'corona',
        laboratorio: form.laboratorio.trim() || null,
        notas: form.notas.trim() || null,
      })
      .eq('id', id)
    if (error) {
      console.error('Error updating caso:', error)
      return false
    }
    setEditingCaso(null)
    fetchCasos()
    return true
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('laboratorio_casos').delete().eq('id', id)
    if (error) {
      console.error('Error deleting caso:', error)
      return
    }
    setEditingCaso(null)
    fetchCasos()
    fetchConteos()
  }

  const fetchHistorial = async (caso: LaboratorioCaso) => {
    setHistorialCaso(caso)
    const { data } = await supabase
      .from('laboratorio_historial')
      .select('*')
      .eq('caso_id', caso.id)
      .order('created_at', { ascending: false })
    setHistorial((data || []) as unknown as LaboratorioHistorial[])
  }

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const formatDateShort = (d: string) => {
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Laboratorio</h1>
          <p className="text-sm text-text-secondary">Seguimiento de coronas y prótesis</p>
        </div>
        <div className="flex items-center gap-3">
          <Filter size={14} className="text-text-muted" />
          <select
            value={filtroSede}
            onChange={e => setFiltroSede(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <Plus size={16} />
            Nuevo caso
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {ESTADOS.map(est => {
          const count = conteos[est.id] || 0
          const isActive = filtroEstado === est.id
          return (
            <button
              key={est.id}
              onClick={() => setFiltroEstado(isActive ? 'todos' : est.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                isActive ? `${est.bg} ring-2 ring-offset-1 ring-current ${est.color}` : 'bg-surface border-border hover:border-gray-300'
              }`}
            >
              <div className={`flex items-center gap-2 mb-1 ${isActive ? est.color : 'text-text-muted'}`}>
                {est.icon}
                <span className="text-lg font-bold">{count}</span>
              </div>
              <p className={`text-xs font-medium ${isActive ? est.color : 'text-text-secondary'}`}>{est.label}</p>
            </button>
          )
        })}
      </div>

      {/* Active filters info */}
      <div className="flex items-center gap-3 mb-4">
        {filtroEstado !== 'todos' && (
          <button
            onClick={() => setFiltroEstado('todos')}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary bg-gray-100 rounded-md"
          >
            <X size={12} /> Limpiar estado
          </button>
        )}
        <span className="text-xs text-text-muted ml-auto">{casos.length} caso{casos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Cargando casos...</div>
        ) : casos.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            {filtroEstado !== 'todos' || filtroSede !== 'todas'
              ? 'No hay casos con estos filtros'
              : 'No hay casos registrados. Creá el primero.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Sede</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Laboratorio</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Últ. cambio</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {casos.map(caso => {
                  const est = ESTADO_MAP[caso.estado]
                  const next = nextEstado(caso.estado)
                  const nextEst = next ? ESTADO_MAP[next] : null
                  return (
                    <tr key={caso.id} className="border-b border-border last:border-0 hover:bg-beige/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{caso.paciente}</div>
                        {caso.profesional && <div className="text-xs text-text-muted">{caso.profesional}</div>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary capitalize">{caso.tipo}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {caso.sede?.nombre ? (
                          <span className="flex items-center gap-1"><MapPin size={12} className="text-text-muted" />{caso.sede.nombre}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{caso.laboratorio || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${est?.bg} ${est?.color}`}>
                          {est?.icon}
                          {est?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">
                        <span className="flex items-center gap-1"><Clock size={12} />{formatDateShort(caso.updated_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Avanzar estado */}
                          {nextEst && (
                            <button
                              onClick={() => handleAdvanceEstado(caso)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${nextEst.color} hover:${nextEst.bg} bg-gray-50 hover:bg-opacity-80`}
                              title={`Avanzar a ${nextEst.label}`}
                            >
                              <ChevronRight size={14} />
                              {nextEst.label}
                            </button>
                          )}
                          {/* A Revisar */}
                          {caso.estado !== 'a_revisar' && caso.estado !== 'colocada' && (
                            <button
                              onClick={() => handleSetRevisar(caso)}
                              className="p-1.5 rounded-md text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Marcar a revisar"
                            >
                              <AlertTriangle size={15} />
                            </button>
                          )}
                          {/* Historial */}
                          <button
                            onClick={() => fetchHistorial(caso)}
                            className="p-1.5 rounded-md text-text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Ver historial"
                          >
                            <History size={15} />
                          </button>
                          {/* Editar */}
                          <button
                            onClick={() => setEditingCaso(caso)}
                            className="p-1.5 rounded-md text-text-muted hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Editar"
                          >
                            <FlaskConical size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CasoFormModal
          title="Nuevo caso"
          sedes={sedes}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(form) => handleCreate(form)}
        />
      )}

      {/* Edit Modal */}
      {editingCaso && (
        <CasoFormModal
          title="Editar caso"
          sedes={sedes}
          initial={editingCaso}
          onClose={() => setEditingCaso(null)}
          onSubmit={(form) => handleUpdate(editingCaso.id, form)}
          onDelete={() => handleDelete(editingCaso.id)}
        />
      )}

      {/* Historial Modal */}
      {historialCaso && (
        <HistorialModal
          caso={historialCaso}
          historial={historial}
          formatDate={formatDate}
          onClose={() => setHistorialCaso(null)}
        />
      )}
    </div>
  )
}

// --- Form Modal ---
function CasoFormModal({ title, sedes, initial, onClose, onSubmit, onDelete }: {
  title: string
  sedes: Sede[]
  initial?: LaboratorioCaso
  onClose: () => void
  onSubmit: (form: { paciente: string; sede_id: string; profesional: string; tipo: string; laboratorio: string; notas: string }) => Promise<boolean>
  onDelete?: () => void
}) {
  const [form, setForm] = useState({
    paciente: initial?.paciente || '',
    sede_id: initial?.sede_id || '',
    profesional: initial?.profesional || '',
    tipo: initial?.tipo || 'corona',
    laboratorio: initial?.laboratorio || '',
    notas: initial?.notas || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <FlaskConical size={20} />
        {title}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Paciente *</label>
          <input
            type="text"
            required
            value={form.paciente}
            onChange={e => setForm({ ...form, paciente: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            placeholder="Nombre del paciente"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            >
              <option value="corona">Corona</option>
              <option value="protesis">Prótesis</option>
              <option value="carilla">Carilla</option>
              <option value="incrustacion">Incrustación</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Sede</label>
            <select
              value={form.sede_id}
              onChange={e => setForm({ ...form, sede_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            >
              <option value="">Sin sede</option>
              {sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Profesional</label>
            <input
              type="text"
              value={form.profesional}
              onChange={e => setForm({ ...form, profesional: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
              placeholder="Dentista"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Laboratorio</label>
            <input
              type="text"
              value={form.laboratorio}
              onChange={e => setForm({ ...form, laboratorio: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
              placeholder="Nombre del lab"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Notas</label>
          <textarea
            value={form.notas}
            onChange={e => setForm({ ...form, notas: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none resize-none"
            placeholder="Observaciones opcionales"
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Eliminar caso
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : initial ? 'Guardar' : 'Crear caso'}
            </button>
          </div>
        </div>
      </form>
    </ModalOverlay>
  )
}

// --- Historial Modal ---
function HistorialModal({ caso, historial, formatDate, onClose }: {
  caso: LaboratorioCaso
  historial: LaboratorioHistorial[]
  formatDate: (d: string) => string
  onClose: () => void
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-1 flex items-center gap-2">
        <History size={20} />
        Historial
      </h2>
      <p className="text-sm text-text-secondary mb-4">{caso.paciente} — {caso.tipo}</p>

      {historial.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">Sin registros de cambios</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {historial.map(h => {
            const newEst = ESTADO_MAP[h.estado_nuevo]
            const oldEst = h.estado_anterior ? ESTADO_MAP[h.estado_anterior] : null
            return (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${newEst?.bg} ${newEst?.color}`}>
                    {newEst?.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {oldEst ? (
                      <>
                        <span className={`text-xs font-medium ${oldEst.color}`}>{oldEst.label}</span>
                        <ChevronRight size={12} className="text-text-muted" />
                        <span className={`text-xs font-medium ${newEst?.color}`}>{newEst?.label}</span>
                      </>
                    ) : (
                      <span className={`text-xs font-medium ${newEst?.color}`}>Creado como {newEst?.label}</span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{formatDate(h.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ModalOverlay>
  )
}

// --- Modal Overlay ---
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-border p-6 w-full max-w-lg shadow-lg relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}
