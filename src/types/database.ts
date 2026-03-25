export type UserRole = 'admin' | 'rolA' | 'rolB' | 'rolC'
export type TipoPago = 'efectivo' | 'transferencia' | 'tarjeta_debito' | 'tarjeta_credito'
export type EstadoDeuda = 'pendiente' | 'parcial' | 'pagado'
export type EstadoTurno = 'agendado' | 'atendido' | 'no_asistio' | 'cancelado'
export type OrigenTurno = 'web' | 'whatsapp' | 'telefono' | 'instagram'
export type EstadoHora = 'pendiente' | 'aprobada' | 'pagada'
export type TipoGasto = 'fijo' | 'variable'
export type TipoPagoEmpleado = 'fijo' | 'comision' | 'fijo_bono' | 'por_hora'
export type TipoMovimientoStock = 'entrada' | 'salida'

export interface Sede {
  id: string
  nombre: string
  direccion: string
  activa: boolean
}

export interface User {
  id: string
  email: string
  nombre: string
  rol: UserRole
  sede_id: string | null
  created_at: string
}

export interface Cobranza {
  id: string
  fecha: string
  sede_id: string
  user_id: string | null
  paciente: string
  tratamiento: string
  tipo_pago: TipoPago
  monto: number
  es_cuota: boolean
  notas: string | null
  dentalink_id: number | null
  created_at: string
  // joins
  sede?: Sede
  user?: User
}

export interface Deuda {
  id: string
  paciente: string
  tratamiento: string
  monto_total: number
  monto_cobrado: number
  fecha_inicio: string
  sede_id: string
  estado: EstadoDeuda
  created_at: string
  // joins
  sede?: Sede
}

export interface Turno {
  id: string
  fecha: string
  hora: string
  sede_id: string
  paciente: string
  profesional: string
  estado: EstadoTurno
  origen: OrigenTurno
  created_at: string
  // joins
  sede?: Sede
}

export interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  asignado_a: string
  sede_id: string | null
  fecha: string
  completada: boolean
  completada_at: string | null
  created_at: string
  // joins
  user?: User
  sede?: Sede
}

export interface Hora {
  id: string
  user_id: string
  fecha: string
  horas: number
  es_domingo: boolean
  es_feriado: boolean
  estado: EstadoHora
  created_at: string
  // joins
  user?: User
}

export interface Gasto {
  id: string
  fecha: string
  sede_id: string | null
  user_id: string
  concepto: string
  categoria: string
  monto: number
  tipo: TipoGasto
  created_at: string
  // joins
  sede?: Sede
  user?: User
}

export interface EmpleadoConfig {
  id: string
  user_id: string
  rol: UserRole
  sede_id: string | null
  tipo_pago: TipoPagoEmpleado
  detalle_pago: Record<string, unknown>
  activo: boolean
  // joins
  user?: User
  sede?: Sede
}

export interface ProductoStock {
  id: string
  nombre: string
  medida: string | null
  unidad: string
  stock_minimo: number
  precio_compra: number | null
  activo: boolean
  created_at: string
}

export interface MovimientoStock {
  id: string
  producto_id: string
  sede_id: string
  tipo: TipoMovimientoStock
  cantidad: number
  descripcion: string | null
  fecha: string
  created_by: string | null
  created_at: string
  // joins
  producto?: ProductoStock
  user?: User
  sede?: Sede
}
