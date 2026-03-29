import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado, mapEstadoDentalink, mapOrigenDentalink } from '@/lib/dentalink'
import type { DentalinkCita } from '@/lib/dentalink'

// Use service role to bypass RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mapeo estático Dentalink sucursal ID → nuestra sede UUID
const SUCURSAL_MAP: Record<number, string> = {
  1: '9c098df1-b762-4a0f-a5a9-e31f2db2f0e6', // Saavedra
  2: '8435b094-2f26-42da-b8e7-12f8e2c19f17', // Caballito
  4: '30c30867-36c8-4432-af5a-0358fe7a64b9', // Moreno
  5: '14497356-63c4-4aad-90c6-fbc1a18d67e4', // Ramos Mejía
  6: '93f30e64-4857-446d-afc1-6b55c48d4727', // Banfield
  7: '9cb6e65f-5e6a-466e-9a33-eb5f0d1a6dce', // San Isidro
}

export async function POST(request: Request) {
  try {
    // Auth check: solo admin puede sincronizar
    const supabaseAuth = await createServerClient()
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { data: profile } = await supabaseAuth
      .from('users')
      .select('rol')
      .eq('id', authUser.id)
      .single()
    if (!profile || profile.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    const diasAtras = body.dias || 7
    const diasAdelante = body.diasAdelante || 30

    // Calculate date range: past + future
    const hoy = new Date()
    const desde = new Date()
    desde.setDate(hoy.getDate() - diasAtras)
    const hasta = new Date()
    hasta.setDate(hoy.getDate() + diasAdelante)

    const fechaDesde = desde.toISOString().split('T')[0]
    const fechaHasta = hasta.toISOString().split('T')[0]

    // Fetch citas from Dentalink
    const citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: fechaDesde }, { lte: fechaHasta }],
    })

    if (!citas.length) {
      return NextResponse.json({ message: 'No hay citas en el rango', count: 0 })
    }

    const supabase = getSupabaseAdmin()

    // Transform and upsert
    const turnos = citas
      .filter(c => SUCURSAL_MAP[c.id_sucursal]) // Skip unmapped sucursales (e.g., Microcentro)
      .map(c => ({
        id: crypto.randomUUID(), // We'll use upsert on dentalink_id instead
        fecha: c.fecha,
        hora: c.hora_inicio || '00:00',
        sede_id: SUCURSAL_MAP[c.id_sucursal],
        paciente: c.nombre_paciente || 'Sin nombre',
        profesional: c.nombre_dentista || null,
        estado: mapEstadoDentalink(c.estado_cita),
        origen: mapOrigenDentalink(),
        dentalink_id: c.id,
      }))

    // We need a dentalink_id column for upsert. First, let's do delete+insert for the date range
    // Delete existing synced turnos in this date range
    await supabase
      .from('turnos')
      .delete()
      .not('dentalink_id', 'is', null)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)

    // Insert all
    const batchSize = 500
    let inserted = 0
    for (let i = 0; i < turnos.length; i += batchSize) {
      const batch = turnos.slice(i, i + batchSize)
      const { error } = await supabase.from('turnos').insert(batch)
      if (error) {
        console.error('Insert error:', error)
        throw new Error(`Error insertando turnos: ${error.message}`)
      }
      inserted += batch.length
    }

    return NextResponse.json({
      message: `${inserted} turnos sincronizados`,
      rango: `${fechaDesde} → ${fechaHasta}`,
      total_dentalink: citas.length,
      insertados: inserted,
      omitidos: citas.length - turnos.length,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
