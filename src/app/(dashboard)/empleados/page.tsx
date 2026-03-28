import { requireRole } from '@/lib/auth-guard'
import { Construction } from 'lucide-react'

export default async function EmpleadosPage() {
  await requireRole('admin')

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Empleados</h1>
        <p className="text-sm text-text-secondary">Tareas, turnos agendados, horas y configuración</p>
      </div>
      <div className="bg-surface rounded-xl border border-border p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
          <Construction size={28} className="text-amber-500" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Módulo en preparación</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Estamos terminando de integrar la gestión de empleados, tareas y horas.
          Este módulo va a estar disponible próximamente.
        </p>
      </div>
    </div>
  )
}
