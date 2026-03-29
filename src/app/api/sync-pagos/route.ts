import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado, mapMedioPagoDentalink } from '@/lib/dentalink'
import type { DentalinkPago } from '@/lib/dentalink'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mismo mapeo que sync-dentalink
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
    const dias = body.dias || 7

    const hoy = new Date()
    const desde = new Date()
    desde.setDate(hoy.getDate() - dias)

    const fechaDesde = desde.toISOString().split('T')[0]
    const fechaHasta = hoy.toISOString().split('T')[0]

    // Fetch pagos from Dentalink
    const pagos = await fetchPaginado<DentalinkPago>('/pagos', {
      fecha_recepcion: [{ gte: fechaDesde }, { lte: fechaHasta }],
    })

    if (!pagos.length) {
      return NextResponse.json({ message: 'No hay pagos en el rango', count: 0 })
    }

    const supabase = getSupabaseAdmin()

    // Transform
    const cobranzas = pagos
      .filter(p => SUCURSAL_MAP[p.id_sucursal])
      .map(p => ({
        id: crypto.randomUUID(),
        fecha: p.fecha_recepcion,
        sede_id: SUCURSAL_MAP[p.id_sucursal],
        paciente: (p.nombre_paciente || 'Sin nombre').trim(),
        tratamiento: 'Dentalink',
        tipo_pago: mapMedioPagoDentalink(p.medio_pago),
        monto: p.monto_pago,
        es_cuota: false,
        notas: p.numero_referencia ? `Ref: ${p.numero_referencia}` : null,
        dentalink_id: p.id,
      }))

    // Delete existing synced cobranzas in date range, then insert
    await supabase
      .from('cobranzas')
      .delete()
      .not('dentalink_id', 'is', null)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)

    const batchSize = 500
    let inserted = 0
    for (let i = 0; i < cobranzas.length; i += batchSize) {
      const batch = cobranzas.slice(i, i + batchSize)
      const { error } = await supabase.from('cobranzas').insert(batch)
      if (error) {
        console.error('Insert error:', error)
        throw new Error(`Error insertando cobranzas: ${error.message}`)
      }
      inserted += batch.length
    }

    return NextResponse.json({
      message: `${inserted} pagos sincronizados`,
      rango: `${fechaDesde} → ${fechaHasta}`,
      total_dentalink: pagos.length,
      insertados: inserted,
      omitidos: pagos.length - cobranzas.length,
    })
  } catch (error) {
    console.error('Sync pagos error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
