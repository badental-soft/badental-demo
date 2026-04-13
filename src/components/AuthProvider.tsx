'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

const SYNC_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

function shouldAutoSync(): boolean {
  if (typeof window === 'undefined') return false
  const last = localStorage.getItem('last_auto_sync')
  if (!last) return true
  return Date.now() - parseInt(last, 10) > SYNC_COOLDOWN_MS
}

function markSynced() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('last_auto_sync', Date.now().toString())
  }
}

function triggerSync() {
  markSynced()
  fetch('/api/sync-dentalink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dias: 7 }),
  }).catch(() => {})
  fetch('/api/sync-pagos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dias: 7 }),
  }).catch(() => {})
  // Sync pacientes nuevos del día (trae fecha_afiliacion de Dentalink en vivo)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  fetch(`/api/dentalink-agendados?fecha=${hoy}`).catch(() => {})
  // Sync por cobrar (tratamientos con deuda desde Dentalink)
  fetch('/api/sync-por-cobrar', { method: 'POST' }).catch(() => {})
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Auto-sync on page load for admin (with 30min cooldown)
  useEffect(() => {
    if (initialUser?.rol === 'admin' && shouldAutoSync()) {
      triggerSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          setUser(profile)

          // Redirect to password change if needed
          if (profile?.must_change_password && typeof window !== 'undefined' && !window.location.pathname.includes('cambiar-clave')) {
            window.location.href = '/cambiar-clave'
            return
          }

          // Auto-sync on login (admin only)
          if (event === 'SIGNED_IN' && profile?.rol === 'admin' && shouldAutoSync()) {
            triggerSync()
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
