'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  Plus,
  X,
  Pencil,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Shield,
  MapPin,
  AlertCircle,
  Check,
  Clock,
  DollarSign,
} from 'lucide-react'
import type { UserRole, Sede } from '@/types/database'

interface UserWithSede {
  id: string
  email: string
  nombre: string
  rol: UserRole
  sede_id: string | null
  created_at: string
  sede: { nombre: string } | null
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  rolA: 'Recepcionista Digital',
  rolB: 'Vendedor',
  rolC: 'Recepcionista',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  rolA: 'bg-blue-100 text-blue-700',
  rolB: 'bg-amber-100 text-amber-700',
  rolC: 'bg-green-100 text-green-700',
}

export default function ConfiguracionClient() {
  const [users, setUsers] = useState<UserWithSede[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithSede | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithSede | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<UserWithSede | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const supabase = createClient()

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSedes = useCallback(async () => {
    const { data } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (data) setSedes(data as unknown as Sede[])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchSedes()
  }, [fetchUsers, fetchSedes])

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleCreateUser = async (formData: { email: string; password: string; nombre: string; rol: UserRole; sede_id: string }) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    const data = await res.json()
    if (!res.ok) {
      showFeedback('error', data.error || 'Error al crear usuario')
      return false
    }
    showFeedback('success', `Usuario ${formData.nombre} creado correctamente`)
    setShowCreateModal(false)
    fetchUsers()
    return true
  }

  const handleUpdateUser = async (id: string, updates: { nombre?: string; rol?: UserRole; sede_id?: string | null }) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const data = await res.json()
    if (!res.ok) {
      showFeedback('error', data.error || 'Error al actualizar')
      return false
    }
    showFeedback('success', 'Usuario actualizado')
    setEditingUser(null)
    fetchUsers()
    return true
  }

  const handleResetPassword = async (id: string, newPassword: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, new_password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      showFeedback('error', data.error || 'Error al cambiar contraseña')
      return false
    }
    showFeedback('success', 'Contraseña actualizada')
    setResetPasswordUser(null)
    return true
  }

  const handleDeleteUser = async (id: string) => {
    const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      showFeedback('error', data.error || 'Error al eliminar')
      return
    }
    showFeedback('success', 'Usuario eliminado')
    setDeleteConfirm(null)
    fetchUsers()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Configuración</h1>
          <p className="text-sm text-text-secondary">Gestión de usuarios del sistema</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
        >
          <Plus size={16} />
          Nuevo usuario
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {feedback.message}
        </div>
      )}

      {/* Users table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-text-muted">No hay usuarios registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary">Sede</th>
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-beige/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{u.nombre}</td>
                    <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.rol]}`}>
                        <Shield size={12} />
                        {ROLE_LABELS[u.rol]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {u.sede?.nombre ? (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-text-muted" />
                          {u.sede.nombre}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 rounded-md text-text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setResetPasswordUser(u)}
                          className="p-1.5 rounded-md text-text-muted hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Cambiar contraseña"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(u)}
                          className="p-1.5 rounded-md text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-4 flex gap-3 flex-wrap">
        {(['admin', 'rolA', 'rolB', 'rolC'] as UserRole[]).map(rol => {
          const count = users.filter(u => u.rol === rol).length
          if (count === 0) return null
          return (
            <div key={rol} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className={`inline-block w-2 h-2 rounded-full ${
                rol === 'admin' ? 'bg-purple-500' : rol === 'rolA' ? 'bg-blue-500' : rol === 'rolB' ? 'bg-amber-500' : 'bg-green-500'
              }`} />
              {count} {ROLE_LABELS[rol]}{count > 1 ? 's' : ''}
            </div>
          )
        })}
      </div>

      {/* Horas Config */}
      <HorasConfigSection />

      {/* Create Modal */}
      {showCreateModal && (
        <CreateUserModal
          sedes={sedes}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
        />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          sedes={sedes}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onReset={handleResetPassword}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <DeleteConfirmModal
          user={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  )
}

// --- Modals ---

function CreateUserModal({ sedes, onClose, onCreate }: {
  sedes: Sede[]
  onClose: () => void
  onCreate: (data: { email: string; password: string; nombre: string; rol: UserRole; sede_id: string }) => Promise<boolean>
}) {
  const [form, setForm] = useState({ email: '', password: '', nombre: '', rol: 'rolC' as UserRole, sede_id: '' })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onCreate(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Users size={20} />
        Nuevo usuario
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Nombre</label>
          <input
            type="text"
            required
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            placeholder="Nombre completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            placeholder="usuario@ejemplo.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Contraseña</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={6}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Rol</label>
            <select
              value={form.rol}
              onChange={e => setForm({ ...form, rol: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            >
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Sede</label>
            <select
              value={form.sede_id}
              onChange={e => setForm({ ...form, sede_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            >
              <option value="">Sin sede (todas)</option>
              {sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

function EditUserModal({ user, sedes, onClose, onSave }: {
  user: UserWithSede
  sedes: Sede[]
  onClose: () => void
  onSave: (id: string, updates: { nombre?: string; rol?: UserRole; sede_id?: string | null }) => Promise<boolean>
}) {
  const [form, setForm] = useState({ nombre: user.nombre, rol: user.rol as UserRole, sede_id: user.sede_id || '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(user.id, {
        nombre: form.nombre,
        rol: form.rol,
        sede_id: form.sede_id || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Pencil size={20} />
        Editar usuario
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Nombre</label>
          <input
            type="text"
            required
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
          <input
            type="email"
            disabled
            value={user.email}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-gray-50 text-text-muted cursor-not-allowed"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Rol</label>
            <select
              value={form.rol}
              onChange={e => setForm({ ...form, rol: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            >
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Sede</label>
            <select
              value={form.sede_id}
              onChange={e => setForm({ ...form, sede_id: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
            >
              <option value="">Sin sede (todas)</option>
              {sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

function ResetPasswordModal({ user, onClose, onReset }: {
  user: UserWithSede
  onClose: () => void
  onReset: (id: string, password: string) => Promise<boolean>
}) {
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onReset(user.id, password)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
        <KeyRound size={20} />
        Cambiar contraseña
      </h2>
      <p className="text-sm text-text-secondary mb-4">
        Nueva contraseña para <strong>{user.nombre}</strong>
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Nueva contraseña</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-primary/20 focus:border-green-primary outline-none"
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

function DeleteConfirmModal({ user, onClose, onDelete }: {
  user: UserWithSede
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(user.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2">
        <Trash2 size={20} />
        Eliminar usuario
      </h2>
      <p className="text-sm text-text-secondary mb-1">
        ¿Estás seguro de que querés eliminar a <strong>{user.nombre}</strong>?
      </p>
      <p className="text-xs text-text-muted mb-4">
        Se eliminará el acceso al sistema. Esta acción no se puede deshacer.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          Cancelar
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </ModalOverlay>
  )
}

function HorasConfigSection() {
  const supabase = createClient()
  const [config, setConfig] = useState({ hourly_rate: 8000, sunday_multiplier: 2 })
  const [rate, setRate] = useState('8000')
  const [mult, setMult] = useState('2')
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await supabase.from('config').select('key, value')
      if (data) {
        const rows = data as unknown as { key: string; value: string }[]
        const cfg: Record<string, string> = {}
        rows.forEach((d) => { cfg[d.key] = d.value })
        const c = {
          hourly_rate: Number(cfg.hourly_rate) || 8000,
          sunday_multiplier: Number(cfg.sunday_multiplier) || 2,
        }
        setConfig(c)
        setRate(String(c.hourly_rate))
        setMult(String(c.sunday_multiplier))
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const saveConfig = async (key: string, value: string) => {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('config') as any)
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      fetchConfig()
    } catch (err) {
      console.error('Error updating config:', err)
    }
    setSaving(false)
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Clock size={20} />
        Configuración de Horas
      </h2>
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-text-muted" />
            <label className="text-sm text-text-secondary">Valor hora ($)</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              min="0"
              step="100"
              className="w-28 px-3 py-1.5 text-sm border border-border rounded-lg bg-white text-text-primary focus:outline-none focus:border-green-primary"
            />
            <button
              onClick={() => saveConfig('hourly_rate', rate)}
              disabled={saving}
              className="text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-beige transition-colors disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">Multiplicador dom/fer.</label>
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
              onClick={() => saveConfig('sunday_multiplier', mult)}
              disabled={saving}
              className="text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-beige transition-colors disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-border p-6 w-full max-w-md shadow-lg relative"
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
