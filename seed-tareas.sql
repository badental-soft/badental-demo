-- ============================================================
-- SEED: Plantillas de tareas por rol (basado en Manual v5.0)
-- Ejecutar en SQL Editor de Supabase (proyecto gestion)
--
-- IMPORTANTE: Primero borrar plantillas existentes si las hay
-- ============================================================

-- Borrar plantillas existentes para reemplazar
DELETE FROM tarea_plantillas;

-- ============================================================
-- ROL A — Recepcionista Digital
-- ============================================================
INSERT INTO tarea_plantillas (titulo, categoria, rol, orden, activa) VALUES
('Enviar recordatorios a turnos no confirmados de hoy', 'agenda', 'rolA', 1, true),
('Resolver reprogramaciones y cancelaciones pendientes del día anterior', 'agenda', 'rolA', 2, true),
('Informar tratamiento, formas de pago y sede según zona', 'agenda', 'rolA', 3, true),
('Recuperar chats sin respuesta (visto clavado / sin interacción)', 'mensajes', 'rolA', 4, true),
('Responder en menos de 20 min · presentarse al iniciar', 'mensajes', 'rolA', 5, true),
('Etiquetar chat: nombre al iniciar · sede al confirmar el turno', 'mensajes', 'rolA', 6, true),
('Verificar que todos tus turnos de mañana estén confirmados', 'cierre', 'rolA', 7, true);

-- ============================================================
-- ROL B — Vendedor
-- ============================================================
INSERT INTO tarea_plantillas (titulo, categoria, rol, orden, activa) VALUES
('Recibir briefing del odontólogo', 'consulta', 'rolB', 1, true),
('Presentar presupuesto, formas de pago y financiamiento', 'venta', 'rolB', 2, true),
('Cerrar la venta: cobrar seña · fijar fecha', 'venta', 'rolB', 3, true),
('Registrar en Dentalink: tratamiento, seña y medio de pago', 'registro', 'rolB', 4, true),
('Dar orden de medicación e indicaciones por mail y WP', 'seguimiento', 'rolB', 5, true),
('Verificar que el estudio esté en Dentalink antes de la cirugía', 'seguimiento', 'rolB', 6, true),
('Llamar al paciente el día siguiente a la cirugía', 'seguimiento', 'rolB', 7, true);

-- ============================================================
-- ROL C — Recepcionista Físico
-- ============================================================
INSERT INTO tarea_plantillas (titulo, categoria, rol, orden, activa) VALUES
('Revisar agenda del día siguiente · confirmar coronas · verificar señas de cirugías', 'recepcion', 'rolC', 1, true),
('Recibir al paciente y cargar ficha (1° vez: DNI, fecha nac., cobertura, teléfono, alergias)', 'recepcion', 'rolC', 2, true),
('Dar turno de cirugías y tratamientos respetando tiempos', 'clinico', 'rolC', 3, true),
('Día de cirugía: firmar consentimiento · cobrar y registrar · dar turno de control', 'clinico', 'rolC', 4, true),
('Marcar Inasistencia en Dentalink a los 15 min', 'clinico', 'rolC', 5, true),
('Cierre de caja: Dentalink = Excel = físico · etiquetar dinero', 'admin', 'rolC', 6, true),
('Actualizar estado de coronas en Laboratorio', 'admin', 'rolC', 7, true);

-- ============================================================
-- ROL D — Asistente (NUEVO)
-- ============================================================
INSERT INTO tarea_plantillas (titulo, categoria, rol, orden, activa) VALUES
('Anotar evoluciones completas en Dentalink de todos los pacientes del día', 'clinico', 'rolD', 1, true),
('Subir stickers a Dentalink y al grupo de WP de Registro de implantes', 'clinico', 'rolD', 2, true),
('Entregar sticker al Rol C para que lo pegue en el consentimiento', 'clinico', 'rolD', 3, true),
('Mantener el consultorio higienizado durante y después de la jornada', 'higiene', 'rolD', 4, true),
('Esterilizar instrumental', 'higiene', 'rolD', 5, true),
('Controlar el stock de materiales e informar cuando se reduzca', 'stock', 'rolD', 6, true);
