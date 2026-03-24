'use client'

import StockModule from '@/components/stock/StockModule'

export default function StockPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Stock</h1>
        <p className="text-sm text-text-secondary">Inventario de insumos por sede</p>
      </div>
      <StockModule />
    </div>
  )
}
