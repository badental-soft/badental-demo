'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-border p-8 max-w-md text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Algo salió mal</h2>
        <p className="text-sm text-text-secondary mb-6">
          Hubo un error al cargar esta página. Esto puede pasar si la sesión expiró.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-beige transition-colors"
          >
            Ir al login
          </button>
        </div>
      </div>
    </div>
  )
}
