'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import HorasTab from '@/components/empleados/HorasTab'
import {
  CheckSquare,
  CalendarDays,
  Timer,
  Settings,
  AlertCircle,
} from 'lucide-react'

type TabId = 'tareas' | 'turnos-agendados' | 'horas' | 'config'

const ADMIN_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'tareas', label: 'Tareas', icon: <CheckSquare size={16} /> },
  { id: 'turnos-agendados', label: 'Turnos Agendados', icon: <CalendarDays size={16} /> },
  { id: 'horas', label: 'Horas', icon: <Timer size={16} /> },
  { id: 'config', label: 'Config', icon: <Settings size={16} /> },
]

const EMPLOYEE_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'tareas', label: 'Mis Tareas', icon: <CheckSquare size={16} /> },
  { id: 'turnos-agendados', label: 'Mis Turnos', icon: <CalendarDays size={16} /> },
  { id: 'horas', label: 'Mis Horas', icon: <Timer size={16} /> },
]

export default function EmpleadosPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('tareas')
  const isAdmin = user?.rol === 'admin'
  const tabs = isAdmin ? ADMIN_TABS : EMPLOYEE_TABS

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">
          {isAdmin ? 'Empleados' : 'Mi Panel'}
        </h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? 'Tareas, turnos agendados, horas y configuracion' : 'Tus tareas, turnos y horas'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 w-fit">
        {tabs.map(tab => (
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
      {activeTab === 'tareas' && <TareasTab isAdmin={isAdmin} />}
      {activeTab === 'turnos-agendados' && <TurnosAgendadosTab isAdmin={isAdmin} />}
      {activeTab === 'horas' && <HorasTab />}
      {activeTab === 'config' && isAdmin && <ConfigTab />}
    </div>
  )
}

function TareasTab({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {isAdmin ? 'Tareas del equipo' : 'Mis Tareas'}
      </h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        {isAdmin
          ? 'Checklist de tareas por empleado y sede. Veras el progreso de cada uno en tiempo real.'
          : 'Tu checklist diario de tareas. Tildalas a medida que las vayas completando.'}
      </p>
    </div>
  )
}

function TurnosAgendadosTab({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {isAdmin ? 'Turnos agendados por empleado' : 'Mis Turnos Agendados'}
      </h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        {isAdmin
          ? 'Cuantos turnos agendo cada empleado hoy y en la semana. Datos de Dentalink por usuario.'
          : 'Cuantos turnos agendaste hoy y en la semana.'}
      </p>
    </div>
  )
}

// HorasTab is imported from @/components/empleados/HorasTab

function ConfigTab() {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-text-muted mb-3" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Configuracion de empleados</h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        Alta y baja de empleados, asignacion de rol, sede y tipo de pago.
      </p>
    </div>
  )
}
