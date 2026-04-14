import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPaginado, mapEstadoDentalink, mapOrigenDentalink, mapMedioPagoDentalink } from '@/lib/dentalink'
import type { DentalinkCita, DentalinkPago } from '@/lib/dentalink'
import { syncPacientesDia } from '@/app/api/sync-pacientes/route'

export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET || ''

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SUCURSAL_MAP: Record<number, string> = {
  1: '9c098df1-b762-4a0f-a5a9-e31f2db2f0e6', // Saavedra
  2: '8435b094-2f26-42da-b8e7-12f8e2c19f17', // Caballito
  4: '30c30867-36c8-4432-af5a-0358fe7a64b9', // Moreno
  5: '14497356-63c4-4aad-90c6-fbc1a18d67e4', // Ramos Mejía
  6: '93f30e64-4857-446d-afc1-6b55c48d4727', // Banfield
  7: '9cb6e65f-5e6a-466e-9a33-eb5f0d1a6dce', // San Isidro
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    })
  } catch (e) {
    console.error('Telegram error:', e)
  }
}

const SEDE_NAMES: Record<string, string> = {
  '9c098df1-b762-4a0f-a5a9-e31f2db2f0e6': 'Saavedra',
  '8435b094-2f26-42da-b8e7-12f8e2c19f17': 'Caballito',
  '30c30867-36c8-4432-af5a-0358fe7a64b9': 'Moreno',
  '14497356-63c4-4aad-90c6-fbc1a18d67e4': 'R.Mejía',
  '93f30e64-4857-446d-afc1-6b55c48d4727': 'Banfield',
  '9cb6e65f-5e6a-466e-9a33-eb5f0d1a6dce': 'San Isidro',
}

function fmtMonto(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

/**
 * Cron job: sync diario completo.
 * Corre todos los días a las 23:00 AR (02:00 UTC+1).
 * Sincroniza turnos + pagos + pacientes nuevos del día.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Usar timezone Argentina para todas las fechas
    const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    const hoyDate = new Date(fechaHoy + 'T12:00:00')
    const desde = new Date(hoyDate)
    desde.setDate(hoyDate.getDate() - 7)
    const hasta = new Date(hoyDate)
    hasta.setDate(hoyDate.getDate() + 30)
    const fechaDesde = desde.toISOString().split('T')[0]
    const fechaHasta = hasta.toISOString().split('T')[0]

    // ── 1. Sync turnos ─────────────────────────────────────
    const citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: fechaDesde }, { lte: fechaHasta }],
    })

    let turnosInserted = 0
    if (citas.length > 0) {
      const turnos = citas
        .filter(c => SUCURSAL_MAP[c.id_sucursal])
        .map(c => ({
          id: crypto.randomUUID(),
          fecha: c.fecha,
          hora: c.hora_inicio || '00:00',
          sede_id: SUCURSAL_MAP[c.id_sucursal],
          paciente: c.nombre_paciente || 'Sin nombre',
          profesional: c.nombre_dentista || null,
          estado: mapEstadoDentalink(c.estado_cita),
          origen: mapOrigenDentalink(),
          dentalink_id: c.id,
        }))

      await supabase
        .from('turnos')
        .delete()
        .not('dentalink_id', 'is', null)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)

      for (let i = 0; i < turnos.length; i += 500) {
        const batch = turnos.slice(i, i + 500)
        const { error } = await supabase.from('turnos').insert(batch)
        if (error) console.error('Turnos insert error:', error.message)
        else turnosInserted += batch.length
      }
    }

    // ── 2. Sync pagos ──────────────────────────────────────
    let pagosInserted = 0
    try {
      const pagos = await fetchPaginado<DentalinkPago>('/pagos', {
        fecha_recepcion: [{ gte: fechaDesde }, { lte: fechaHoy }],
      })

      if (pagos.length > 0) {
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

        await supabase
          .from('cobranzas')
          .delete()
          .not('dentalink_id', 'is', null)
          .gte('fecha', fechaDesde)
          .lte('fecha', fechaHoy)

        for (let i = 0; i < cobranzas.length; i += 500) {
          const batch = cobranzas.slice(i, i + 500)
          const { error } = await supabase.from('cobranzas').insert(batch)
          if (error) console.error('Pagos insert error:', error.message)
          else pagosInserted += batch.length
        }
      }
    } catch (pagosError) {
      console.error('Error sync pagos:', pagosError)
    }

    // ── 3. Sync pacientes nuevos del día (por fecha_afiliacion) ──
    let pacientesNuevos = 0
    try {
      pacientesNuevos = await syncPacientesDia(fechaHoy)
    } catch (pacError) {
      console.error('Error sync pacientes:', pacError)
    }

    // ── 4. Sync por cobrar (tratamientos con deuda) ──────────
    let porCobrarRows = 0
    try {
      interface Tratamiento { id: number; nombre: string; id_paciente: number; nombre_paciente: string; id_sucursal: number; nombre_sucursal: string; total: number; abonado: number; deuda: number; bloqueado: boolean }

      const tratamientos = await fetchPaginado<Tratamiento>('/tratamientos', {
        finalizado: { eq: '0' },
      })
      const conDeuda = tratamientos.filter(t => t.deuda > 0 && !t.bloqueado && SUCURSAL_MAP[t.id_sucursal])

      const rows = conDeuda.map(t => ({
        id_tratamiento: t.id, id_paciente: t.id_paciente,
        nombre_paciente: t.nombre_paciente?.trim() || 'Sin nombre',
        nombre_tratamiento: t.nombre, id_sucursal: t.id_sucursal,
        nombre_sucursal: t.nombre_sucursal, sede_id: SUCURSAL_MAP[t.id_sucursal],
        fecha_vencimiento: null, monto: t.total, pagado: t.abonado, saldo: t.deuda,
        numero_cuota: null, total_cuotas: null,
      }))

      await supabase.from('por_cobrar').delete().gte('id', '00000000-0000-0000-0000-000000000000')
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        const { error } = await supabase.from('por_cobrar').insert(batch)
        if (error) console.error('por_cobrar insert error:', error.message)
        else porCobrarRows += batch.length
      }
    } catch (porCobrarError) {
      console.error('Error sync por cobrar:', porCobrarError)
    }

    // ── 5. Resumen diario por Telegram ─────────────────────
    try {
      const mananaDate = new Date(hoyDate)
      mananaDate.setDate(hoyDate.getDate() + 1)
      const fechaManana = mananaDate.toISOString().split('T')[0]

      // Cobranzas hoy
      const { data: cobranzasHoy } = await supabase
        .from('cobranzas')
        .select('monto')
        .eq('fecha', fechaHoy)
      const totalCobrado = (cobranzasHoy || []).reduce((s, c) => s + (Number(c.monto) || 0), 0)

      // Gastos pagados hoy
      const { data: gastosHoy } = await supabase
        .from('gastos')
        .select('monto')
        .eq('estado', 'pagado')
        .eq('fecha', fechaHoy)
      const totalGastos = (gastosHoy || []).reduce((s, g) => s + (Number(g.monto) || 0), 0)

      const resultado = totalCobrado - totalGastos

      // No-shows hoy
      const { count: noShowsCount } = await supabase
        .from('turnos')
        .select('id', { count: 'exact', head: true })
        .eq('fecha', fechaHoy)
        .eq('estado', 'no_asistio')

      // Turnos dados hoy (pacientes nuevos)
      const { count: turnosDadosCount } = await supabase
        .from('pacientes_nuevos')
        .select('id', { count: 'exact', head: true })
        .eq('fecha_afiliacion', fechaHoy)

      // Gastos por vencer mañana
      const { data: vencenManana } = await supabase
        .from('gastos')
        .select('concepto, monto')
        .eq('estado', 'pendiente')
        .eq('fecha_vencimiento', fechaManana)
      const totalVencen = (vencenManana || []).reduce((s, g) => s + (Number(g.monto) || 0), 0)

      // Turnos mañana por sede
      const { data: turnosManana } = await supabase
        .from('turnos')
        .select('sede_id')
        .eq('fecha', fechaManana)
      const totalManana = turnosManana?.length || 0
      const porSede: Record<string, number> = {}
      turnosManana?.forEach(t => {
        const nombre = SEDE_NAMES[t.sede_id] || 'Otra'
        porSede[nombre] = (porSede[nombre] || 0) + 1
      })

      // Stock bajo
      const { data: productos } = await supabase
        .from('stock_productos')
        .select('id, nombre, medida, stock_minimo')
        .eq('activo', true)
      const { data: movimientos } = await supabase
        .from('stock_movimientos')
        .select('producto_id, sede_id, tipo, cantidad')

      interface StockItem { producto: string; sede: string; cantidad: number }
      const stockBajo: StockItem[] = []
      if (productos && movimientos) {
        const { data: sedesData } = await supabase.from('sedes').select('id, nombre').eq('activa', true)
        const sedesMap: Record<string, string> = {}
        sedesData?.forEach(s => { sedesMap[s.id] = s.nombre })

        for (const prod of productos) {
          const sedeStock: Record<string, number> = {}
          movimientos
            .filter(m => m.producto_id === prod.id)
            .forEach(m => {
              if (!sedeStock[m.sede_id]) sedeStock[m.sede_id] = 0
              sedeStock[m.sede_id] += m.tipo === 'entrada' ? m.cantidad : -m.cantidad
            })
          for (const [sedeId, cant] of Object.entries(sedeStock)) {
            if (cant <= prod.stock_minimo) {
              const label = prod.medida ? `${prod.nombre} ${prod.medida}` : prod.nombre
              stockBajo.push({ producto: label, sede: sedesMap[sedeId] || 'Sede', cantidad: cant })
            }
          }
        }
      }

      // Formatear fecha bonita
      const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      const fechaBonita = `${diasSemana[hoyDate.getDay()]} ${hoyDate.getDate()} ${meses[hoyDate.getMonth()]}`

      // Armar mensaje
      let msg = `📊 *Resumen diario — ${fechaBonita}*\n\n`
      msg += `💰 Cobranzas hoy: ${fmtMonto(totalCobrado)}\n`
      msg += `💸 Gastos hoy: ${fmtMonto(totalGastos)}\n`
      msg += `📈 Resultado: ${resultado >= 0 ? '+' : ''}${fmtMonto(resultado)}\n\n`
      msg += `❌ No asistieron hoy: ${noShowsCount || 0}\n\n`
      msg += `📋 Turnos dados hoy: ${turnosDadosCount || 0}\n\n`

      if (vencenManana && vencenManana.length > 0) {
        msg += `⚠️ Vencen mañana: ${vencenManana.length} gasto${vencenManana.length > 1 ? 's' : ''} (${fmtMonto(totalVencen)})\n`
        for (const g of vencenManana.slice(0, 5)) {
          msg += `• ${g.concepto} — ${fmtMonto(Number(g.monto))}\n`
        }
        msg += '\n'
      } else {
        msg += `✅ Sin vencimientos mañana\n\n`
      }

      msg += `📅 Turnos mañana: ${totalManana}\n`
      if (totalManana > 0) {
        const sedeStr = Object.entries(porSede).map(([s, n]) => `${s} ${n}`).join(' | ')
        msg += `${sedeStr}\n`
      }
      msg += '\n'

      if (stockBajo.length > 0) {
        msg += `📦 Stock bajo: ${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''}\n`
        for (const s of stockBajo.slice(0, 8)) {
          msg += `• ${s.producto} (${s.sede}) — ${s.cantidad} uds\n`
        }
        if (stockBajo.length > 8) msg += `• ...y ${stockBajo.length - 8} más\n`
      } else {
        msg += `📦 Stock: todo OK\n`
      }

      await sendTelegram(msg)
    } catch (telegramError) {
      console.error('Error building Telegram summary:', telegramError)
    }

    const result = {
      ok: true,
      fecha: fechaHoy,
      turnos: turnosInserted,
      pagos: pagosInserted,
      pacientes_nuevos: pacientesNuevos,
      por_cobrar: porCobrarRows,
    }
    console.log('Cron sync-diario:', JSON.stringify(result))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron sync-diario error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
