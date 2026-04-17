-- ============================================================
-- Odonto Gestión — SEED DEMO
--
-- Ejecutar DESPUÉS de demo-schema.sql, en Supabase SQL Editor.
-- Requisito previo: crear el usuario admin en Authentication > Users:
--   email:    admin@odontogestion.com
--   password: demo1234
--   ☐ Auto Confirm User  (tildar)
--
-- Datos generados (aprox):
--   2 sedes ficticias · 1 admin · 4 empleados · 10 plantillas tareas
--   80 turnos (pasados, hoy, futuros, todos los estados)
--   120 cobranzas · 12 deudas · 25 gastos
--   15 productos de stock + 60 movimientos
--   8 casos de laboratorio en distintos estados
--   horas cargadas de domingos del mes
-- ============================================================

-- Si querés resetear: TRUNCATE todas las tablas excepto users/auth.
-- (Se dejan comentados por seguridad — descomentar para resetear.)
-- TRUNCATE cobranzas, deudas, turnos, gastos, stock_movimientos, stock_productos,
--          tarea_completadas, hour_entries, laboratorio_historial, laboratorio_casos,
--          employees, empleados_config, pacientes_nuevos CASCADE;

-- =========================================
-- 1. SEDES ficticias
-- =========================================
INSERT INTO sedes (id, nombre, direccion, activa) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Clínica Centro', 'Av. Santa Fe 1234, CABA', true),
  ('22222222-2222-2222-2222-222222222222', 'Clínica Norte', 'Av. Cabildo 4567, CABA', true)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 2. USER ADMIN (referenciado por empleados/turnos/cobranzas)
--    El registro users.id tiene que existir ANTES de insertar relacionados.
--    Suponemos que ya creaste admin@odontogestion.com en Auth.
-- =========================================
INSERT INTO users (id, email, nombre, rol, sede_id, must_change_password)
SELECT id, 'admin@odontogestion.com', 'Administrador Demo', 'admin', NULL, false
FROM auth.users
WHERE email = 'admin@odontogestion.com'
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  rol = EXCLUDED.rol,
  must_change_password = false;

-- Variable auxiliar con el id admin (para insertar referencias)
-- Envolvemos la lógica en una función reusable para que el botón "Resetear demo"
-- pueda volver a poblar los datos sin re-correr el archivo manualmente.
CREATE OR REPLACE FUNCTION reset_demo_data()
RETURNS TEXT AS $reset$
DECLARE
  admin_id UUID;
  sede_centro UUID := '11111111-1111-1111-1111-111111111111';
  sede_norte  UUID := '22222222-2222-2222-2222-222222222222';
  d DATE;
  i INT;
  prod_id UUID;
  cof_id UUID;
  sond_id UUID;
  guantes_id UUID;
  ba_id UUID;
  cep_id UUID;
  mec_id UUID;
  alg_id UUID;
  past_id UUID;
  res_id UUID;
  anes_id UUID;
  jer_id UUID;
  gasa_id UUID;
  pul_id UUID;
  sut_id UUID;
  cem_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'admin@odontogestion.com' LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Falta crear el usuario admin@odontogestion.com en Supabase Auth antes de correr el seed.';
  END IF;

  -- =========================================
  -- LIMPIAR datos previos para reset idempotente
  -- (no toca sedes/users/auth; esos se preservan)
  -- =========================================
  DELETE FROM laboratorio_historial;
  DELETE FROM laboratorio_casos;
  DELETE FROM tarea_completadas;
  DELETE FROM hour_entries;
  DELETE FROM payment_records;
  DELETE FROM stock_movimientos;
  DELETE FROM stock_productos;
  DELETE FROM gastos;
  DELETE FROM cobranzas;
  DELETE FROM deudas;
  DELETE FROM turnos;
  DELETE FROM tareas;
  DELETE FROM empleados_config;
  DELETE FROM employees;
  DELETE FROM pacientes_nuevos;
  DELETE FROM por_cobrar;
  DELETE FROM tarea_plantillas;

  INSERT INTO tarea_plantillas (titulo, categoria, rol, orden, activa) VALUES
    ('Enviar recordatorios a turnos de hoy', 'agenda', 'rolA', 1, true),
    ('Responder chats pendientes de WhatsApp', 'mensajes', 'rolA', 2, true),
    ('Confirmar turnos de mañana', 'cierre', 'rolA', 3, true),
    ('Presentar presupuesto al paciente', 'venta', 'rolB', 1, true),
    ('Cerrar venta y registrar seña', 'venta', 'rolB', 2, true),
    ('Llamar al paciente 24hs después de cirugía', 'seguimiento', 'rolB', 3, true),
    ('Revisar agenda del día siguiente', 'recepcion', 'rolC', 1, true),
    ('Cierre de caja al finalizar el día', 'admin', 'rolC', 2, true),
    ('Esterilizar instrumental', 'higiene', 'rolD', 1, true),
    ('Controlar stock de materiales', 'stock', 'rolD', 2, true);

  -- =========================================
  -- 4. STOCK — productos
  -- =========================================
  INSERT INTO stock_productos (nombre, medida, unidad, stock_minimo, precio_compra) VALUES
    ('Guantes de látex', 'Talle M', 'cajas', 5, 4800),
    ('Barbijos descartables', 'N95', 'cajas', 10, 3200),
    ('Cepillos profilácticos', NULL, 'unidades', 20, 180),
    ('Anestesia carpule', 'Lidocaína 2%', 'cajas', 4, 12500),
    ('Jeringas descartables', '5 ml', 'unidades', 30, 45),
    ('Gasas estériles', '7.5x7.5', 'paquetes', 15, 680),
    ('Puntas de pulir', NULL, 'unidades', 25, 320),
    ('Hilo de sutura', 'Seda 4-0', 'sobres', 8, 1500),
    ('Cemento provisorio', NULL, 'unidades', 6, 3800),
    ('Composite fluido', 'A2', 'jeringas', 10, 2400),
    ('Algodón hidrófilo', '500g', 'paquetes', 8, 950),
    ('Pasta profiláctica', NULL, 'frascos', 12, 750),
    ('Resina compuesta', 'A3', 'jeringas', 8, 4200),
    ('Mechero de alcohol', NULL, 'unidades', 3, 2800),
    ('Sondas periodontales', NULL, 'unidades', 4, 6800)
  ON CONFLICT (nombre, medida) DO NOTHING;

  -- Guardar IDs para movimientos
  SELECT id INTO guantes_id FROM stock_productos WHERE nombre = 'Guantes de látex' LIMIT 1;
  SELECT id INTO ba_id     FROM stock_productos WHERE nombre = 'Barbijos descartables' LIMIT 1;
  SELECT id INTO cep_id    FROM stock_productos WHERE nombre = 'Cepillos profilácticos' LIMIT 1;
  SELECT id INTO anes_id   FROM stock_productos WHERE nombre = 'Anestesia carpule' LIMIT 1;
  SELECT id INTO jer_id    FROM stock_productos WHERE nombre = 'Jeringas descartables' LIMIT 1;
  SELECT id INTO gasa_id   FROM stock_productos WHERE nombre = 'Gasas estériles' LIMIT 1;
  SELECT id INTO pul_id    FROM stock_productos WHERE nombre = 'Puntas de pulir' LIMIT 1;
  SELECT id INTO sut_id    FROM stock_productos WHERE nombre = 'Hilo de sutura' LIMIT 1;
  SELECT id INTO cem_id    FROM stock_productos WHERE nombre = 'Cemento provisorio' LIMIT 1;
  SELECT id INTO mec_id    FROM stock_productos WHERE nombre = 'Mechero de alcohol' LIMIT 1;
  SELECT id INTO alg_id    FROM stock_productos WHERE nombre = 'Algodón hidrófilo' LIMIT 1;
  SELECT id INTO past_id   FROM stock_productos WHERE nombre = 'Pasta profiláctica' LIMIT 1;
  SELECT id INTO res_id    FROM stock_productos WHERE nombre = 'Resina compuesta' LIMIT 1;
  SELECT id INTO sond_id   FROM stock_productos WHERE nombre = 'Sondas periodontales' LIMIT 1;
  SELECT id INTO cof_id    FROM stock_productos WHERE nombre = 'Composite fluido' LIMIT 1;

  -- Movimientos de stock variados (entradas y salidas en ambas sedes)
  INSERT INTO stock_movimientos (producto_id, sede_id, tipo, cantidad, descripcion, fecha, created_by) VALUES
    (guantes_id, sede_centro, 'entrada', 20, 'Compra mensual', CURRENT_DATE - INTERVAL '20 days', admin_id),
    (guantes_id, sede_centro, 'salida',   8, 'Uso diario',     CURRENT_DATE - INTERVAL '18 days', admin_id),
    (guantes_id, sede_norte,  'entrada', 15, 'Compra mensual', CURRENT_DATE - INTERVAL '20 days', admin_id),
    (guantes_id, sede_norte,  'salida',   6, 'Uso diario',     CURRENT_DATE - INTERVAL '10 days', admin_id),
    (ba_id,      sede_centro, 'entrada', 25, 'Compra',         CURRENT_DATE - INTERVAL '25 days', admin_id),
    (ba_id,      sede_centro, 'salida',  12, 'Consumo',        CURRENT_DATE - INTERVAL '15 days', admin_id),
    (ba_id,      sede_norte,  'entrada', 20, 'Compra',         CURRENT_DATE - INTERVAL '25 days', admin_id),
    (cep_id,     sede_centro, 'entrada', 50, 'Stock inicial',  CURRENT_DATE - INTERVAL '30 days', admin_id),
    (cep_id,     sede_centro, 'salida',  18, 'Consumo',        CURRENT_DATE - INTERVAL '10 days', admin_id),
    (cep_id,     sede_norte,  'entrada', 40, 'Compra',         CURRENT_DATE - INTERVAL '28 days', admin_id),
    (anes_id,    sede_centro, 'entrada', 10, 'Compra',         CURRENT_DATE - INTERVAL '15 days', admin_id),
    (anes_id,    sede_centro, 'salida',   7, 'Uso',            CURRENT_DATE - INTERVAL '5 days',  admin_id),
    (anes_id,    sede_norte,  'entrada',  8, 'Compra',         CURRENT_DATE - INTERVAL '15 days', admin_id),
    (jer_id,     sede_centro, 'entrada',100, 'Compra mayorista',CURRENT_DATE - INTERVAL '35 days',admin_id),
    (jer_id,     sede_centro, 'salida',  40, 'Uso',            CURRENT_DATE - INTERVAL '10 days', admin_id),
    (gasa_id,    sede_centro, 'entrada', 30, 'Compra',         CURRENT_DATE - INTERVAL '22 days', admin_id),
    (gasa_id,    sede_centro, 'salida',  20, 'Uso',            CURRENT_DATE - INTERVAL '8 days',  admin_id),
    (pul_id,     sede_centro, 'entrada', 60, 'Compra',         CURRENT_DATE - INTERVAL '40 days', admin_id),
    (pul_id,     sede_centro, 'salida',  38, 'Uso',            CURRENT_DATE - INTERVAL '15 days', admin_id),
    (sut_id,     sede_centro, 'entrada', 15, 'Compra',         CURRENT_DATE - INTERVAL '10 days', admin_id),
    (sut_id,     sede_centro, 'salida',   9, 'Cirugías',       CURRENT_DATE - INTERVAL '3 days',  admin_id),
    (cem_id,     sede_centro, 'entrada',  8, 'Compra',         CURRENT_DATE - INTERVAL '20 days', admin_id),
    (cem_id,     sede_centro, 'salida',   5, 'Coronas',        CURRENT_DATE - INTERVAL '7 days',  admin_id),
    (mec_id,     sede_centro, 'entrada',  3, 'Compra',         CURRENT_DATE - INTERVAL '60 days', admin_id),
    (mec_id,     sede_centro, 'salida',   2, 'Uso',            CURRENT_DATE - INTERVAL '45 days', admin_id),
    (alg_id,     sede_centro, 'entrada', 12, 'Compra',         CURRENT_DATE - INTERVAL '18 days', admin_id),
    (past_id,    sede_centro, 'entrada', 20, 'Compra',         CURRENT_DATE - INTERVAL '25 days', admin_id),
    (past_id,    sede_centro, 'salida',   9, 'Uso',            CURRENT_DATE - INTERVAL '10 days', admin_id),
    (res_id,     sede_centro, 'entrada', 12, 'Compra',         CURRENT_DATE - INTERVAL '22 days', admin_id),
    (res_id,     sede_centro, 'salida',   4, 'Restauraciones', CURRENT_DATE - INTERVAL '6 days',  admin_id),
    (sond_id,    sede_centro, 'entrada',  6, 'Compra',         CURRENT_DATE - INTERVAL '50 days', admin_id),
    (sond_id,    sede_centro, 'salida',   3, 'Reemplazo',      CURRENT_DATE - INTERVAL '30 days', admin_id),
    (cof_id,     sede_centro, 'entrada', 15, 'Compra',         CURRENT_DATE - INTERVAL '15 days', admin_id),
    (cof_id,     sede_centro, 'salida',   6, 'Uso',            CURRENT_DATE - INTERVAL '5 days',  admin_id);

  -- =========================================
  -- 5. TURNOS — ~350 turnos distribuidos en ±14 días (~12 por día)
  -- =========================================
  FOR i IN 0..349 LOOP
    d := CURRENT_DATE + ((i % 29) - 14);  -- desde hace 14 días hasta +14
    INSERT INTO turnos (fecha, hora, sede_id, paciente, profesional, estado, origen)
    VALUES (
      d,
      (TIME '09:00' + (((i / 29) % 10) || ' hours')::INTERVAL + ((i % 2) * 30 || ' minutes')::INTERVAL),
      CASE WHEN i % 2 = 0 THEN sede_centro ELSE sede_norte END,
      (ARRAY[
        'Martínez, Laura', 'González, Pablo', 'Ramírez, Sofía', 'López, Carlos',
        'Fernández, Ana', 'Rodríguez, Diego', 'Sánchez, María', 'Pérez, Juan',
        'Castro, Lucía', 'Torres, Miguel', 'Flores, Carolina', 'Ruiz, Andrés',
        'Álvarez, Camila', 'Morales, Tomás', 'Ortiz, Valentina', 'Silva, Federico',
        'Romero, Paula', 'Vargas, Sebastián', 'Giménez, Martina', 'Herrera, Lucas',
        'Acosta, Julieta', 'Domínguez, Nicolás', 'Núñez, Florencia', 'Molina, Esteban',
        'Medina, Brenda', 'Paz, Rodrigo', 'Cabrera, Agustina', 'Luna, Matías',
        'Sosa, Gabriela', 'Figueroa, Emilio', 'Juárez, Renata', 'Villalba, Ignacio',
        'Ayala, Micaela', 'Ponce, Ezequiel', 'Ríos, Antonella', 'Mansilla, Bruno',
        'Navarro, Carla', 'Ledesma, Franco', 'Peralta, Daniela', 'Farías, Joaquín'
      ])[(i % 40) + 1],
      (ARRAY[
        'Dra. Benítez', 'Dr. Martínez', 'Dra. Suárez', 'Dr. Ojeda',
        'Dra. Ledesma', 'Dr. Quiroga', 'Dra. Romero', 'Dr. Paredes'
      ])[(i % 8) + 1],
      (CASE
         WHEN d < CURRENT_DATE AND i % 10 < 7 THEN 'atendido'
         WHEN d < CURRENT_DATE AND i % 10 = 7 THEN 'no_asistio'
         WHEN d < CURRENT_DATE AND i % 10 = 8 THEN 'cancelado'
         WHEN d < CURRENT_DATE AND i % 10 = 9 THEN 'reprogramado'
         ELSE 'agendado'
       END)::estado_turno,
      (ARRAY['whatsapp','web','telefono','instagram'])[(i % 4) + 1]::origen_turno
    );
  END LOOP;

  -- =========================================
  -- 5b. PACIENTES NUEVOS — ~150 altas en últimos 30 días (~5 por día)
  --     feed del tab "Turnos Dados"
  -- =========================================
  FOR i IN 0..149 LOOP
    d := CURRENT_DATE - ((i % 30) || ' days')::INTERVAL;
    INSERT INTO pacientes_nuevos (
      id_dentalink, nombre, fecha_afiliacion,
      primera_cita_fecha, primera_cita_hora, primera_cita_profesional,
      primera_cita_sede, primera_cita_id_sucursal, origen
    ) VALUES (
      100000 + i,
      (ARRAY[
        'García, Melina', 'Fernández, Joaquín', 'Pérez, Valeria', 'Luna, Tobías',
        'Ruiz, Camila', 'Sosa, Benjamín', 'Díaz, Agustina', 'Álvarez, Thiago',
        'Romero, Francisca', 'Morales, Bautista', 'Ortiz, Mía', 'Silva, Santiago',
        'Castro, Emma', 'Torres, Lautaro', 'Flores, Isabella', 'Giménez, Noah',
        'Herrera, Olivia', 'Vargas, León', 'Cabrera, Zoe', 'Molina, Felipe',
        'Medina, Bianca', 'Paz, Valentino', 'Ayala, Catalina', 'Ponce, Vicente',
        'Ríos, Amanda', 'Ledesma, Simón', 'Peralta, Celeste', 'Farías, Dylan',
        'Navarro, Antonia', 'Juárez, Ciro'
      ])[(i % 30) + 1],
      d,
      d + ((1 + (i % 5)) || ' days')::INTERVAL,
      LPAD(((9 + (i % 8)))::TEXT, 2, '0') || ':' || (CASE WHEN i % 2 = 0 THEN '00' ELSE '30' END),
      (ARRAY[
        'Dra. Benítez', 'Dr. Martínez', 'Dra. Suárez', 'Dr. Ojeda',
        'Dra. Ledesma', 'Dr. Quiroga'
      ])[(i % 6) + 1],
      CASE WHEN i % 2 = 0 THEN 'Clínica Centro' ELSE 'Clínica Norte' END,
      CASE WHEN i % 2 = 0 THEN 1 ELSE 2 END,
      (ARRAY['Instagram', 'WhatsApp', 'Google', 'Referido', 'Web', 'Facebook', 'Otro'])[(i % 7) + 1]
    );
  END LOOP;

  -- =========================================
  -- 5c. POR COBRAR — 25 tratamientos con saldo pendiente
  --     (distinto de 'deudas'; feed del tab Por Cobrar)
  -- =========================================
  FOR i IN 0..24 LOOP
    INSERT INTO por_cobrar (
      id_tratamiento, id_paciente, nombre_paciente, nombre_tratamiento,
      id_sucursal, nombre_sucursal, sede_id,
      fecha_vencimiento, monto, pagado, saldo,
      numero_cuota, total_cuotas
    ) VALUES (
      500000 + i,
      700000 + i,
      (ARRAY[
        'Martínez, Laura', 'González, Pablo', 'Ramírez, Sofía', 'López, Carlos',
        'Fernández, Ana', 'Rodríguez, Diego', 'Sánchez, María', 'Pérez, Juan',
        'Castro, Lucía', 'Torres, Miguel', 'Flores, Carolina', 'Ruiz, Andrés',
        'Álvarez, Camila', 'Morales, Tomás', 'Ortiz, Valentina', 'Silva, Federico',
        'Romero, Paula', 'Vargas, Sebastián', 'Giménez, Martina', 'Herrera, Lucas',
        'Acosta, Julieta', 'Domínguez, Nicolás', 'Núñez, Florencia', 'Molina, Esteban',
        'Medina, Brenda'
      ])[(i % 25) + 1],
      (ARRAY[
        'Ortodoncia invisible — cuota 4/12',
        'Implante óseo integrado',
        'Blanqueamiento láser',
        'Endodoncia molar',
        'Corona de porcelana',
        'Prótesis removible superior',
        'Cirugía de cordales',
        '2 implantes',
        'Tratamiento de conducto',
        'Prótesis fija 3 piezas',
        'Ortodoncia (cuota 2/12)',
        'Implante + corona'
      ])[(i % 12) + 1],
      CASE WHEN i % 2 = 0 THEN 1 ELSE 2 END,
      CASE WHEN i % 2 = 0 THEN 'Clínica Centro' ELSE 'Clínica Norte' END,
      CASE WHEN i % 2 = 0 THEN sede_centro ELSE sede_norte END,
      (CASE
         WHEN i % 5 = 0 THEN NULL
         WHEN i % 5 = 1 THEN CURRENT_DATE - ((i % 7) || ' days')::INTERVAL
         WHEN i % 5 = 2 THEN CURRENT_DATE
         ELSE CURRENT_DATE + (((i % 25) + 1) || ' days')::INTERVAL
       END)::DATE,
      (ARRAY[480000, 620000, 85000, 185000, 215000, 320000, 260000, 720000, 140000, 540000, 95000, 380000])[(i % 12) + 1],
      (ARRAY[120000, 310000, 0, 60000, 90000, 160000, 100000, 240000, 40000, 220000, 25000, 190000])[(i % 12) + 1],
      (ARRAY[360000, 310000, 85000, 125000, 125000, 160000, 160000, 480000, 100000, 320000, 70000, 190000])[(i % 12) + 1],
      CASE WHEN i % 3 = 0 THEN (i % 12) + 1 ELSE NULL END,
      CASE WHEN i % 3 = 0 THEN 12 ELSE NULL END
    );
  END LOOP;

  -- =========================================
  -- 6. COBRANZAS — 250 cobranzas en últimos 30 días (~8 por día)
  -- =========================================
  FOR i IN 0..249 LOOP
    d := CURRENT_DATE - ((i % 30) || ' days')::INTERVAL;
    INSERT INTO cobranzas (fecha, sede_id, sede_ids, user_id, paciente, tratamiento, tipo_pago, monto, es_cuota, moneda)
    VALUES (
      d,
      CASE WHEN i % 2 = 0 THEN sede_centro ELSE sede_norte END,
      ARRAY[CASE WHEN i % 2 = 0 THEN sede_centro ELSE sede_norte END],
      admin_id,
      (ARRAY[
        'Martínez, Laura', 'González, Pablo', 'Ramírez, Sofía', 'López, Carlos',
        'Fernández, Ana', 'Rodríguez, Diego', 'Sánchez, María', 'Pérez, Juan',
        'Castro, Lucía', 'Torres, Miguel', 'Flores, Carolina', 'Ruiz, Andrés',
        'Álvarez, Camila', 'Morales, Tomás', 'Ortiz, Valentina', 'Silva, Federico'
      ])[(i % 16) + 1],
      (ARRAY[
        'Limpieza profunda', 'Conducto molar', 'Blanqueamiento', 'Implante dental',
        'Corona de porcelana', 'Extracción simple', 'Ortodoncia (cuota)',
        'Endodoncia', 'Obturación estética', 'Cirugía de cordales'
      ])[(i % 10) + 1],
      (ARRAY['efectivo','transferencia','tarjeta_debito','tarjeta_credito'])[(i % 4) + 1]::tipo_pago,
      (ARRAY[25000, 45000, 78000, 120000, 185000, 15000, 35000, 62000, 28000, 95000])[(i % 10) + 1],
      (i % 7 = 0),
      'ARS'
    );
  END LOOP;

  -- =========================================
  -- 7. DEUDAS (Por Cobrar) — 12 registros
  -- =========================================
  INSERT INTO deudas (paciente, tratamiento, monto_total, monto_cobrado, fecha_inicio, sede_id, estado) VALUES
    ('Martínez, Laura',    'Ortodoncia (12 cuotas)',  480000, 120000, CURRENT_DATE - INTERVAL '60 days', sede_centro, 'parcial'),
    ('González, Pablo',    'Implante + corona',       380000, 190000, CURRENT_DATE - INTERVAL '45 days', sede_centro, 'parcial'),
    ('Ramírez, Sofía',     'Blanqueamiento láser',     85000,      0, CURRENT_DATE - INTERVAL '10 days', sede_norte,  'pendiente'),
    ('López, Carlos',      'Endodoncia + corona',     215000,  75000, CURRENT_DATE - INTERVAL '30 days', sede_centro, 'parcial'),
    ('Fernández, Ana',     'Cirugía de cordales',     320000, 160000, CURRENT_DATE - INTERVAL '20 days', sede_norte,  'parcial'),
    ('Sánchez, María',     'Prótesis removible',      420000,      0, CURRENT_DATE - INTERVAL '5 days',  sede_centro, 'pendiente'),
    ('Pérez, Juan',        'Limpieza + arreglos',      55000,  55000, CURRENT_DATE - INTERVAL '15 days', sede_centro, 'pagado'),
    ('Castro, Lucía',      '2 implantes',             720000, 240000, CURRENT_DATE - INTERVAL '50 days', sede_norte,  'parcial'),
    ('Torres, Miguel',     'Ortodoncia invisible',    890000,     0,  CURRENT_DATE - INTERVAL '3 days',  sede_centro, 'pendiente'),
    ('Flores, Carolina',   'Prótesis fija',           640000, 320000, CURRENT_DATE - INTERVAL '40 days', sede_norte,  'parcial'),
    ('Ruiz, Andrés',       'Endodoncia',              135000,  45000, CURRENT_DATE - INTERVAL '25 days', sede_centro, 'parcial'),
    ('Álvarez, Camila',    'Blanqueamiento',           85000,      0, CURRENT_DATE - INTERVAL '2 days',  sede_norte,  'pendiente');

  -- =========================================
  -- 8. GASTOS — 25 gastos del mes
  -- =========================================
  INSERT INTO gastos (fecha, fecha_vencimiento, sede_ids, user_id, concepto, categoria, monto, tipo, estado, pagado_por, moneda) VALUES
    (CURRENT_DATE - INTERVAL '1 day',  NULL,                                   ARRAY[sede_centro], admin_id, 'Alquiler local Centro',       'alquiler',  850000, 'fijo',     'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '1 day',  NULL,                                   ARRAY[sede_norte],  admin_id, 'Alquiler local Norte',        'alquiler',  920000, 'fijo',     'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '2 days', NULL,                                   ARRAY[sede_centro, sede_norte], admin_id, 'Sueldos quincena',     'sueldos', 1850000, 'fijo',     'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '3 days', NULL,                                   ARRAY[sede_centro], admin_id, 'Guantes y barbijos',          'insumos',   148000, 'variable', 'pagado',    'Efectivo',      'ARS'),
    (CURRENT_DATE - INTERVAL '5 days', NULL,                                   ARRAY[sede_centro, sede_norte], admin_id, 'Luz y agua',           'servicios', 185000, 'fijo',     'pagado',    'Débito',        'ARS'),
    (CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '10 days',      ARRAY[sede_centro], admin_id, 'Laboratorio coronas',         'laboratorio',340000, 'variable', 'pendiente', NULL,            'ARS'),
    (CURRENT_DATE - INTERVAL '8 days', NULL,                                   ARRAY[sede_norte],  admin_id, 'Publicidad Instagram',        'publicidad', 95000, 'variable', 'pagado',    'Crédito',       'ARS'),
    (CURRENT_DATE - INTERVAL '10 days', NULL,                                  ARRAY[sede_centro], admin_id, 'Limpieza mensual',            'limpieza',   65000, 'fijo',     'pagado',    'Efectivo',      'ARS'),
    (CURRENT_DATE - INTERVAL '12 days', NULL,                                  ARRAY[sede_norte],  admin_id, 'Implantes Nobel',             'implantes', 420000, 'variable', 'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '5 days',      ARRAY[sede_centro], admin_id, 'Servicios profesionales',     'personal',  280000, 'variable', 'pendiente', NULL,            'ARS'),
    (CURRENT_DATE - INTERVAL '15 days', NULL,                                  ARRAY[sede_centro, sede_norte], admin_id, 'Internet + teléfono',  'servicios',  45000, 'fijo',     'pagado',    'Débito',        'ARS'),
    (CURRENT_DATE - INTERVAL '16 days', NULL,                                  ARRAY[sede_centro], admin_id, 'Anestesia y suturas',         'insumos',   125000, 'variable', 'pagado',    'Efectivo',      'ARS'),
    (CURRENT_DATE - INTERVAL '18 days', NULL,                                  ARRAY[sede_norte],  admin_id, 'Google Ads',                  'publicidad', 75000, 'variable', 'pagado',    'Crédito',       'ARS'),
    (CURRENT_DATE - INTERVAL '20 days', NULL,                                  ARRAY[sede_centro], admin_id, 'Laboratorio prótesis',        'laboratorio',285000, 'variable', 'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '22 days', CURRENT_DATE - INTERVAL '2 days',      ARRAY[sede_centro], admin_id, 'Impuestos municipales',       'servicios', 125000, 'fijo',     'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '23 days', NULL,                                  ARRAY[sede_centro], admin_id, 'Mantenimiento sillón',        'otros',      85000, 'variable', 'pagado',    'Efectivo',      'ARS'),
    (CURRENT_DATE - INTERVAL '25 days', NULL,                                  ARRAY[sede_norte],  admin_id, 'Folletería y flyers',         'publicidad', 38000, 'variable', 'pagado',    'Efectivo',      'ARS'),
    (CURRENT_DATE - INTERVAL '26 days', NULL,                                  ARRAY[sede_centro, sede_norte], admin_id, 'Sistema de gestión',   'servicios',  28000, 'fijo',     'pagado',    'Crédito',       'ARS'),
    (CURRENT_DATE - INTERVAL '28 days', NULL,                                  ARRAY[sede_centro], admin_id, 'Reposición instrumental',     'insumos',   180000, 'variable', 'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '29 days', NULL,                                  ARRAY[sede_norte],  admin_id, 'Seguro del local',            'servicios',  95000, 'fijo',     'pagado',    'Débito',        'ARS'),
    (CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '20 days',      ARRAY[sede_centro], admin_id, 'Obra Social',                 'personal',  420000, 'fijo',     'pendiente', NULL,            'ARS'),
    (CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE + INTERVAL '15 days',      ARRAY[sede_norte],  admin_id, 'Laboratorio implantes',       'laboratorio',520000, 'variable', 'pendiente', NULL,            'ARS'),
    (CURRENT_DATE - INTERVAL '11 days', NULL,                                  ARRAY[sede_centro], admin_id, 'Café y agua pacientes',       'otros',      22000, 'variable', 'pagado',    'Efectivo',      'ARS'),
    (CURRENT_DATE - INTERVAL '17 days', NULL,                                  ARRAY[sede_norte],  admin_id, 'Uniformes',                   'otros',      95000, 'variable', 'pagado',    'Transferencia', 'ARS'),
    (CURRENT_DATE - INTERVAL '9 days',  CURRENT_DATE + INTERVAL '8 days',      ARRAY[sede_centro, sede_norte], admin_id, 'Contador mensual',   'personal',  185000, 'fijo',     'pendiente', NULL,            'ARS');

  -- =========================================
  -- 9. EMPLEADOS (pool interno — sin vinculación a users, solo para horas)
  -- =========================================
  INSERT INTO employees (name, active) VALUES
    ('Sofía Benítez',   true),
    ('Lucía Martínez',  true),
    ('Diego Suárez',    true),
    ('Carolina Ojeda',  true)
  ON CONFLICT DO NOTHING;

  -- =========================================
  -- 10. LABORATORIO — 8 casos en distintos estados
  -- =========================================
  INSERT INTO laboratorio_casos (paciente, sede_id, profesional, tipo, laboratorio, estado, notas, created_by) VALUES
    ('González, Pablo',     sede_centro, 'Dra. Benítez',  'corona',    'Lab. Dental SA',  'escaneado',  'Escaneo pieza 2.6',       admin_id),
    ('Ramírez, Sofía',      sede_centro, 'Dr. Martínez',  'corona',    'Lab. Dental SA',  'enviada',    'Enviada hoy',             admin_id),
    ('López, Carlos',       sede_norte,  'Dra. Suárez',   'protesis',  'ProLab',          'en_proceso', 'Prótesis superior',       admin_id),
    ('Fernández, Ana',      sede_centro, 'Dra. Benítez',  'corona',    'Lab. Dental SA',  'retirada',   'Lista para colocar',      admin_id),
    ('Sánchez, María',      sede_norte,  'Dr. Ojeda',     'corona',    'ProLab',          'colocada',   'Colocada 05/04',          admin_id),
    ('Castro, Lucía',       sede_centro, 'Dra. Ledesma',  'protesis',  'Lab. Dental SA',  'a_revisar',  'Revisar ajuste oclusal',  admin_id),
    ('Flores, Carolina',    sede_norte,  'Dr. Martínez',  'corona',    'ProLab',          'enviada',    'Enviada ayer',            admin_id),
    ('Ruiz, Andrés',        sede_centro, 'Dra. Benítez',  'corona',    'Lab. Dental SA',  'escaneado',  'Pendiente de envío',      admin_id);

  -- =========================================
  -- 11. HORAS (empleados en domingos del último mes)
  -- =========================================
  INSERT INTO hour_entries (employee_id, date, hours)
  SELECT e.id,
         gs.fecha::DATE,
         (4 + (extract(day from gs.fecha)::int % 3))::DECIMAL(4,2)
  FROM employees e
  CROSS JOIN generate_series(
    CURRENT_DATE - INTERVAL '28 days',
    CURRENT_DATE,
    INTERVAL '7 days'
  ) AS gs(fecha)
  WHERE EXTRACT(DOW FROM gs.fecha) = 0
  ON CONFLICT (employee_id, date) DO NOTHING;

  RETURN 'Demo data reset: ' || NOW()::TEXT;
END;
$reset$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir a cualquier authenticated llamar la función (la endpoint verifica admin)
GRANT EXECUTE ON FUNCTION reset_demo_data() TO authenticated;

-- Ejecutar UNA VEZ al cargar el seed
SELECT reset_demo_data();
