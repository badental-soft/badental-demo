import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPaginado } from '@/lib/dentalink'

export const maxDuration = 60

const SUCURSAL_MAP: Record<number, string> = {
  1: '9c098df1-b762-4a0f-a5a9-e31f2db2f0e6',
  2: '8435b094-2f26-42da-b8e7-12f8e2c19f17',
  4: '30c30867-36c8-4432-af5a-0358fe7a64b9',
  5: '14497356-63c4-4aad-90c6-fbc1a18d67e4',
  6: '93f30e64-4857-446d-afc1-6b55c48d4727',
  7: '9cb6e65f-5e6a-466e-9a33-eb5f0d1a6dce',
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface DentalinkTratamiento {
  id: number
  nombre: string
  id_paciente: number
  nombre_paciente: string
  nombre_social_paciente?: string
  id_sucursal: number
  nombre_sucursal: string
  total: number
  abonado: number
  deuda: number
  finalizado: boolean
  bloqueado: boolean
}

interface DentalinkDescuento {
  id: number
  cuotas: number
  total: number
}

interface DentalinkCuota {
  id: number
  numero_cuota: number
  fecha_vencimiento: string
  total: number
  pagado: number
  por_pagar: number
}

/**
 * Sync "Por Cobrar" desde Dentalink.
 * 1. Trae todos los tratamientos activos con deuda > 0
 * 2. Para cada uno, busca si tiene plan de cuotas (descuentos)
 * 3. Si tiene cuotas, guarda cada cuota pendiente con su fecha_vencimiento
 * 4. Si no tiene cuotas, guarda la deuda general del tratamiento
 */
export async function POST(request: Request) {
  const supabase = await createServerClient()

  // Auth check
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', authUser.id)
    .single()
  if (!profile || profile.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const admin = getSupabaseAdmin()

    // 1. Fetch all active treatments
    const tratamientos = await fetchPaginado<DentalinkTratamiento>('/tratamientos', {
      finalizado: { eq: '0' },
    })

    // Filter: deuda > 0 and valid sucursal
    const conDeuda = tratamientos.filter(
      t => t.deuda > 0 && !t.bloqueado && SUCURSAL_MAP[t.id_sucursal]
    )

    // 2. For each treatment, try to fetch cuotas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = []
    let tratamientosConCuotas = 0

    for (let i = 0; i < conDeuda.length; i += 5) {
      const batch = conDeuda.slice(i, i + 5)

      const descResults = await Promise.all(
        batch.map(async (t) => {
          try {
            const descs = await fetchPaginado<DentalinkDescuento>(
              `/tratamientos/${t.id}/descuentos`
            )
            return { tratamiento: t, descuentos: descs }
          } catch {
            return { tratamiento: t, descuentos: [] as DentalinkDescuento[] }
          }
        })
      )

      // Process each treatment's descuentos
      for (const { tratamiento: t, descuentos } of descResults) {
        let tieneCuotas = false

        for (const desc of descuentos) {
          if (desc.cuotas > 0) {
            try {
              const cuotas = await fetchPaginado<DentalinkCuota>(
                `/tratamientos/${t.id}/descuentos/${desc.id}/cuotas`
              )
              const pendientes = cuotas.filter(c => c.por_pagar > 0)
              if (pendientes.length > 0) {
                tieneCuotas = true
                tratamientosConCuotas++
                for (const c of pendientes) {
                  rows.push({
                    id_tratamiento: t.id,
                    id_paciente: t.id_paciente,
                    nombre_paciente: t.nombre_paciente?.trim() || 'Sin nombre',
                    nombre_tratamiento: t.nombre,
                    id_sucursal: t.id_sucursal,
                    nombre_sucursal: t.nombre_sucursal,
                    sede_id: SUCURSAL_MAP[t.id_sucursal],
                    fecha_vencimiento: c.fecha_vencimiento || null,
                    monto: c.total,
                    pagado: c.pagado,
                    saldo: c.por_pagar,
                    numero_cuota: c.numero_cuota,
                    total_cuotas: desc.cuotas,
                  })
                }
              }
            } catch {
              // Skip this descuento
            }
          }
        }

        // If no cuotas found, add treatment-level deuda
        if (!tieneCuotas) {
          rows.push({
            id_tratamiento: t.id,
            id_paciente: t.id_paciente,
            nombre_paciente: t.nombre_paciente?.trim() || 'Sin nombre',
            nombre_tratamiento: t.nombre,
            id_sucursal: t.id_sucursal,
            nombre_sucursal: t.nombre_sucursal,
            sede_id: SUCURSAL_MAP[t.id_sucursal],
            fecha_vencimiento: null,
            monto: t.deuda,
            pagado: 0,
            saldo: t.deuda,
            numero_cuota: null,
            total_cuotas: null,
          })
        }
      }

      // Rate limiting between batches
      if (i + 5 < conDeuda.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // 3. Replace all existing data
    await admin.from('por_cobrar').delete().gte('id', '00000000-0000-0000-0000-000000000000')

    let inserted = 0
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const { error } = await admin.from('por_cobrar').insert(batch)
      if (error) console.error('por_cobrar insert error:', error.message)
      else inserted += batch.length
    }

    return NextResponse.json({
      ok: true,
      tratamientos_activos: tratamientos.length,
      con_deuda: conDeuda.length,
      con_cuotas: tratamientosConCuotas,
      filas_guardadas: inserted,
    })
  } catch (error) {
    console.error('sync-por-cobrar error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
