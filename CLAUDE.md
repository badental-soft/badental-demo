@AGENTS.md

# BA Dental Studio — Sistema de Gestion Integral

## Proyecto
Dashboard de gestion para 6 clinicas dentales en Buenos Aires. Permite administrar turnos, cobranzas, gastos, stock, empleados y tareas.

## Stack
- **Next.js 16** (App Router) + **Supabase** + **Tailwind v4** + **TypeScript**
- **Recharts** para graficos
- **Deploy:** Vercel (badentalstudio.online)
- **Node.js:** Usar Node 20 siempre: `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"`

## Supabase
- **Gestion:** proyecto `ljqnjxbrqbfbqvhufmly` (cobranzas, turnos, gastos, stock, deudas, sedes, users)
- **Horas:** proyecto `gjkyfzkpzyktchmhysrb` (horas, tarea_plantillas, tarea_completadas)
- **Patron critico:** Supabase client devuelve `{ data, error }` — NO lanza excepciones. Siempre chequear `error` explicitamente, nunca usar try/catch para errores de Supabase.
- **Singleton:** No incluir `supabase` en deps de useCallback/useEffect
- **Casts:** Usar `as unknown as Type` para clientes sin tipos generados
- **RLS:** Todas las tablas necesitan politicas explicitas SELECT/INSERT/UPDATE/DELETE para `authenticated`
- **try/catch/finally:** Usar `setLoading(false)` en `finally`

## Timezone
- Argentina es UTC-3. Usar siempre `getArgentinaToday()` de `@/lib/utils/dates` en vez de `new Date().toISOString().split('T')[0]`
- Despues de las 21:00 AR, `toISOString()` devuelve el dia siguiente (UTC)

## Git
- `user.email = badental.soft@gmail.com`
- `user.name = badental-soft`

## NO hacer
- **NO intentar preview servers** — el port mapping no funciona en este entorno. Solo build-check y push.
- **NO usar middleware deprecated** — Next.js 16 depreco middleware, hay un warning en build. Eventualmente migrar a "proxy".

## Estructura de modulos

### Dashboard (`/dashboard`)
- KPIs: cobrado hoy/semana/mes, turnos hoy, tasa de show, por cobrar, tareas pendientes, no-shows, cancelados
- Grafico de barras: Cobranzas vs Gastos por dia del mes (recharts)
- Turnos por sede
- Filtro por sede
- Empleados ven su propio panel (EmpleadoDashboard)

### Turnos (`/turnos`)
- Vista diaria con filtro por sede
- Estados: agendado, atendido, no_asistio, cancelado
- Sync desde Dentalink

### Finanzas (`/finanzas`)
- **Resumen tab:** KPIs financieros (cobrado hoy/mes, gastos pagados/pendientes, resultado mes, por cobrar, proximos vencimientos)
- **Cobranzas tab:** CRUD, filtros mes/sede/tipo_pago, sync Dentalink
- **Por Cobrar tab:** placeholder (pendiente de datos)
- **Gastos tab:** CRUD completo, 10 categorias con colores, filtros mes/sede/categoria/estado, fecha_vencimiento, toggle pagado/pendiente

### Stock (`/stock`)
- Tabla compacta (Sede | Producto | Stock | Min | Estado)
- Alertas stock bajo/sin stock
- Summary cards con total por producto
- Busqueda por producto/medida
- Movimientos (entrada/salida)
- ABM productos (nombre, medida, unidad, stock_minimo, precio_compra)
- Stock calculado por movimientos (no stored quantity)

### Empleados (`/empleados`)
- Dashboard individual (tareas del dia, horas)
- Tareas con plantillas + completado diario
- Carga de horas (domingos/feriados)
- Vista admin de horas

## Categorias de gastos
personal, laboratorio, sueldos, publicidad, limpieza, implantes, insumos, alquiler, servicios, otros

## Archivos clave
- `src/lib/utils/dates.ts` — getArgentinaToday(), getArgentinaDate(), formatFechaHoyAR()
- `src/lib/supabase/middleware.ts` — auth middleware (redirect loop risk)
- `src/components/stock/StockModule.tsx` — modulo stock completo (~850 lineas)
- `src/app/(dashboard)/finanzas/page.tsx` — CobranzasTab + GastosTab + ResumenTab
- `src/app/(dashboard)/dashboard/page.tsx` — AdminDashboard con grafico
- `src/app/(dashboard)/layout.tsx` — layout compartido, pt-16 mobile para hamburguesa
- `src/components/Sidebar.tsx` — sidebar con hamburguesa mobile
- `src/types/database.ts` — todos los tipos/interfaces

## Tablas Supabase (gestion)
sedes, users, cobranzas, deudas, turnos, gastos, stock_productos, stock_movimientos

## Tablas Supabase (horas)
horas, tarea_plantillas, tarea_completadas, users (duplicado)

## Pendientes / TODO
- [ ] **Redirect loop en produccion** — al entrar a badentalstudio.online hay redirect loop. Puede ser cookies, deploy, o middleware deprecated de Next.js 16. Probar borrar cookies primero.
- [ ] **Por Cobrar** — deudas/saldos de pacientes (necesitan definir como cargar datos)
- [ ] **Cuotas en cobranzas** — al tildar "es cuota", elegir cantidad de cuotas y distribuir en meses
- [ ] **Config Empleados** — ABM de usuarios del sistema
- [ ] **Importar gastos desde Excel** — para cargar historico
- [ ] **Turnos agendados en panel empleado** — necesita acceso admin API Dentalink
- [ ] **Migrar middleware a proxy** — Next.js 16 depreco middleware, usar "proxy" convention
