'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
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
  // IMPORTANT: Do NOT trigger re-fetches or set user to null here.
  // - SIGNED_OUT from Supabase often fires on transient refresh failures
  //   (e.g. stale TCP connections after tab switch). Manual logout uses
  //   forceLogout() which handles the redirect directly.
  // - TOKEN_REFRESHED is an internal auth concern. The data is already
  //   loaded and visible — re-fetching it risks hanging on stale connections.
  // - SIGNED_IN is the only event that needs action (initial login).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
      if (event === 'SIGNED_IN') {
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

            if (profile?.rol === 'admin' && shouldAutoSync()) {
              triggerSync()
            }
          }
        } catch (err) {
          console.error('Error handling SIGNED_IN:', err)
        }
      }
      // TOKEN_REFRESHED: do nothing — data stays visible, no re-fetches
      // SIGNED_OUT: do nothing — manual logout uses forceLogout() directly.
      //   If session is truly expired, middleware redirects on next navigation.
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the tab goes to background and comes back, stale HTTP connections
  // cause fetch() calls to hang forever. The SAFEST strategy:
  // - Short absence: do NOTHING (existing data stays visible, no risk of hanging)
  // - Long absence: hard reload (creates fresh connections, guaranteed clean state)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current > 0) {
        const elapsed = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = 0

        // > 2 minutes away: hard reload for guaranteed clean state
        if (elapsed > 120_000) {
          window.location.reload()
        }
        // < 2 minutes: do nothing, existing data stays visible
        // User can hit "Sync todo" or F5 if they want fresh data
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
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}
