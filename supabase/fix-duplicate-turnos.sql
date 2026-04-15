-- Fix: limpiar turnos duplicados y agregar constraint para prevenir futuros
-- Ejecutar en Supabase SQL Editor ANTES del deploy

-- 1. Ver cuántos duplicados hay (solo para diagnóstico)
SELECT dentalink_id, COUNT(*) as cantidad
FROM turnos
WHERE dentalink_id IS NOT NULL
GROUP BY dentalink_id
HAVING COUNT(*) > 1
LIMIT 20;

-- 2. Borrar duplicados: quedarse solo con el más reciente por dentalink_id
DELETE FROM turnos
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY dentalink_id ORDER BY created_at DESC) as rn
    FROM turnos
    WHERE dentalink_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- 3. Agregar unique constraint para que no vuelva a pasar
CREATE UNIQUE INDEX IF NOT EXISTS turnos_dentalink_id_unique
ON turnos (dentalink_id)
WHERE dentalink_id IS NOT NULL;
