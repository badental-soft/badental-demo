'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface SyncButtonProps {
  label?: string
  endpoints: { url: string; body?: Record<string, unknown> }[]
  onDone?: () => void
}

export default function SyncButton({ label = 'Sync Dentalink', endpoints, onDone }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)
    try {
      const results = await Promise.all(
        endpoints.map(async (ep) => {
          const res = await fetch(ep.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ep.body || {}),
          })
          return res.json()
        })
      )

      const messages: string[] = []
      results.forEach((r) => {
        if (r.error) {
          messages.push(`Error: ${r.error}`)
        } else {
          if (r.message) messages.push(r.message)
          if (r.rango) messages.push(r.rango)
        }
      })

      setResult(messages.length > 0 ? messages.join(' · ') : 'Sincronizado')
      setTimeout(() => setResult(null), 4000)
      onDone?.()
    } catch {
      setResult('Error al sincronizar')
      setTimeout(() => setResult(null), 4000)
    }
    setSyncing(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Sincronizando...' : label}
      </button>
      {result && (
        <span className="text-xs text-text-muted">{result}</span>
      )}
    </div>
  )
}
