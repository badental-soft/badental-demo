'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Timer,
  Settings,
  AlertCircle,
} from 'lucide-react'
import TareasTab from '@/components/empleados/TareasTab'
import HorasTab, { AdminConfig } from '@/components/empleados/HorasTab'
import EmpleadoDashboard from '@/components/empleados/EmpleadoDashboard'
import { createHorasClient } from '@/lib/supabase/horas-client'

type AdminTabId = 'tareas' | 'turnos-agendados' | 'horas' | 'config'
type EmployeeTabId = 'dashboard' | 'turnos' | 'tareas' | 'horas'
type TabId = AdminTabId | EmployeeTabId

const ADMIN_TABS: { id: AdminTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'tareas', label: 'Tareas', icon: <CheckSquare size={16} /> },
  { id: 'turnos-agendados', label: 'Turnos Agendados', icon: <CalendarDays size={16} /> },
  { id: 'horas', label: 'Horas', icon: <Timer size={16} /> },
  { id: 'config', label: 'Config', icon: <Settings size={16} /> },
]

const EMPLOYEE_TABS: { id: EmployeeTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { id: 'turnos', label: 'Turnos', icon: <CalendarDays size={16} /> },
  { id: 'tareas', label: 'Tareas', icon: <CheckSquare size={16} /> },
  { id: 'horas', label: 'Horas', icon: <Timer size={16} /> },
]

export default function EmpleadosPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'
  const [activeTab, setActiveTab] = useState<TabId>(isAdmin ? 'tareas' : 'dashboard')
  const tabs = isAdmin ? ADMIN_TABS : EMPLOYEE_TABS

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">
          {isAdmin ? 'Empleados' : 'Mi Panel'}
        </h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? 'Tareas, turnos agendados, horas y configuracion' : 'Tu resumen, turnos, tareas y horas'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
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
      {activeTab === 'dashboard' && !isAdmin && <EmpleadoDashboard />}
      {activeTab === 'tareas' && <TareasTab isAdmin={isAdmin} />}
      {activeTab === 'turnos' && !isAdmin && <TurnosEmpleadoTab />}
      {activeTab === 'turnos-agendados' && isAdmin && <TurnosAgendadosTab />}
      {activeTab === 'horas' && <HorasTab isAdmin={isAdmin} />}
      {activeTab === 'config' && isAdmin && <ConfigTab />}
    </div>
  )
}

function TurnosEmpleadoTab() {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Mis Turnos Agendados</h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        Próximamente vas a poder ver los turnos que fuiste agendando, con detalle diario y semanal.
      </p>
      <p className="text-xs text-text-muted mt-2">Pendiente de integración con Dentalink.</p>
    </div>
  )
}

function TurnosAgendadosTab() {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Turnos agendados por empleado</h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        Cuantos turnos agendo cada empleado hoy y en la semana. Datos de Dentalink por usuario.
      </p>
      <p className="text-xs text-text-muted mt-2">Pendiente de acceso admin a la API de Dentalink.</p>
    </div>
  )
}

function ConfigTab() {
  const supabase = createHorasClient()
  const [config, setConfig] = useState({ hourly_rate: 8000, sunday_multiplier: 2 })
  const [employees, setEmployees] = useState<{ id: string; name: string; active: boolean; gestion_user_id: string | null }[]>([])

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
      if (data) setEmployees(data as unknown as typeof employees)
    } catch (err) {
      console.error('Error fetching employees:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateConfigValue = async (key: string, value: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('config') as any)
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      fetchConfig()
    } catch (err) {
      console.error('Error updating config:', err)
    }
  }

  useEffect(() => { fetchConfig() }, [fetchConfig])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  return (
    <AdminConfig
      config={config}
      onUpdateConfig={updateConfigValue}
      employees={employees}
      fetchEmployees={fetchEmployees}
    />
  )
}
