'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  dataVersion: number
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
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

function clearSupabaseCookies() {
  document.cookie.split(';').forEach(c => {
    const name = c.trim().split('=')[0]
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    }
  })
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const supabase = createClient()
  const isRecovering = useRef(false)

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

  // Recover session when user returns to the tab after being away.
  // Browsers throttle timers in background tabs, so Supabase's auto-refresh
  // may miss its window. We force a session check on tab focus.
  // IMPORTANT: This uses a ref guard to prevent race conditions with navigation.
  const recoverSession = useCallback(async () => {
    if (isRecovering.current) return
    isRecovering.current = true

    try {
      // First, try to refresh the session (cheap, reads cookies + refreshes if needed)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        // No session at all — redirect to login
        clearSupabaseCookies()
        window.location.href = '/login'
        return
      }

      // Check if the access token is expired
      const now = Math.floor(Date.now() / 1000)
      if (session.expires_at && session.expires_at < now) {
        // Token expired — force a refresh using the refresh token
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          // Refresh token also expired — must re-login
          console.error('Session refresh failed:', refreshError.message)
          clearSupabaseCookies()
          window.location.href = '/login'
          return
        }
        // refreshSession triggers TOKEN_REFRESHED via onAuthStateChange,
        // which increments dataVersion and triggers page refetches.
      }
    } catch (err) {
      console.error('Error recovering session:', err)
    } finally {
      isRecovering.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recoverSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [recoverSession])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    }
    clearSupabaseCookies()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, dataVersion }}>
      {children}
    </AuthContext.Provider>
  )
}
