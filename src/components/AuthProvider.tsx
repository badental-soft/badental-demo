'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => void
  dataVersion: number
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
  dataVersion: 0,
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
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  fetch(`/api/dentalink-agendados?fecha=${hoy}`).catch(() => {})
  fetch('/api/sync-por-cobrar', { method: 'POST' }).catch(() => {})
}

function forceLogout() {
  // Clear ALL Supabase cookies without any API calls
  document.cookie.split(';').forEach(c => {
    const name = c.trim().split('=')[0]
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    }
  })
  window.location.href = '/login'
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const supabase = createClient()
  const hiddenAtRef = useRef(0)

  // Auto-sync on page load for admin (with 30min cooldown)
  useEffect(() => {
    if (initialUser?.rol === 'admin' && shouldAutoSync()) {
      triggerSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for auth state changes from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser()
          if (authUser) {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .single()
            setUser(profile)

            if (profile?.must_change_password && typeof window !== 'undefined' && !window.location.pathname.includes('cambiar-clave')) {
              window.location.href = '/cambiar-clave'
              return
            }

            if (event === 'SIGNED_IN' && profile?.rol === 'admin' && shouldAutoSync()) {
              triggerSync()
            }
          }
        } catch (err) {
          console.error('Error handling auth state change:', err)
        }

        // Session was refreshed — tell pages to refetch their data
        if (event === 'TOKEN_REFRESHED') {
          setDataVersion(v => v + 1)
        }
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the tab goes to background and comes back, stale connections and
  // expired tokens can make the entire app unresponsive.
  // Strategy: hard reload after extended absence (guaranteed clean state),
  // quick refresh for shorter absences.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current > 0) {
        const elapsed = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = 0

        if (elapsed > 60_000) {
          // > 1 minute away: hard reload for clean state
          // (stale connections, expired tokens, frozen JS — all fixed)
          window.location.reload()
        } else if (elapsed > 5_000) {
          // 5s-1min away: bump dataVersion to trigger refetches
          // Supabase's internal auto-refresh handles the token
          setDataVersion(v => v + 1)
        }
        // < 5s: do nothing, everything should still be fine
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Logout: NEVER await API calls that might hang.
  // Use scope:'local' to skip the server revocation call, then clear cookies.
  const handleSignOut = () => {
    supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    forceLogout()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, dataVersion }}>
      {children}
    </AuthContext.Provider>
  )
}
