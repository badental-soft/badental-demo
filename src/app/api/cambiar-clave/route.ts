import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  // Verify the user is authenticated
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { password } = await request.json()

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  // Update password using user's own session (preserves session/cookies)
  const { error: passError } = await supabase.auth.updateUser({ password })

  // If error is "same password", that's OK — user wants to keep current password
  if (passError && !passError.message.toLowerCase().includes('different')) {
    return NextResponse.json({ error: passError.message }, { status: 500 })
  }

  // Mark must_change_password = false using service role (bypasses RLS)
  const supabaseAdmin = getSupabaseAdmin()
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ must_change_password: false, current_password: null })
    .eq('id', authUser.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
