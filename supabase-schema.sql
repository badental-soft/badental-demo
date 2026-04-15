-- =============================================
-- BA Dental Studio — Schema completo
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'rolA', 'rolB', 'rolC');
CREATE TYPE tipo_pago AS ENUM ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito');
CREATE TYPE estado_deuda AS ENUM ('pendiente', 'parcial', 'pagado');
CREATE TYPE estado_turno AS ENUM ('agendado', 'atendido', 'no_asistio', 'cancelado', 'reprogramado');
CREATE TYPE origen_turno AS ENUM ('web', 'whatsapp', 'telefono', 'instagram');
CREATE TYPE estado_hora AS ENUM ('pendiente', 'aprobada', 'pagada');
CREATE TYPE tipo_gasto AS ENUM ('fijo', 'variable');
CREATE TYPE tipo_pago_empleado AS ENUM ('fijo', 'comision', 'fijo_bono', 'por_hora');
CREATE TYPE tipo_movimiento_stock AS ENUM ('entrada', 'salida');

-- 2. SEDES
CREATE TABLE sedes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  activa BOOLEAN DEFAULT true
);

INSERT INTO sedes (nombre, direccion) VALUES
  ('Saavedra', 'Av. Ruiz Huidobro 3059, CABA'),
  ('Caballito', 'Senillosa 174, CABA'),
  ('San Isidro', 'Blanco Encalada 197, GBA'),
  ('Ramos Mejía', 'Av. Rivadavia 14340, GBA'),
  ('Moreno', 'Av. Pagano 2690, GBA'),
  ('Banfield', 'Cochabamba 220, GBA');

-- 3. USERS (perfil extendido vinculado a auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'rolC',
  sede_id UUID REFERENCES sedes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. COBRANZAS
CREATE TABLE cobranzas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  paciente TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  tipo_pago tipo_pago NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  es_cuota BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DEUDAS (POR COBRAR)
CREATE TABLE deudas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  monto_total DECIMAL(12,2) NOT NULL CHECK (monto_total > 0),
  monto_cobrado DECIMAL(12,2) DEFAULT 0 CHECK (monto_cobrado >= 0),
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  estado estado_deuda DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TURNOS
CREATE TABLE turnos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  paciente TEXT NOT NULL,
  profesional TEXT,
  estado estado_turno DEFAULT 'agendado',
  origen origen_turno DEFAULT 'whatsapp',
  dentalink_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX turnos_dentalink_id_unique ON turnos (dentalink_id) WHERE dentalink_id IS NOT NULL;

-- 7. TAREAS
CREATE TABLE tareas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  asignado_a UUID NOT NULL REFERENCES users(id),
  sede_id UUID REFERENCES sedes(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  completada BOOLEAN DEFAULT false,
  completada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. EMPLOYEES (módulo horas)
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  gestion_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. HOUR_ENTRIES (módulo horas)
CREATE TABLE hour_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 10. CONFIG (módulo horas)
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. WEEKLY_APPROVALS (módulo horas)
CREATE TABLE weekly_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. PAYMENT_RECORDS (módulo horas)
CREATE TABLE payment_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT now()
);

-- 9. GASTOS
CREATE TABLE gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID REFERENCES sedes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  tipo tipo_gasto NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. EMPLEADOS CONFIG
CREATE TABLE empleados_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  rol user_role NOT NULL,
  sede_id UUID REFERENCES sedes(id),
  tipo_pago tipo_pago_empleado NOT NULL DEFAULT 'fijo',
  detalle_pago JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true
);

-- 11. STOCK — PRODUCTOS
CREATE TABLE productos_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'General',
  sede_id UUID NOT NULL REFERENCES sedes(id),
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. STOCK — MOVIMIENTOS
CREATE TABLE movimientos_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES productos_stock(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  tipo tipo_movimiento_stock NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  motivo TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT rol FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's sede_id
CREATE OR REPLACE FUNCTION get_user_sede_id()
RETURNS UUID AS $$
  SELECT sede_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SEDES: everyone can read
CREATE POLICY "Sedes: lectura para todos" ON sedes FOR SELECT USING (true);
CREATE POLICY "Sedes: admin puede modificar" ON sedes FOR ALL USING (get_user_role() = 'admin');

-- USERS: admin ve todo, otros solo su propio perfil
CREATE POLICY "Users: admin ve todos" ON users FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Users: ver propio perfil" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users: admin puede modificar" ON users FOR ALL USING (get_user_role() = 'admin');

-- COBRANZAS: admin ve todo, rolC ve solo su sede
CREATE POLICY "Cobranzas: admin ve todo" ON cobranzas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Cobranzas: rolC ve su sede" ON cobranzas FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Cobranzas: admin inserta" ON cobranzas FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "Cobranzas: rolC inserta en su sede" ON cobranzas FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Cobranzas: admin actualiza" ON cobranzas FOR UPDATE USING (get_user_role() = 'admin');

-- DEUDAS: admin ve todo, rolC ve su sede
CREATE POLICY "Deudas: admin ve todo" ON deudas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Deudas: rolC ve su sede" ON deudas FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Deudas: admin gestiona" ON deudas FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Deudas: rolC inserta en su sede" ON deudas FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- TURNOS: admin ve todo, rolA ve los que agendó, rolC ve su sede
CREATE POLICY "Turnos: admin ve todo" ON turnos FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Turnos: rolC ve su sede" ON turnos FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Turnos: rolA ve todos (lectura)" ON turnos FOR SELECT USING (get_user_role() = 'rolA');
CREATE POLICY "Turnos: admin inserta" ON turnos FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "Turnos: rolC inserta en su sede" ON turnos FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Turnos: rolA inserta" ON turnos FOR INSERT WITH CHECK (get_user_role() = 'rolA');
CREATE POLICY "Turnos: admin actualiza" ON turnos FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "Turnos: rolC actualiza su sede" ON turnos FOR UPDATE USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- TAREAS: admin ve todo, otros solo las suyas
CREATE POLICY "Tareas: admin ve todo" ON tareas FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Tareas: ver propias" ON tareas FOR SELECT USING (asignado_a = auth.uid());
CREATE POLICY "Tareas: admin gestiona" ON tareas FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Tareas: completar propias" ON tareas FOR UPDATE USING (asignado_a = auth.uid());

-- EMPLOYEES: admin gestiona, autenticados leen activos
CREATE POLICY "employees_admin_all" ON employees FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "employees_select_active" ON employees FOR SELECT USING (active = true);

-- HOUR_ENTRIES: admin gestiona todo, rolA CRUD propias
CREATE POLICY "hour_entries_admin_all" ON hour_entries FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "hour_entries_select_own" ON hour_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);
CREATE POLICY "hour_entries_insert_own" ON hour_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);
CREATE POLICY "hour_entries_update_own" ON hour_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);
CREATE POLICY "hour_entries_delete_own" ON hour_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);

-- CONFIG: todos leen, admin escribe
CREATE POLICY "config_select_all" ON config FOR SELECT USING (true);
CREATE POLICY "config_admin_write" ON config FOR ALL USING (get_user_role() = 'admin');

-- WEEKLY_APPROVALS: todos leen, admin escribe
CREATE POLICY "weekly_approvals_select_all" ON weekly_approvals FOR SELECT USING (true);
CREATE POLICY "weekly_approvals_admin_write" ON weekly_approvals FOR ALL USING (get_user_role() = 'admin');

-- PAYMENT_RECORDS: admin gestiona, rolA ve propios
CREATE POLICY "payment_records_admin_all" ON payment_records FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "payment_records_select_own" ON payment_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = payment_records.employee_id AND employees.gestion_user_id = auth.uid())
);

-- GASTOS: solo admin
CREATE POLICY "Gastos: solo admin" ON gastos FOR ALL USING (get_user_role() = 'admin');

-- EMPLEADOS_CONFIG: solo admin
CREATE POLICY "Empleados config: solo admin" ON empleados_config FOR ALL USING (get_user_role() = 'admin');

-- STOCK PRODUCTOS: admin ve todo, rolC ve su sede
CREATE POLICY "Stock: admin ve todo" ON productos_stock FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Stock: rolC ve su sede" ON productos_stock FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Stock: admin gestiona" ON productos_stock FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Stock: rolC actualiza su sede" ON productos_stock FOR UPDATE USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- MOVIMIENTOS STOCK: admin ve todo, rolC ve su sede
CREATE POLICY "Mov stock: admin ve todo" ON movimientos_stock FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Mov stock: rolC ve su sede" ON movimientos_stock FOR SELECT USING (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);
CREATE POLICY "Mov stock: admin inserta" ON movimientos_stock FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "Mov stock: rolC inserta en su sede" ON movimientos_stock FOR INSERT WITH CHECK (
  get_user_role() = 'rolC' AND sede_id = get_user_sede_id()
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_cobranzas_sede_fecha ON cobranzas(sede_id, fecha);
CREATE INDEX idx_cobranzas_fecha ON cobranzas(fecha);
CREATE INDEX idx_deudas_sede ON deudas(sede_id);
CREATE INDEX idx_deudas_estado ON deudas(estado);
CREATE INDEX idx_turnos_sede_fecha ON turnos(sede_id, fecha);
CREATE INDEX idx_turnos_fecha ON turnos(fecha);
CREATE INDEX idx_tareas_asignado ON tareas(asignado_a, fecha);
CREATE INDEX idx_tareas_fecha ON tareas(fecha);
CREATE INDEX idx_hour_entries_employee ON hour_entries(employee_id, date);
CREATE INDEX idx_employees_gestion_user ON employees(gestion_user_id);
CREATE INDEX idx_gastos_sede_fecha ON gastos(sede_id, fecha);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_stock_sede ON productos_stock(sede_id);
CREATE INDEX idx_mov_stock_producto ON movimientos_stock(producto_id);
CREATE INDEX idx_mov_stock_fecha ON movimientos_stock(fecha);
