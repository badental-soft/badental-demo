import { createBrowserClient } from '@supabase/ssr'

export function createHorasClient() {
  const url = process.env.NEXT_PUBLIC_HORAS_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_HORAS_SUPABASE_ANON_KEY!
  return createBrowserClient(url, key)
}
