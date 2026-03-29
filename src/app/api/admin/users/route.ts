import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', authUser.id)
    .single()

  if (!profile || profile.rol !== 'admin') return null
  return authUser
}

// GET: listar usuarios
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('users')
    .select('*, sede:sedes(nombre)')
    .order('nombre')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data })
}

// POST: crear usuario
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, nombre, rol, sede_id } = body

  if (!email || !password || !nombre || !rol) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // No requiere confirmación por email
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Crear perfil en tabla users
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      nombre,
      rol,
      sede_id: sede_id || null,
    })

  if (profileError) {
    // Rollback: eliminar usuario de auth si falla el perfil
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user: { id: authData.user.id, email, nombre, rol, sede_id } })
}

// PUT: actualizar usuario (rol, sede, nombre) o reset password
export async function PUT(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { id, nombre, rol, sede_id, new_password } = body

  if (!id) {
    return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Si viene new_password, actualizar contraseña en Auth
  if (new_password) {
    const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: new_password,
    })
    if (passError) {
      return NextResponse.json({ error: passError.message }, { status: 400 })
    }
  }

  // Actualizar perfil si vienen campos
  const updates: Record<string, string | null> = {}
  if (nombre !== undefined) updates.nombre = nombre
  if (rol !== undefined) updates.rol = rol
  if (sede_id !== undefined) updates.sede_id = sede_id || null

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE: eliminar usuario
export async function DELETE(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 })
  }

  // No permitir eliminarse a sí mismo
  if (id === admin.id) {
    return NextResponse.json({ error: 'No podés eliminarte a vos mismo' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Eliminar registros relacionados primero (FK constraints)
  await supabaseAdmin.from('tarea_completadas').delete().eq('user_id', id)

  // Eliminar perfil
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Eliminar de Auth
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
