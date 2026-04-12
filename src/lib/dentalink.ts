// Dentalink API client
// Paginación cursor-based (solo links.next)

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

// Mapeo Dentalink sucursal ID → nuestra sede UUID
// Se carga dinámicamente al sincronizar
export type SucursalMap = Record<number, string>

interface DentalinkResponse<T> {
  data: T[]
  links?: {
    next?: string
    current?: string
  }
}

export interface DentalinkCita {
  id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  duracion: number
  id_paciente: number
  nombre_paciente: string
  id_dentista: number
  nombre_dentista: string
  id_sucursal: number
  nombre_sucursal: string
  id_estado: number
  estado_cita: string
  id_tratamiento: number
  nombre_tratamiento: string
  comentarios: string
  fecha_actualizacion: string
}

async function fetchAPI<T>(url: string): Promise<DentalinkResponse<T>> {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Token ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Dentalink API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function fetchPaginado<T>(endpoint: string, filtros?: Record<string, unknown>): Promise<T[]> {
  const todos: T[] = []
  let url = `${API_BASE}${endpoint}`

  if (filtros) {
    url += `?q=${encodeURIComponent(JSON.stringify(filtros))}`
  }

  let iteracion = 0
  const maxIter = 200

  while (url && iteracion < maxIter) {
    const resp = await fetchAPI<T>(url)
    if (!resp.data?.length) break

    todos.push(...resp.data)
    url = resp.links?.next || ''
    iteracion++

    // Rate limiting
    if (url) await new Promise(r => setTimeout(r, 300))
  }

  return todos
}

export function mapEstadoDentalink(estado: string): 'agendado' | 'atendido' | 'no_asistio' | 'cancelado' {
  const s = (estado || '').toLowerCase().trim()

  if (s === 'atendido' || s === 'atendiéndose' || s === 'atendiendose') {
    return 'atendido'
  }
  if (s === 'no asiste') {
    return 'no_asistio'
  }
  if (
    s === 'anulado' ||
    s === 'anulado por pcte. via whatsapp' ||
    s === 'anulado por pcte. via email' ||
    s === 'anulado por sesiones en conflicto' ||
    s === 'paciente deshabilitado'
  ) {
    return 'cancelado'
  }
  // No confirmado, Notificado, Cambio de fecha, etc → agendado
  return 'agendado'
}

export function mapOrigenDentalink(): 'web' | 'whatsapp' | 'telefono' | 'instagram' {
  // Dentalink no expone el origen del turno, defaulteamos a 'web'
  return 'web'
}

// --- PAGOS ---

export interface DentalinkPago {
  id: number
  id_pagador: number
  nombre_pagador: string
  tipo_pagador: string
  id_paciente: number
  nombre_paciente: string
  nombre_social_paciente: string
  monto_pago: number
  id_medio_pago: number
  id_banco: number
  medio_pago: string
  nombre_banco: string
  fecha_recepcion: string
  fecha_vencimiento: string
  fecha_creacion: string
  rut_emisor: string
  numero_referencia: string
  id_caja: number
  id_sucursal: number
  nombre_sucursal: string
  folio: number
}

export function mapMedioPagoDentalink(medio: string): 'efectivo' | 'transferencia' | 'tarjeta_debito' | 'tarjeta_credito' {
  const m = (medio || '').toLowerCase().trim()
  if (m.includes('efectivo')) return 'efectivo'
  if (m.includes('transferencia')) return 'transferencia'
  if (m.includes('débito') || m.includes('debito')) return 'tarjeta_debito'
  if (m.includes('crédito') || m.includes('credito')) return 'tarjeta_credito'
  // Cheque, otro → transferencia por default
  return 'transferencia'
}
