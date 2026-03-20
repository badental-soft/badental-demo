import { createBrowserClient } from '@supabase/ssr'

let horasClient: ReturnType<typeof createBrowserClient> | null = null

export function createHorasClient() {
  if (!horasClient) {
    const url = process.env.NEXT_PUBLIC_HORAS_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_HORAS_SUPABASE_ANON_KEY!
    horasClient = createBrowserClient(url, key)
  }
  return horasClient
}
