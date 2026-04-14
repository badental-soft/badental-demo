import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  client = createBrowserClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        // When Chrome backgrounds a tab, HTTP connections die silently.
        // On return, fetch() sends requests on dead connections that never
        // get a response — hanging forever. This 15s timeout ensures
        // queries always resolve (with error) instead of hanging.
        if (init?.signal) return fetch(input, init)
        const controller = new AbortController()
        const id = setTimeout(() => controller.abort(), 15000)
        return fetch(input, { ...init, signal: controller.signal })
          .finally(() => clearTimeout(id))
      },
    },
  })
  return client
}
