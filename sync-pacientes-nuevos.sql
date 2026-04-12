-- ============================================================
-- Tabla: pacientes_nuevos
-- Almacena pacientes con su fecha de alta (fecha_afiliacion)
-- para consultar "turnos dados" sin depender de la API en vivo.
--
-- Ejecutar en SQL Editor de Supabase (proyecto gestion)
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_pacientes_nuevos_fecha ON pacientes_nuevos(fecha_afiliacion);

-- RLS
ALTER TABLE pacientes_nuevos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pacientes_nuevos_select" ON pacientes_nuevos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pacientes_nuevos_insert" ON pacientes_nuevos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pacientes_nuevos_update" ON pacientes_nuevos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "pacientes_nuevos_delete" ON pacientes_nuevos
  FOR DELETE TO authenticated USING (true);
