import { NextResponse } from 'next/server'

let cached: { venta: number; compra: number; timestamp: number } | null = null
const CACHE_TTL = 1000 * 60 * 30 // 30 minutos

export async function GET() {
  // Devolver cache si es reciente
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ venta: cached.venta, compra: cached.compra })
  }

  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 1800 },
    })
    if (!res.ok) throw new Error('Error fetching dolar')
    const data = await res.json()

    cached = {
      venta: data.venta,
      compra: data.compra,
      timestamp: Date.now(),
    }

    return NextResponse.json({ venta: data.venta, compra: data.compra })
  } catch {
    // Si falla pero hay cache viejo, usarlo
    if (cached) {
      return NextResponse.json({ venta: cached.venta, compra: cached.compra })
    }
    return NextResponse.json({ error: 'No se pudo obtener la cotizacion' }, { status: 500 })
  }
}
