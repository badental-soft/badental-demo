import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manual de Uso — BA Dental Studio',
}

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2">BA Dental Studio</h1>
          <p className="text-lg text-[#666]">Manual de Uso — Sistema de Gestión</p>
        </div>

        <div className="space-y-12 text-[#333] text-[15px] leading-relaxed">

          {/* Acceso */}
          <Section title="Acceso al sistema">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Ingresá a <strong>badentalstudio.online</strong></li>
              <li>Ingresá tu <strong>email</strong> y <strong>contraseña</strong></li>
              <li>Hacé clic en <strong>Ingresar</strong></li>
            </ol>
            <p className="mt-2 text-sm text-[#888]">Si no tenés cuenta, pedile al administrador que te cree una desde Configuración.</p>
          </Section>

          {/* Navegación */}
          <Section title="Navegación">
            <p>El menú lateral izquierdo tiene todos los módulos. En celular, tocá el ícono de hamburguesa (☰) arriba a la izquierda para abrirlo.</p>
            <p className="mt-2 font-medium">Módulos disponibles para Admin:</p>
            <ul className="list-disc pl-5">
              <li>Dashboard</li>
              <li>Turnos</li>
              <li>Finanzas</li>
              <li>Stock</li>
              <li>Laboratorio</li>
              <li>Empleados</li>
              <li>Configuración</li>
            </ul>
          </Section>

          {/* 1. Dashboard */}
          <Section title="1. Dashboard" id="dashboard">
            <p>Pantalla principal con el resumen del día.</p>

            <H3>Indicadores superiores</H3>
            <Table headers={['Indicador', 'Qué muestra']} rows={[
              ['Cobrado hoy', 'Total cobrado en el día (Dentalink + manuales). Abajo dice cuánto se cobró en la semana.'],
              ['Turnos hoy', 'Cantidad de turnos del día. Abajo dice cuántos están pendientes.'],
              ['Tasa de show', 'Porcentaje de pacientes que vinieron vs. los que no. Verde = bien (80%+), amarillo = regular, rojo = bajo.'],
              ['Por cobrar', 'Total de deudas activas de pacientes.'],
            ]} />

            <H3>Indicadores inferiores</H3>
            <Table headers={['Indicador', 'Qué muestra']} rows={[
              ['Cobrado mes', 'Total cobrado en lo que va del mes.'],
              ['Tareas pendientes', 'Tareas del equipo sin completar hoy.'],
              ['No-shows hoy', 'Pacientes que no se presentaron.'],
              ['Cancelados hoy', 'Turnos cancelados en el día.'],
            ]} />

            <H3>Gráfico Cobranzas vs Gastos</H3>
            <p>Barras verdes (cobrado) y rojas (gastos) por cada día del mes. Sirve para ver el flujo de caja de un vistazo.</p>

            <H3>Turnos por sede</H3>
            <p>Cuando el filtro está en &quot;Todas las sedes&quot;, muestra una tarjeta por sede con: turnos totales, atendidos, no-shows y tasa de show.</p>

            <H3>Filtro por sede</H3>
            <p>Arriba a la derecha. Filtra toda la información por sede. Los cobros/gastos &quot;General&quot; se dividen proporcionalmente entre todas las sedes.</p>

            <H3>Sync todo</H3>
            <p>Sincroniza los últimos 7 días de turnos y pagos desde Dentalink.</p>
          </Section>

          {/* 2. Turnos */}
          <Section title="2. Turnos" id="turnos">
            <p>Dos pestañas: <strong>Agenda del día</strong> y <strong>Turnos dados</strong>.</p>

            <H3>Agenda del día</H3>
            <p>Muestra los turnos de un día, sincronizados desde Dentalink.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Usá las flechas ◀ ▶ para cambiar de día, o el botón <strong>Hoy</strong></li>
              <li>Buscá por nombre de paciente o profesional</li>
              <li><strong>Sync Turnos</strong> sincroniza los últimos 7 días</li>
            </ul>
            <p className="mt-2">Estados posibles:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><Badge color="blue">Agendado</Badge> — turno confirmado</li>
              <li><Badge color="green">Atendido</Badge> — fue atendido</li>
              <li><Badge color="red">No asistió</Badge> — no vino</li>
              <li><Badge color="amber">Cancelado</Badge> — se canceló</li>
            </ul>

            <H3>Turnos dados</H3>
            <p>Muestra en tiempo real cuántos turnos se dieron en Dentalink, desglosados por sede y por origen (Instagram, Web, WhatsApp, Teléfono, Referido, Otro).</p>
          </Section>

          {/* 3. Finanzas */}
          <Section title="3. Finanzas" id="finanzas">
            <p>Cuatro pestañas: <strong>Resumen</strong>, <strong>Cobranzas</strong>, <strong>Por Cobrar</strong> y <strong>Gastos</strong>.</p>

            <H3>3.1 Resumen</H3>
            <p>Vista rápida del estado financiero del mes. Filtro por sede arriba a la derecha.</p>
            <Table headers={['Indicador', 'Qué muestra']} rows={[
              ['Cobrado hoy', 'Lo cobrado hoy'],
              ['Cobrado mes', 'Total cobrado en el mes'],
              ['Gastos mes', 'Total de gastos (detalla pagado y pendiente)'],
              ['Resultado mes', 'Cobrado menos gastos pagados. Verde = ganancia, rojo = pérdida'],
              ['Por cobrar', 'Deudas activas de pacientes'],
              ['Gastos pendientes', 'Gastos que todavía no se pagaron'],
            ]} />
            <p className="mt-2"><strong>Próximos vencimientos:</strong> Lista los próximos 5 gastos con fecha de vencimiento, mostrando concepto, categoría, monto y cuántos días faltan.</p>

            <H3>3.2 Cobranzas</H3>
            <p>Cobros sincronizados desde Dentalink y cobros manuales.</p>

            <p className="font-medium mt-3">Agregar un cobro manual:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Hacé clic en <strong>Agregar</strong></li>
              <li>Completá: Paciente (obligatorio), Tratamiento, Monto, Medio de pago</li>
              <li><strong>Moneda:</strong> ARS o USD. Si elegís USD, ingresá el monto en dólares y el tipo de cambio (o tocá <strong>Usar oficial</strong> para cargarlo automáticamente)</li>
              <li><strong>Sedes:</strong> &quot;General (todas)&quot; divide entre todas las sedes. &quot;Seleccionar sedes&quot; permite elegir a cuáles corresponde</li>
              <li>Hacé clic en <strong>Guardar</strong></li>
            </ol>

            <p className="font-medium mt-3">Medios de pago:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><Badge color="green">Efectivo</Badge></li>
              <li><Badge color="blue">Transferencia</Badge></li>
              <li><Badge color="purple">Tarjeta Débito</Badge></li>
              <li><Badge color="amber">Tarjeta Crédito</Badge></li>
            </ul>

            <p className="mt-2"><strong>Sync Pagos:</strong> Sincroniza los últimos 7 días de pagos desde Dentalink.</p>
            <p><strong>Eliminar cobro:</strong> Clic en la ✕ de la fila. Los cobros de Dentalink se re-sincronizan automáticamente.</p>

            <H3>3.3 Por Cobrar</H3>
            <p className="text-[#888]">Pendiente de implementación. Aquí se mostrarán las deudas y saldos de pacientes.</p>

            <H3>3.4 Gastos</H3>

            <p className="font-medium mt-3">Registrar un gasto:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Hacé clic en <strong>Nuevo Gasto</strong></li>
              <li><strong>Fecha</strong> y <strong>Concepto</strong> (obligatorios)</li>
              <li><strong>Categoría:</strong> Personal, Laboratorio, Sueldos, Publicidad, Limpieza, Implantes, Insumos, Alquiler, Servicios, Otros</li>
              <li><strong>Moneda:</strong> ARS o USD (mismo sistema que cobranzas)</li>
              <li><strong>Monto</strong> (obligatorio)</li>
              <li><strong>Medio de pago:</strong> Efectivo, Transferencia, Débito o Crédito</li>
              <li><strong>Sedes:</strong> General (todas) o Seleccionar sedes específicas</li>
              <li><strong>Pagado por</strong> (opcional) — nombre de quien pagó</li>
              <li><strong>Vencimiento</strong> (opcional) — aparecerá en &quot;Próximos vencimientos&quot;</li>
              <li><strong>Estado:</strong> Pendiente o Pagado</li>
              <li>Hacé clic en <strong>Guardar</strong></li>
            </ol>

            <p className="mt-3"><strong>Filtros:</strong> Mes, Sede, Categoría, Estado (Pendiente/Pagado).</p>
            <p><strong>Cambiar estado rápido:</strong> Clic en el botón Pendiente/Pagado en la tabla.</p>
            <p><strong>Eliminar gasto:</strong> Clic en la ✕ de la fila.</p>
          </Section>

          {/* 4. Stock */}
          <Section title="4. Stock" id="stock">
            <p>Control de inventario de insumos por sede.</p>

            <H3>Registrar entrada o salida</H3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Hacé clic en <strong>Entrada</strong> (verde) o <strong>Salida</strong> (rojo)</li>
              <li>Elegí <strong>Producto</strong> y <strong>Sede</strong></li>
              <li>Ingresá la <strong>Cantidad</strong></li>
              <li><strong>Descripción</strong> (opcional): ej. &quot;Compra proveedor X&quot;, &quot;Uso paciente García&quot;</li>
              <li>Hacé clic en <strong>Registrar</strong></li>
            </ol>

            <H3>Stock Actual (primera pestaña)</H3>
            <p>Muestra el inventario de cada producto en cada sede.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><Badge color="green">OK</Badge> — stock por encima del mínimo</li>
              <li><Badge color="amber">Bajo</Badge> — stock por debajo del mínimo</li>
              <li><Badge color="red">Sin stock</Badge> — stock en cero o negativo</li>
            </ul>
            <p className="mt-1">Arriba aparecen tarjetas de resumen por producto y alertas de stock bajo.</p>

            <H3>Movimientos (segunda pestaña)</H3>
            <p>Historial de entradas y salidas, ordenado por más reciente.</p>

            <H3>Productos (tercera pestaña)</H3>
            <p>ABM de productos. Crear producto: nombre, medida (ej: &quot;3.5x10&quot;), unidad, stock mínimo, precio de compra.</p>
            <p><strong>Activar/Desactivar:</strong> Los productos inactivos no aparecen en los desplegables pero no se eliminan.</p>
          </Section>

          {/* 5. Laboratorio */}
          <Section title="5. Laboratorio" id="laboratorio">
            <p>Seguimiento de coronas y prótesis desde el escaneo hasta la colocación.</p>

            <H3>Estados del caso (en orden)</H3>
            <ol className="list-decimal pl-5 space-y-1">
              <li><Badge color="blue">Escaneado</Badge> — se tomó la impresión digital</li>
              <li><Badge color="indigo">Enviada</Badge> — se envió al laboratorio</li>
              <li><Badge color="amber">En proceso</Badge> — el laboratorio está trabajando</li>
              <li><Badge color="purple">Retirada</Badge> — se retiró del laboratorio</li>
              <li><Badge color="green">Colocada</Badge> — se colocó en el paciente (final)</li>
              <li><Badge color="red">A revisar</Badge> — hay un problema (se puede marcar desde cualquier estado)</li>
            </ol>

            <H3>Crear un caso</H3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Clic en <strong>Nuevo caso</strong></li>
              <li>Completá: Paciente (obligatorio), Tipo (Corona, Prótesis, Carilla, Incrustación, Otro), Sede, Profesional, Laboratorio, Notas</li>
              <li>Clic en <strong>Crear caso</strong></li>
            </ol>

            <H3>Filtrar casos</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Por estado:</strong> Clic en las tarjetas de estado (Escaneados, Enviadas, etc.)</li>
              <li><strong>Por sede:</strong> Desplegable arriba a la derecha</li>
              <li><strong>Buscar paciente:</strong> Buscador en la tabla (busca por paciente, profesional, tipo o laboratorio)</li>
            </ul>

            <H3>Acciones en cada caso</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Avanzar estado</strong> (→ Siguiente) — avanza al próximo estado</li>
              <li><strong>Marcar a revisar</strong> — marca como problemático</li>
              <li><strong>Ver historial</strong> (ícono reloj) — muestra todos los cambios de estado</li>
              <li><strong>Editar</strong> — modifica datos o elimina el caso</li>
            </ul>
          </Section>

          {/* 6. Empleados */}
          <Section title="6. Empleados" id="empleados">
            <H3>Vista del administrador</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Tareas:</strong> Tareas diarias del equipo por rol. Podés ver quién completó qué.</li>
              <li><strong>Turnos agendados:</strong> (En desarrollo) Mostrará cuántos turnos agendó cada empleado.</li>
              <li><strong>Horas:</strong> Control de horas trabajadas. Podés ver y aprobar horas. Domingos y feriados tienen multiplicador.</li>
            </ul>

            <H3>Vista del empleado</H3>
            <p>Los empleados ven su propio panel con sus tareas del día, registro de horas y los módulos que su rol permita.</p>
          </Section>

          {/* 7. Configuración */}
          <Section title="7. Configuración" id="configuracion">

            <H3>Gestión de usuarios</H3>

            <p className="font-medium mt-3">Crear un usuario:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Clic en <strong>Nuevo usuario</strong></li>
              <li>Completá: Nombre, Email, Contraseña (mínimo 6 caracteres), Rol y Sede</li>
              <li>Clic en <strong>Crear usuario</strong></li>
            </ol>

            <Table headers={['Rol', 'Acceso']} rows={[
              ['Administrador', 'Todo el sistema'],
              ['Recepcionista Digital (rolA)', 'Dashboard, Turnos, Tareas, Horas'],
              ['Vendedor (rolB)', 'Dashboard, Turnos, Stock, Laboratorio, Tareas'],
              ['Recepcionista (rolC)', 'Dashboard, Turnos, Stock, Laboratorio, Tareas'],
            ]} />

            <p className="mt-2"><strong>Editar:</strong> Clic en el lápiz para cambiar nombre, rol o sede.</p>
            <p><strong>Resetear contraseña:</strong> Clic en el ícono de llave.</p>
            <p><strong>Eliminar:</strong> Clic en el ícono de basura (pide confirmación).</p>

            <H3>Configuración de horas</H3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Valor hora ($):</strong> Cuánto se paga por hora trabajada</li>
              <li><strong>Multiplicador dom/fer.:</strong> Multiplicador para domingos y feriados (ej: 2 = doble)</li>
            </ul>
          </Section>

          {/* FAQ */}
          <Section title="Preguntas frecuentes" id="faq">
            <FAQ
              q="¿Cómo sincronizo los datos de Dentalink?"
              a='Desde el Dashboard hacé clic en "Sync todo". También podés sincronizar solo turnos (desde Turnos) o solo pagos (desde Finanzas > Cobranzas).'
            />
            <FAQ
              q="¿Qué pasa con los cobros en dólares?"
              a="Se guardan en pesos al tipo de cambio oficial del momento. En la tabla siempre podés ver el monto original en USD y el tipo de cambio usado."
            />
            <FAQ
              q='¿Qué significa "General" en sedes?'
              a="Cuando un gasto o cobro se marca como General, se distribuye proporcionalmente entre todas las sedes. Ej: un gasto de $60.000 General se muestra como $10.000 por sede (si hay 6 sedes)."
            />
            <FAQ
              q="¿Cómo cargo el stock inicial?"
              a='Usá el botón "Entrada" en Stock. Seleccioná producto, sede, cantidad y poné "Stock inicial" en descripción.'
            />
            <FAQ
              q="¿Puedo eliminar un cobro de Dentalink?"
              a="No directamente. Los cobros de Dentalink se re-sincronizan automáticamente. Si necesitás corregir algo, hacelo en Dentalink y luego sincronizá."
            />
            <FAQ
              q="¿Cómo sé si un producto está bajo de stock?"
              a="En Stock > Stock Actual, los productos con stock bajo aparecen en amarillo y los sin stock en rojo. También hay una tarjeta de alertas con el total."
            />
          </Section>

          {/* Footer */}
          <div className="text-center text-sm text-[#aaa] pt-8 border-t border-[#e5e2dc]">
            BA Dental Studio — Sistema de Gestión Integral
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Components ───────────────────────────────

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="text-xl font-bold text-[#1a1a1a] mb-4 pb-2 border-b border-[#e5e2dc]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-[#1a1a1a] mt-5 mb-2">{children}</h3>
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.blue}`}>
      {children}
    </span>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border border-[#e5e2dc] rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#f0ede8]">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2 font-semibold text-[#333] border-b border-[#e5e2dc]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#faf8f5]'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 border-b border-[#f0ede8] text-[#555]">
                  {j === 0 ? <strong className="text-[#333]">{cell}</strong> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="mb-4">
      <p className="font-semibold text-[#1a1a1a]">{q}</p>
      <p className="text-[#555] mt-1">{a}</p>
    </div>
  )
}
