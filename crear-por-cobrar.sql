-- Tabla para almacenar deudas de tratamientos y cuotas pendientes desde Dentalink
CREATE TABLE IF NOT EXISTS por_cobrar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tratamiento INTEGER NOT NULL,
  id_paciente INTEGER NOT NULL,
  nombre_paciente TEXT NOT NULL,
  nombre_tratamiento TEXT,
  id_sucursal INTEGER,
  nombre_sucursal TEXT,
  sede_id UUID,
  -- Montos
  fecha_vencimiento DATE,           -- NULL si no tiene plan de cuotas
  monto NUMERIC NOT NULL DEFAULT 0, -- total de la cuota o deuda
  pagado NUMERIC NOT NULL DEFAULT 0,
  saldo NUMERIC NOT NULL DEFAULT 0, -- lo que falta cobrar
  -- Cuota info (NULL si es deuda general sin plan)
  numero_cuota INTEGER,
  total_cuotas INTEGER,
  -- Meta
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_por_cobrar_fecha ON por_cobrar(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_por_cobrar_sede ON por_cobrar(sede_id);
CREATE INDEX IF NOT EXISTS idx_por_cobrar_paciente ON por_cobrar(id_paciente);

-- RLS
ALTER TABLE por_cobrar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "por_cobrar_select" ON por_cobrar FOR SELECT TO authenticated USING (true);
CREATE POLICY "por_cobrar_insert" ON por_cobrar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "por_cobrar_update" ON por_cobrar FOR UPDATE TO authenticated USING (true);
CREATE POLICY "por_cobrar_delete" ON por_cobrar FOR DELETE TO authenticated USING (true);
