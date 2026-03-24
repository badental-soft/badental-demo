import { createClient } from '@supabase/supabase-js'

let horasClient: ReturnType<typeof createClient> | null = null

export function createHorasClient() {
  if (horasClient) return horasClient
  const url = process.env.NEXT_PUBLIC_HORAS_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_HORAS_SUPABASE_ANON_KEY!
  horasClient = createClient(url, key)
  return horasClient
}
