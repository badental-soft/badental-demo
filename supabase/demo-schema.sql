-- ============================================================
-- Odonto Gestión — Schema completo para instancia DEMO
-- Ejecutar en Supabase SQL Editor del proyecto demo (una sola vez).
-- Es seguro re-ejecutar: usa IF NOT EXISTS donde se puede.
-- ============================================================

-- =====================
-- 1. ENUMS
-- =====================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'rolA', 'rolB', 'rolC', 'rolD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_pago AS ENUM ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_deuda AS ENUM ('pendiente', 'parcial', 'pagado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_turno AS ENUM ('agendado', 'atendido', 'no_asistio', 'cancelado', 'reprogramado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE origen_turno AS ENUM ('web', 'whatsapp', 'telefono', 'instagram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_hora AS ENUM ('pendiente', 'aprobada', 'pagada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_gasto AS ENUM ('fijo', 'variable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_pago_empleado AS ENUM ('fijo', 'comision', 'fijo_bono', 'por_hora');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimiento_stock AS ENUM ('entrada', 'salida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_laboratorio AS ENUM (
    'escaneado','enviada','en_proceso','retirada','colocada','a_revisar'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =====================
-- 2. SEDES
-- =====================
CREATE TABLE IF NOT EXISTS sedes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  activa BOOLEAN DEFAULT true
);


-- =====================
-- 3. USERS (perfil extendido)
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'rolC',
  sede_id UUID REFERENCES sedes(id),
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 4. COBRANZAS
-- =====================
CREATE TABLE IF NOT EXISTS cobranzas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sede_id UUID REFERENCES sedes(id),
  sede_ids UUID[] DEFAULT '{}',
  user_id UUID REFERENCES users(id),
  paciente TEXT NOT NULL,
  tratamiento TEXT NOT NULL,
  tipo_pago tipo_pago NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  es_cuota BOOLEAN DEFAULT false,
  notas TEXT,
  dentalink_id INTEGER,
  moneda TEXT DEFAULT 'ARS',
  monto_original DECIMAL(12,2),
  tipo_cambio DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 5. DEUDAS (Por Cobrar)
-- =====================
CREATE TABLE IF NOT EXISTS deudas (
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


-- =====================
-- 6. TURNOS
-- =====================
CREATE TABLE IF NOT EXISTS turnos (
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
CREATE UNIQUE INDEX IF NOT EXISTS turnos_dentalink_id_unique
  ON turnos (dentalink_id) WHERE dentalink_id IS NOT NULL;


-- =====================
-- 7. TAREAS (legacy, tabla puntual)
-- =====================
CREATE TABLE IF NOT EXISTS tareas (
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


-- =====================
-- 8. EMPLOYEES + HORAS
-- =====================
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  gestion_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hour_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 9. GASTOS
-- =====================
CREATE TABLE IF NOT EXISTS gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  sede_id UUID REFERENCES sedes(id),
  sede_ids UUID[] DEFAULT '{}',
  user_id UUID REFERENCES users(id),
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  tipo tipo_gasto NOT NULL DEFAULT 'variable',
  estado TEXT DEFAULT 'pendiente',
  pagado_por TEXT,
  tipo_pago TEXT,
  moneda TEXT DEFAULT 'ARS',
  monto_original DECIMAL(12,2),
  tipo_cambio DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 10. EMPLEADOS CONFIG
-- =====================
CREATE TABLE IF NOT EXISTS empleados_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  rol user_role NOT NULL,
  sede_id UUID REFERENCES sedes(id),
  tipo_pago tipo_pago_empleado NOT NULL DEFAULT 'fijo',
  detalle_pago JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true
);


-- =====================
-- 11. STOCK (productos y movimientos)
--   nota: stock actual = sum(entradas) - sum(salidas) por producto/sede
-- =====================
CREATE TABLE IF NOT EXISTS stock_productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  medida TEXT,
  unidad TEXT NOT NULL DEFAULT 'unidades',
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  precio_compra DECIMAL(12,2),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nombre, medida)
);

CREATE TABLE IF NOT EXISTS stock_movimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES stock_productos(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES sedes(id),
  tipo tipo_movimiento_stock NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  descripcion TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =====================
-- 12. TAREAS (plantillas + completado diario)
-- =====================
CREATE TABLE IF NOT EXISTS tarea_plantillas (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  rol user_role NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tarea_completadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plantilla_id INTEGER NOT NULL REFERENCES tarea_plantillas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  completada BOOLEAN DEFAULT true,
  completada_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, plantilla_id, fecha)
);


-- =====================
-- 13. PACIENTES NUEVOS (sync Dentalink — vacío en demo)
-- =====================
CREATE TABLE IF NOT EXISTS pacientes_nuevos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_dentalink INTEGER NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  fecha_afiliacion DATE NOT NULL,
  primera_cita_fecha DATE,
  primera_cita_hora TEXT,
  primera_cita_profesional TEXT,
  primera_cita_sede TEXT,
  primera_cita_id_sucursal INTEGER,
  primera_cita_comentario TEXT,
  origen TEXT DEFAULT 'Otro',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================
-- 13b. POR COBRAR (tratamientos con deuda activa — feed del tab "Por Cobrar")
-- =====================
CREATE TABLE IF NOT EXISTS por_cobrar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tratamiento INTEGER,
  id_paciente INTEGER,
  nombre_paciente TEXT NOT NULL,
  nombre_tratamiento TEXT NOT NULL,
  id_sucursal INTEGER,
  nombre_sucursal TEXT,
  sede_id UUID REFERENCES sedes(id),
  fecha_vencimiento DATE,
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  pagado DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo DECIMAL(12,2) NOT NULL DEFAULT 0,
  numero_cuota INTEGER,
  total_cuotas INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =====================
-- 14. LABORATORIO
-- =====================
CREATE TABLE IF NOT EXISTS laboratorio_casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente TEXT NOT NULL,
  sede_id UUID REFERENCES sedes(id),
  profesional TEXT,
  tipo TEXT NOT NULL DEFAULT 'corona',
  laboratorio TEXT,
  estado estado_laboratorio NOT NULL DEFAULT 'escaneado',
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laboratorio_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id UUID NOT NULL REFERENCES laboratorio_casos(id) ON DELETE CASCADE,
  estado_anterior estado_laboratorio,
  estado_nuevo estado_laboratorio NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================
-- ÍNDICES de performance
-- =====================
CREATE INDEX IF NOT EXISTS idx_cobranzas_sede_fecha ON cobranzas(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_cobranzas_fecha ON cobranzas(fecha);
CREATE INDEX IF NOT EXISTS idx_deudas_sede ON deudas(sede_id);
CREATE INDEX IF NOT EXISTS idx_deudas_estado ON deudas(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_sede_fecha ON turnos(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON tareas(asignado_a, fecha);
CREATE INDEX IF NOT EXISTS idx_hour_entries_employee ON hour_entries(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_gastos_sede_fecha ON gastos(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_stock_mov_producto ON stock_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_fecha ON stock_movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_lab_casos_estado ON laboratorio_casos(estado);
CREATE INDEX IF NOT EXISTS idx_lab_casos_sede ON laboratorio_casos(sede_id);
CREATE INDEX IF NOT EXISTS idx_tarea_completadas_user_fecha ON tarea_completadas(user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_pacientes_nuevos_fecha ON pacientes_nuevos(fecha_afiliacion);


-- =====================
-- Helper functions (role + sede)
-- =====================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT rol FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_sede_id()
RETURNS UUID AS $$
  SELECT sede_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =====================
-- Trigger para laboratorio.updated_at
-- =====================
CREATE OR REPLACE FUNCTION update_laboratorio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_laboratorio_updated_at ON laboratorio_casos;
CREATE TRIGGER trg_laboratorio_updated_at
  BEFORE UPDATE ON laboratorio_casos
  FOR EACH ROW
  EXECUTE FUNCTION update_laboratorio_updated_at();


-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE stock_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarea_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarea_completadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes_nuevos ENABLE ROW LEVEL SECURITY;
ALTER TABLE por_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratorio_casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratorio_historial ENABLE ROW LEVEL SECURITY;

-- Helper para dropear políticas existentes al re-ejecutar
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- SEDES: lectura libre autenticados, admin escribe
CREATE POLICY "sedes_read" ON sedes FOR SELECT TO authenticated USING (true);
CREATE POLICY "sedes_admin_write" ON sedes FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- USERS: admin ve todo, cada uno ve su perfil
CREATE POLICY "users_admin_select" ON users FOR SELECT TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "users_own_select" ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "users_admin_write" ON users FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "users_own_update" ON users FOR UPDATE TO authenticated USING (id = auth.uid());

-- COBRANZAS: admin total; resto lectura (permisiva para demo)
CREATE POLICY "cobranzas_admin_all" ON cobranzas FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "cobranzas_read" ON cobranzas FOR SELECT TO authenticated USING (true);

-- DEUDAS
CREATE POLICY "deudas_admin_all" ON deudas FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "deudas_read" ON deudas FOR SELECT TO authenticated USING (true);

-- TURNOS
CREATE POLICY "turnos_admin_all" ON turnos FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "turnos_read" ON turnos FOR SELECT TO authenticated USING (true);
CREATE POLICY "turnos_rolA_insert" ON turnos FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('rolA', 'rolC'));
CREATE POLICY "turnos_rolA_update" ON turnos FOR UPDATE TO authenticated USING (get_user_role() IN ('rolA', 'rolC'));

-- TAREAS legacy
CREATE POLICY "tareas_admin_all" ON tareas FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "tareas_own_read" ON tareas FOR SELECT TO authenticated USING (asignado_a = auth.uid());
CREATE POLICY "tareas_own_update" ON tareas FOR UPDATE TO authenticated USING (asignado_a = auth.uid());

-- EMPLOYEES / HORAS
CREATE POLICY "employees_admin_all" ON employees FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "employees_select_active" ON employees FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "hour_entries_admin_all" ON hour_entries FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "hour_entries_select_own" ON hour_entries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);
CREATE POLICY "hour_entries_insert_own" ON hour_entries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);
CREATE POLICY "hour_entries_update_own" ON hour_entries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = hour_entries.employee_id AND employees.gestion_user_id = auth.uid())
);

-- CONFIG / WEEKLY / PAYMENT
CREATE POLICY "config_read" ON config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_admin_write" ON config FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "weekly_approvals_read" ON weekly_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "weekly_approvals_admin_write" ON weekly_approvals FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "payment_records_admin_all" ON payment_records FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "payment_records_select_own" ON payment_records FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = payment_records.employee_id AND employees.gestion_user_id = auth.uid())
);

-- GASTOS
CREATE POLICY "gastos_admin_all" ON gastos FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- EMPLEADOS CONFIG
CREATE POLICY "empleados_config_admin_all" ON empleados_config FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "empleados_config_own_read" ON empleados_config FOR SELECT TO authenticated USING (user_id = auth.uid());

-- STOCK
CREATE POLICY "stock_productos_read" ON stock_productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_productos_admin_write" ON stock_productos FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "stock_mov_read" ON stock_movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_mov_write" ON stock_movimientos FOR ALL TO authenticated USING (
  get_user_role() IN ('admin', 'rolC', 'rolD')
);

-- TAREAS (plantillas + completadas)
CREATE POLICY "tarea_plantillas_read" ON tarea_plantillas FOR SELECT TO authenticated USING (true);
CREATE POLICY "tarea_plantillas_admin_write" ON tarea_plantillas FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "tarea_completadas_admin_all" ON tarea_completadas FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "tarea_completadas_own_all" ON tarea_completadas FOR ALL TO authenticated USING (user_id = auth.uid());

-- PACIENTES NUEVOS
CREATE POLICY "pacientes_nuevos_read" ON pacientes_nuevos FOR SELECT TO authenticated USING (true);
CREATE POLICY "pacientes_nuevos_admin_write" ON pacientes_nuevos FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- POR COBRAR
CREATE POLICY "por_cobrar_read" ON por_cobrar FOR SELECT TO authenticated USING (true);
CREATE POLICY "por_cobrar_admin_write" ON por_cobrar FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- LABORATORIO
CREATE POLICY "laboratorio_casos_read" ON laboratorio_casos FOR SELECT TO authenticated USING (true);
CREATE POLICY "laboratorio_casos_admin_write" ON laboratorio_casos FOR ALL TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY "laboratorio_historial_read" ON laboratorio_historial FOR SELECT TO authenticated USING (true);
CREATE POLICY "laboratorio_historial_admin_write" ON laboratorio_historial FOR ALL TO authenticated USING (get_user_role() = 'admin');
