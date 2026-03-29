# BA Dental Studio — Manual de Uso

## Acceso al sistema

1. Ingresá a **badentalstudio.online**
2. Ingresá tu **email** y **contraseña**
3. Hacé clic en **Ingresar**

Si no tenés cuenta, pedile al administrador que te cree una desde Configuración.

---

## Navegación

El menú lateral izquierdo tiene todos los módulos. En celular, tocá el ícono de hamburguesa (☰) arriba a la izquierda para abrirlo.

**Módulos disponibles para Admin:**
- Dashboard
- Turnos
- Finanzas
- Stock
- Laboratorio
- Empleados
- Configuración

---

## 1. Dashboard

Es la pantalla principal con el resumen del día.

### Indicadores superiores (primera fila)

| Indicador | Qué muestra |
|---|---|
| **Cobrado hoy** | Total cobrado en el día (incluye lo de Dentalink y cobros manuales). Abajo dice cuánto se cobró en la semana. |
| **Turnos hoy** | Cantidad de turnos del día. Abajo dice cuántos están pendientes. |
| **Tasa de show** | Porcentaje de pacientes que vinieron vs. los que no vinieron. Verde = bien (80%+), amarillo = regular, rojo = bajo. |
| **Por cobrar** | Total de deudas activas de pacientes. |

### Indicadores inferiores (segunda fila)

| Indicador | Qué muestra |
|---|---|
| **Cobrado mes** | Total cobrado en lo que va del mes. |
| **Tareas pendientes** | Cuántas tareas del equipo quedan sin completar hoy. |
| **No-shows hoy** | Pacientes que no se presentaron. |
| **Cancelados hoy** | Turnos cancelados en el día. |

### Gráfico Cobranzas vs Gastos

Muestra barras verdes (cobrado) y rojas (gastos) por cada día del mes. Sirve para ver de un vistazo cómo viene el flujo de caja.

### Turnos por sede

Cuando el filtro está en "Todas las sedes", muestra una tarjeta por cada sede con: total de turnos, atendidos, no-shows y la tasa de show.

### Filtro por sede

Arriba a la derecha hay un desplegable para filtrar toda la información por sede. Cuando seleccionás una sede:
- Los cobros manuales marcados como "General" se dividen proporcionalmente entre todas las sedes
- Los cobros de Dentalink se asignan a la sede que corresponde
- Los gastos generales se dividen proporcionalmente

### Sync todo

El botón **Sync todo** sincroniza los últimos 7 días de turnos y pagos desde Dentalink. Usalo cuando quieras actualizar los datos.

---

## 2. Turnos

Tiene dos pestañas: **Agenda del día** y **Turnos dados**.

### Agenda del día

Muestra los turnos de un día específico, sincronizados desde Dentalink.

**Navegación de fecha:**
- Usá las flechas ◀ ▶ para cambiar de día
- Hacé clic en la fecha para elegir una específica
- El botón **Hoy** vuelve al día actual

**Buscador:** Buscá por nombre de paciente o profesional.

**Tarjetas de estadísticas:** Arriba se muestran los totales del día: Total, Agendados, Atendidos, No asistió, Cancelados y la Tasa de show.

**Tabla de turnos:** Muestra hora, paciente, profesional, sede y estado.

**Estados posibles:**
- 🔵 Agendado — el paciente tiene turno confirmado
- 🟢 Atendido — fue atendido
- 🔴 No asistió — no vino
- 🟡 Cancelado — se canceló

**Sync Turnos:** Sincroniza los últimos 7 días de turnos desde Dentalink.

### Turnos dados

Muestra en tiempo real cuántos turnos se dieron en Dentalink en un día, desglosados por sede y por origen (Instagram, Web, WhatsApp, Teléfono, Referido, Otro).

---

## 3. Finanzas

Tiene cuatro pestañas: **Resumen**, **Cobranzas**, **Por Cobrar** y **Gastos**.

### 3.1 Resumen

Vista rápida del estado financiero del mes.

**Indicadores:**

| Indicador | Qué muestra |
|---|---|
| **Cobrado hoy** | Lo cobrado hoy |
| **Cobrado mes** | Total cobrado en el mes |
| **Gastos mes** | Total de gastos. Abajo detalla cuánto está pagado y cuánto pendiente |
| **Resultado mes** | Cobrado menos gastos pagados. Verde = ganancia, rojo = pérdida |
| **Por cobrar** | Deudas activas de pacientes |
| **Gastos pendientes** | Gastos que todavía no se pagaron |

**Próximos vencimientos:** Lista los próximos 5 gastos con fecha de vencimiento pendiente, mostrando concepto, categoría, monto y cuántos días faltan.

**Filtro por sede:** Arriba a la derecha. Filtra todos los indicadores por sede (con división proporcional para gastos/cobros generales).

### 3.2 Cobranzas

Gestión de cobros, tanto los sincronizados desde Dentalink como los cargados manualmente.

**Agregar cobro manual:**

1. Hacé clic en **Agregar**
2. Completá los campos:
   - **Paciente** (obligatorio)
   - **Tratamiento**
   - **Moneda**: ARS o USD
     - Si elegís USD: ingresá el monto en dólares y el tipo de cambio. Podés tocar **Usar oficial** para cargar automáticamente la cotización del dólar oficial
   - **Monto** (obligatorio)
   - **Medio de pago**: Efectivo, Transferencia, Tarjeta Débito o Tarjeta Crédito
   - **Sedes**:
     - **General (todas)** = se divide proporcionalmente entre todas las sedes
     - **Seleccionar sedes** = elegís a qué sedes corresponde
   - **Notas** (opcional)
3. Hacé clic en **Guardar**

**Navegación de fecha:** Flechas para cambiar de día, botón "Hoy" para volver al actual.

**Filtro por sede:** Arriba a la derecha, filtra los cobros por sede.

**Sync Pagos:** Sincroniza los últimos 7 días de pagos desde Dentalink.

**Tarjetas de resumen:** Muestran el total cobrado y el desglose por medio de pago.

**Tarjetas por sede:** Muestran cuánto corresponde a cada sede (proporcional para cobros generales).

**Tabla de cobros:** Fecha, paciente, tratamiento, sede, tipo de pago, monto. Los cobros en USD muestran el monto original y el tipo de cambio debajo.

**Eliminar cobro:** Hacé clic en la ✕ a la derecha de la fila. Solo se pueden eliminar cobros manuales (los de Dentalink se re-sincronizan).

### 3.3 Por Cobrar

Pendiente de implementación. Aquí se mostrarán las deudas y saldos de pacientes.

### 3.4 Gastos

Gestión completa de gastos con categorías, vencimientos y soporte USD.

**Registrar un gasto:**

1. Hacé clic en **Nuevo Gasto**
2. Completá los campos:
   - **Fecha** (obligatorio)
   - **Concepto** (obligatorio) — ej: "Sueldo Rosita", "Corona paciente García"
   - **Categoría** (obligatorio):
     - Personal, Laboratorio, Sueldos, Publicidad, Limpieza, Implantes, Insumos, Alquiler, Servicios, Otros
   - **Moneda**: ARS o USD
     - Si elegís USD: ingresá monto en dólares + tipo de cambio (o usá **Usar oficial**)
   - **Monto** (obligatorio)
   - **Medio de pago**: Efectivo, Transferencia, Débito o Crédito
   - **Sedes**:
     - **General (todas)** = se divide proporcionalmente entre todas las sedes
     - **Seleccionar sedes** = elegís las sedes específicas
   - **Pagado por** (opcional) — nombre de quien pagó
   - **Vencimiento** (opcional) — fecha límite de pago
   - **Estado**: Pendiente o Pagado
3. Hacé clic en **Guardar**

**Navegación de mes:** Flechas para cambiar de mes.

**Filtros disponibles:** Sede, Categoría, Estado (Pendiente/Pagado).

**Tarjetas de resumen:** Total del mes, Pagado, Pendiente, y las categorías más importantes.

**Tarjetas por sede:** Desglose proporcional del gasto por sede.

**Tabla de gastos:** Fecha, concepto, categoría, sedes, medio de pago, monto, estado, vencimiento, pagado por.

**Cambiar estado:** Hacé clic en el botón **Pendiente/Pagado** en la tabla para cambiar el estado de un gasto rápidamente.

**Eliminar gasto:** Hacé clic en la ✕ a la derecha de la fila.

---

## 4. Stock

Control de inventario de insumos por sede.

### Acciones principales

Los botones están arriba a la izquierda:
- **Entrada** (verde) — registrar ingreso de insumos
- **Salida** (rojo) — registrar consumo/salida de insumos

**Filtros:** Arriba a la derecha: filtro por sede y por producto.

### Registrar un movimiento (entrada o salida)

1. Hacé clic en **Entrada** o **Salida**
2. Completá:
   - **Producto** (obligatorio) — elegí de la lista
   - **Sede** (obligatorio) — a qué sede corresponde
   - **Cantidad** (obligatorio)
   - **Fecha** (por defecto hoy)
   - **Descripción** (opcional) — ej: "Compra proveedor X", "Uso paciente García"
3. Hacé clic en **Registrar**

### Pestaña: Stock Actual

Muestra el inventario actual de cada producto en cada sede.

**Tarjetas de resumen:** Total de cada producto sumando todas las sedes.

**Alertas:** Si un producto está por debajo del mínimo, aparece una alerta.

**Estados:**
- 🟢 **OK** — stock por encima del mínimo
- 🟡 **Bajo** — stock por debajo del mínimo
- 🔴 **Sin stock** — stock en cero o negativo

**Buscador:** Buscá por nombre de producto.

### Pestaña: Movimientos

Historial de entradas y salidas, ordenado por más reciente.

### Pestaña: Productos

ABM de productos (solo admin y recepcionistas).

**Crear producto:**
1. Hacé clic en **Nuevo Producto**
2. Completá: Nombre, Medida (ej: "3.5x10"), Unidad (ej: "unidades"), Stock mínimo, Precio de compra (opcional)
3. Hacé clic en **Guardar**

**Activar/Desactivar:** El botón Activo/Inactivo controla si el producto aparece en los desplegables. Los productos inactivos no se eliminan, solo se ocultan.

---

## 5. Laboratorio

Seguimiento de coronas y prótesis desde el escaneo hasta la colocación.

### Estados del caso

Un caso avanza por estos estados en orden:

1. 🔵 **Escaneado** — se tomó la impresión digital
2. 🟣 **Enviada** — se envió al laboratorio
3. 🟡 **En proceso** — el laboratorio está trabajando
4. 🟣 **Retirada** — se retiró del laboratorio
5. 🟢 **Colocada** — se colocó en el paciente (estado final)
6. 🔴 **A revisar** — hay un problema que resolver (se puede marcar desde cualquier estado)

### Crear un caso

1. Hacé clic en **Nuevo caso** (arriba a la derecha)
2. Completá:
   - **Paciente** (obligatorio)
   - **Tipo**: Corona, Prótesis, Carilla, Incrustación u Otro
   - **Sede** (opcional)
   - **Profesional** (opcional)
   - **Laboratorio** (opcional) — nombre del laboratorio externo
   - **Notas** (opcional)
3. Hacé clic en **Crear caso**

### Filtrar casos

- **Por estado:** Hacé clic en las tarjetas de estado arriba (Escaneados, Enviadas, etc.). Clic de nuevo para quitar el filtro.
- **Por sede:** Desplegable arriba a la derecha.
- **Buscar paciente:** Buscador arriba de la tabla. Busca por paciente, profesional, tipo o laboratorio.

### Acciones en la tabla

Cada caso tiene botones a la derecha:

- **Avanzar estado** (→ Siguiente) — avanza al próximo estado en el flujo
- **Marcar a revisar** — marca el caso como problemático
- **Ver historial** (reloj) — muestra todos los cambios de estado con fecha y hora
- **Editar** (ícono lab) — modifica los datos del caso

### Editar o eliminar un caso

1. Hacé clic en el ícono de editar
2. Modificá los campos necesarios
3. Para eliminar: hacé clic en **Eliminar caso** (rojo) dentro del modal de edición

---

## 6. Empleados

### Vista del administrador

Tres pestañas:

**Tareas:** Muestra las tareas diarias del equipo, basadas en plantillas por rol. Podés ver quién completó qué.

**Turnos agendados:** (En desarrollo) Mostrará cuántos turnos agendó cada empleado.

**Horas:** Control de horas trabajadas. Podés ver y aprobar las horas cargadas por cada empleado. Los domingos y feriados tienen un multiplicador configurable.

### Vista del empleado

Los empleados ven su propio panel con:
- Sus tareas del día (marcar como completadas)
- Su registro de horas
- Acceso a turnos y los módulos que su rol permita

---

## 7. Configuración

Solo para administradores.

### Gestión de usuarios

**Crear un usuario nuevo:**
1. Hacé clic en **Nuevo usuario**
2. Completá: Nombre, Email, Contraseña (mínimo 6 caracteres), Rol y Sede
3. Hacé clic en **Crear usuario**

**Roles disponibles:**
| Rol | Acceso |
|---|---|
| **Administrador** | Todo el sistema |
| **Recepcionista Digital (rolA)** | Dashboard, Turnos, Tareas, Horas |
| **Vendedor (rolB)** | Dashboard, Turnos, Stock, Laboratorio, Tareas |
| **Recepcionista (rolC)** | Dashboard, Turnos, Stock, Laboratorio, Tareas |

**Editar usuario:** Clic en el lápiz para cambiar nombre, rol o sede.

**Resetear contraseña:** Clic en el ícono de llave, ingresá la nueva contraseña (mínimo 6 caracteres).

**Eliminar usuario:** Clic en el ícono de basura. Pide confirmación antes de eliminar.

### Configuración de horas

- **Valor hora ($):** Cuánto se paga por hora trabajada (en ARS).
- **Multiplicador dom/fer.:** Multiplicador para domingos y feriados (ej: 2 = se paga el doble).

---

## Preguntas frecuentes

**¿Cómo sincronizo los datos de Dentalink?**
Desde el Dashboard, hacé clic en **Sync todo**. También podés sincronizar solo turnos desde Turnos, o solo pagos desde Finanzas > Cobranzas.

**¿Qué pasa con los cobros en dólares?**
Se guardan en pesos al tipo de cambio oficial del momento. Siempre podés ver el monto original en USD y el tipo de cambio usado en la tabla.

**¿Qué significa "General" en sedes?**
Cuando un gasto o cobro se marca como General, significa que se distribuye proporcionalmente entre todas las sedes. Por ejemplo, un gasto de $60.000 General se muestra como $10.000 por sede (si hay 6 sedes).

**¿Cómo cargo el stock inicial?**
Usá el botón **Entrada** en Stock. Seleccioná el producto, la sede, la cantidad y poné "Stock inicial" en descripción.

**¿Puedo eliminar un cobro de Dentalink?**
No directamente. Los cobros de Dentalink se re-sincronizan automáticamente. Si necesitás corregir algo, hacelo en Dentalink y luego sincronizá.

**¿Cómo sé si un producto está bajo de stock?**
En Stock > Stock Actual, los productos con stock bajo aparecen en amarillo y los sin stock en rojo. También hay una tarjeta de alertas con el total.
