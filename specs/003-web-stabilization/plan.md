# Implementation Plan: Estabilización funcional de la web

**Branch**: `003-web-stabilization` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Especificación aprobada para unificar los datos operativos de la web, sincronizar todas
las superficies después de una venta y adaptar navegación, indicadores y acciones a los permisos
efectivos de la pertenencia activa.

## Resumen técnico

Reemplazar el ensamblaje híbrido actual —ventas reales junto con inventario e indicadores creados
por `createDemoInventoryData()`— por un modelo agregado de estado web construido exclusivamente a
partir de las lecturas REST existentes del tenant activo. Un coordinador de carga compondrá sesión y
capacidades, productos, lotes, balances, movimientos, alertas, ventas y resúmenes BI sin convertir el
cliente en fuente de reglas de negocio. Las vistas recibirán proyecciones del agregado, no fixtures.

Después de una venta confirmada, la mutación se conservará como éxito definitivo y se invalidarán y
volverán a consultar, en paralelo, todos los recursos afectados. La sincronización usará resultados
independientes por recurso: una lectura fallida marcará solo sus superficies como desactualizadas y
ofrecerá reintentar esas lecturas, nunca el `POST` de venta. Navegación, secciones, indicadores,
columnas y acciones se construirán desde las capacidades efectivas de la pertenencia activa; el
backend seguirá siendo la autoridad para tenant, permisos, FEFO, transacciones, stock y privacidad.

`apps/web/src/demo/demo-data.ts` dejará de participar en cualquier render conectado. Podrá permanecer
solo como fixture importado directamente por pruebas aisladas o demostraciones sin conexión
inequívocamente separadas. Este sprint no requiere cambios de esquema, tablas ni migraciones Prisma.

## Contexto técnico y restricciones

**Lenguaje y runtime**: TypeScript estricto sobre Node.js 22 LTS.

**Superficie**: web existente basada en TypeScript, HTML generado y Vite; API REST local existente;
PostgreSQL 16 local en `127.0.0.1:5432` mediante Prisma exclusivamente desde la API.

**Dependencias relevantes**: `WebApiClient`, `InventoryWebApi`, `InventoryBiApi`, catálogo compartido
`@bodegia/authz-catalog`, servicios REST NestJS/HTTP existentes, Vitest y Playwright.

**Fuente autoritativa**: respuestas tenant-scoped del backend. El navegador no consulta PostgreSQL,
no suma movimientos para reconstruir stock y no calcula FEFO, alertas, costos ni valorización.

**Objetivos observables**: contenido, vacío o error perceptible en menos de 2 segundos en condiciones
locales normales; consistencia exacta del stock entre superficies para una misma generación de
lectura; actualización posterior a venta en menos de 2 segundos; funcionamiento entre 320 y 1440 px.

**Alcance**: dashboard web, ventas rápidas, operación de inventario, indicadores y navegación para
`owner_admin`, `inventory_manager` y `seller`. No incluye móvil, OCR, clientes, DataMart de Ventas,
offline ni rediseño completo.

**Restricciones operativas**:

- Desarrollo y pruebas únicamente locales, con datos sintéticos.
- No usar Supabase, Render ni Vercel; no desplegar ni ejecutar comandos contra servicios remotos.
- No modificar secretos, autenticación, reglas correctas de stock, FEFO, auditoría o transacciones.
- No crear tablas, relaciones, seeds de negocio ni migraciones Prisma.
- No implementar código durante esta etapa y no crear `tasks.md`.

La Constitución menciona PostgreSQL alojado en Supabase como restricción general, pero la
especificación aprobada de este sprint fija PostgreSQL local y prohíbe usar o modificar Supabase. El
plan conserva PostgreSQL + Prisma y trata la ubicación local como separación de ambiente obligatoria
para esta etapa; no propone una sustitución arquitectónica ni un cambio productivo.

## Constitution Check

_GATE: evaluado antes del diseño y nuevamente al finalizarlo._

- **Especificación y trazabilidad — PASS**: HU-001…HU-004, FR-001…FR-024 y SC-001…SC-008 se reflejan
  en flujos, estado, matriz de capacidades, pruebas y fases. Las tareas posteriores deberán conservar
  estos identificadores.
- **Aislamiento multi-tenant — PASS**: cada carga queda ligada a una clave de contexto de sesión,
  pertenencia y tenant; al cambiarla se cancelan o ignoran respuestas anteriores y se limpia el
  agregado. Se mantienen pruebas negativas A/B (FR-021, FR-023).
- **Arquitectura desacoplada — PASS**: la web usa solamente endpoints REST existentes; Prisma,
  balances, FEFO, transacciones y auditoría permanecen en el backend (FR-001, FR-002, FR-011).
- **Seguridad y privacidad — PASS**: visibilidad basada en capacidades aplica mínimo privilegio; una
  proyección defensiva elimina costos para `seller`, pero no reemplaza la autorización backend. No se
  agregan secretos ni datos personales (FR-006…FR-011, NFR-004).
- **Integridad de datos — PASS**: el plan no altera la venta transaccional. Tras un éxito vuelve a leer
  la autoridad y nunca repite la mutación por una falla de sincronización (FR-003…FR-005, NFR-005).
- **Calidad — PASS**: se planifican unidades Vitest, integración web con REST simulado/controlado,
  Playwright local, regresión, privacidad, accesibilidad, responsive y aislamiento (FR-022, FR-023).
  k6 no añade valor a este cambio de presentación y coordinación local; NFR-001 se valida con tiempos
  E2E controlados sin redefinir metas de rendimiento del backend.
- **Experiencia de usuario — PASS**: cada recurso tiene carga, contenido, vacío, error y estado stale;
  se contemplan recuperación, teclado, foco, anuncios y 320/768/1440 px (FR-012…FR-020).
- **Disciplina MVP — PASS**: no se implementan móvil, OCR, IA, clientes, nuevos DataMarts, offline,
  despliegues ni reglas comerciales futuras (FR-024).

**Gate Result (pre-design)**: PASS, sin violaciones arquitectónicas. La excepción de ambiente local
está ordenada explícitamente por la especificación aprobada y evita contacto con infraestructura
productiva.

## Arquitectura propuesta

### 1. Contexto y capacidades

Introducir un `WebSessionContext` inmutable con `sessionId`, `tenantId`, `membershipId`, roles,
capacidades efectivas y una `contextKey`/generación. En el flujo de acceso real, las capacidades
proceden de `activeTenant.capabilities` ya devuelto al seleccionar tenant o de los permisos efectivos
equivalentes disponibles en el contexto. En la sesión demo local, y solo como fallback de ese
adaptador, se derivan del catálogo tipado compartido a partir del rol singular de la pertenencia. El
código general de presentación recibe capacidades y no depende directamente de un único nombre de
rol cuando aquellas están disponibles. Cada request sigue sujeto a la validación del servidor.

Todo cambio o invalidación de sesión, tenant o pertenencia incrementa la generación, aborta requests
cuando sea posible, descarta respuestas de generaciones anteriores y reemplaza el estado operativo
por carga o sesión inválida. No se mezclan roles de distintas pertenencias.

### 2. Modelo agregado del dashboard

Crear un modelo web único, por ejemplo `OperationalDashboardState`, que sea la única entrada de
render de las superficies conectadas:

```ts
interface OperationalDashboardState {
  context: WebSessionContext;
  capabilities: UiCapabilities;
  resources: {
    products: ResourceState<readonly OperationalProduct[]>;
    lots: ResourceState<readonly OperationalLot[]>;
    balances: ResourceState<readonly OperationalBalance[]>;
    movements: ResourceState<readonly InventoryMovement[]>;
    alerts: ResourceState<readonly InventoryAlert[]>;
    sales: ResourceState<readonly QuickSaleRecord[]>;
    indicators: ResourceState<OperationalIndicators>;
  };
  saleMutation: SaleMutationState;
}
```

`OperationalProduct` normaliza una sola identidad de producto y un `availableStock` procedente de la
respuesta autoritativa aplicable. `GET /tenants/current/products` puede conservar su forma de resumen
para ventas rápidas; las superficies ricas consumen los endpoints operativos existentes de productos,
lotes, balances, movimientos, alertas y FEFO. El normalizador lleva ambas formas al agregado y define
la procedencia de cada campo, sin calcular una segunda fuente de stock ni conservar snapshots. Lotes
y balances mantienen su granularidad y no se suman en la vista para reemplazar el saldo publicado por
la API. `OperationalIndicators` usa los resúmenes BI existentes y solo muestra métricas permitidas.
Los adaptadores validan/normalizan envoltorios en el límite HTTP para que las vistas no conozcan si un
endpoint devuelve `data`, arreglo o página.

`ResourceState<T>` será una unión discriminada con estados `idle`, `loading`, `ready`, `empty`,
`error` y `stale`. `ready` incluye datos y `receivedAt`; `error` incluye mensaje seguro y
`correlationId` opcional; `stale` identifica la última lectura no confirmada, la causa y una acción de
reintento. Una vista nunca interpreta arreglo vacío durante carga/error como un cero confirmado.

`SaleMutationState` distingue `idle`, `submitting`, `confirmed` y `failed`. `confirmed` conserva el
identificador/número devuelto por el backend y el estado de sincronización posterior. Esto impide que
la recuperación de lecturas reenvíe la venta.

### 3. Capa de adquisición y coordinación

- Conservar los endpoints existentes y reutilizar `InventoryWebApi` para productos operativos,
  lotes, balances, movimientos, alertas y FEFO.
- Reutilizar `InventoryBiApi` para resumen, stock por categoría, riesgo de vencimiento, movimientos y
  alertas agregadas; no reconstruir valorización o indicadores con fixtures.
- Encapsular `GET /tenants/current/sales` y `POST /tenants/current/sales` en un cliente de ventas
  tipado, separado de render y con errores seguros/correlationId.
- Conservar `GET /tenants/current/products` como resumen para ventas rápidas y normalizar su respuesta
  junto con las respuestas operativas ricas en un modelo agregado común. Toda cantidad mostrada debe
  venir de un saldo publicado por el backend; el normalizador no deriva stock desde movimientos ni
  reconcilia diferencias con aritmética propia.
- Coordinar cargas con funciones independientes por recurso y `Promise.allSettled`, no con un
  `Promise.all` que convierta un fallo parcial en dashboard completamente fallido.
- Centralizar invalidaciones en grupos (`catalog-stock`, `inventory-detail`, `alerts`, `sales`,
  `indicators`) para que una mutación declare qué lecturas refrescar sin acoplarse al HTML.
- Auditar al inicio qué rutas declaradas por los clientes están realmente montadas en el servidor
  local. Una ruta ausente debe demostrarse primero con una prueba; solo entonces se permite wiring
  mínimo hacia un servicio existente, sin otra implementación de inventario ni reglas nuevas.

No se añade caché persistente ni optimistic update de stock. Puede conservarse temporalmente la
respuesta de una venta como evidencia de éxito, pero el stock visible posterior solo vuelve a estado
vigente tras lecturas autoritativas exitosas.

### 4. Presentación

`renderBodegiaDashboard` dejará de llamar `createDemoInventoryData()`: recibirá el agregado y una
descripción de navegación derivada de capacidades. `renderExecutiveSummary`, `renderQuickSales`,
`renderOltp` y el dashboard BI consumirán las mismas proyecciones. Los estados se renderizan por
región, de modo que un historial de ventas disponible pueda coexistir con alertas temporalmente
fallidas sin presentar datos viejos como confirmados.

El Data Warehouse/DataMart de Inventario y su dashboard permanecen visibles para `owner_admin`
cuando sus capacidades lo permitan; quedan fuera para `inventory_manager` y `seller` sin la capacidad
correspondiente. “Permisos” deja de ser un módulo operativo separado: la gestión autorizada de roles y
permisos se integra en Empleados para `owner_admin`. Roadmap se elimina de la navegación operativa de
todos los roles.

`demo-data.ts` no será importado por `browser.ts`, `mvp-demo.ts` ni módulos de features conectadas. Si
las pruebas unitarias aún necesitan sus objetos, se conservará como fixture explícito; de lo
contrario podrá retirarse en implementación, siempre sin reemplazarlo por otro snapshot operativo.

## Flujo de carga inicial

1. Restaurar/autenticar la sesión local existente y obtener pertenencia y tenant activos.
2. Resolver roles y capacidades efectivas, crear una nueva `contextKey` y limpiar cualquier agregado
   asociado a otro contexto.
3. Construir navegación y módulos autorizados antes de solicitar/renderizar datos sensibles. No se
   solicitan miembros, costos, valorización o acciones administrativas si faltan capacidades.
4. Marcar cada recurso autorizado como `loading` y mostrar indicadores perceptibles sin valores de
   fixtures ni cifras anteriores.
5. Lanzar en paralelo las lecturas existentes de productos, lotes, balances, movimientos, alertas,
   ventas e indicadores requeridos por las superficies visibles.
6. Normalizar y proyectar cada respuesta para la capacidad vigente. Para `seller`, eliminar campos de
   costo defensivamente incluso si una respuesta defectuosa los incluyera.
7. Resolver cada recurso independientemente a `ready`, `empty` o `error`; preservar `correlationId`
   cuando `SafeWebApiError` lo proporcione.
8. Antes de aplicar cada resultado, comprobar la `contextKey`. Una respuesta de otro tenant o sesión
   se descarta y no queda retenida en el DOM ni en el estado.
9. Si la API responde `401` o indica contexto inactivo, cancelar cargas protegidas, borrar el agregado
   operativo y conducir a recuperación de sesión. Un `403/404` no habilita ni revela módulos.

## Flujo posterior a una venta

1. Validar datos para usabilidad, deshabilitar el botón y fijar `saleMutation = submitting`; conservar
   los valores del formulario mientras no exista confirmación.
2. Ejecutar una única vez `POST /tenants/current/sales`. La transacción, FEFO, concurrencia,
   auditoría y autorización siguen dentro del backend.
3. Si el POST falla, pasar a `failed`, mostrar un error seguro con `correlationId`, conservar entradas
   recuperables y permitir un reintento explícito del usuario. No asumir que hubo venta.
4. Si el POST responde éxito, guardar `saleId`/`saleNumber`, mostrar confirmación una sola vez y pasar
   a `confirmed`. Desde este punto el POST no vuelve a ejecutarse automáticamente.
5. Invalidar `products`, `lots`, `balances`, `movements`, `alerts`, `sales` e `indicators`; marcarlos
   `loading` o `stale` sin presentar los saldos previos como confirmados.
6. Recargar en paralelo todos los grupos con la misma `contextKey`. La siguiente lectura, no una resta
   local, resuelve operaciones concurrentes y productos agotados/desactivados.
7. Aplicar cada resultado independientemente. Si todos terminan, marcar la sincronización completa.
   Si alguno falla, mantener la venta confirmada, listar las regiones no sincronizadas y ofrecer
   “Reintentar actualización”.
8. El reintento ejecuta únicamente GET de los recursos fallidos/stale. Nunca reenvía el POST ni
   pierde la referencia a la venta confirmada.

## Modelo de estado web y sincronización parcial

| Estado | Significado visible | Datos permitidos | Recuperación |
|---|---|---|---|
| `loading` | Consulta en curso | Ningún valor previo como vigente | Esperar/cancelar por cambio de contexto |
| `ready` | Lectura autoritativa vigente | Payload validado y proyectado | Refrescar por invalidación |
| `empty` | Lectura exitosa sin resultados | Cero/colección vacía confirmados | Acción válida según capacidad |
| `error` | No se obtuvo una lectura inicial | Sin snapshot operativo | Reintentar GET; mostrar correlationId |
| `stale` | Existía dato, pero no se confirmó tras mutación | Puede mostrarse solo rotulado como desactualizado; nunca como vigente | Reintentar únicamente lecturas fallidas |

Las actualizaciones incluyen un identificador de ciclo para ignorar respuestas tardías. El
coordinador conserva por recurso `lastAttemptAt`, `receivedAt`, error seguro y ciclo de
sincronización, sin persistir datos operativos en `sessionStorage`. El éxito de una venta y el éxito
de su sincronización son estados distintos. Una recarga parcial no reemplaza el agregado completo ni
borra formularios que no dependan del recurso fallido.

## Navegación y permisos por rol

La navegación se genera desde requisitos de capacidades por módulo, no desde una lista fija. La
matriz es una proyección de experiencia; el backend conserva la decisión autoritativa.

| Superficie/capacidad | `owner_admin` | `inventory_manager` | `seller` |
|---|---:|---:|---:|
| Inicio operativo y stock | Sí | Sí | Sí, sin costos |
| Ventas rápidas e historial | Sí | Sí | Sí |
| Productos, categorías, unidades, lotes, balances, movimientos, alertas y FEFO | Lectura y gestión permitida | Lectura y gestión permitida | Solo catálogo/stock permitido para vender |
| Costos, pérdida estimada y valorización | Sí | Sí si la respuesta/capacidad lo autoriza | Nunca |
| Configuración de bodega | Sí | No | No |
| Empleados con gestión integrada de roles/permisos | Sí según capacidades de acceso | No | No |
| Data Warehouse/DataMart de Inventario y dashboard | Sí según capacidades | No | No |
| Módulo separado de Permisos | No | No | No |
| Roadmap | No | No | No |

Los requisitos concretos serán códigos como `inventory.products.read`, `inventory.products.write`,
`inventory.lots.read`, `inventory.stock.adjust`, `inventory.movements.read`,
`inventory.alerts.read`, `sales.read`, `sales.write` y `access.memberships.read/manage`. Una sección
sin su capacidad no se monta, no se enlaza y no inicia requests. Un deep link no autorizado muestra
un destino seguro/genérico sin contenido protegido. Al cambiar tenant se recalculan desde cero menú,
destino inicial, indicadores, columnas y acciones; si el destino actual deja de existir, se redirige
al primer destino autorizado.

Para `seller`, además de ocultar secciones, los tipos/proyecciones operativas eliminan `unitCost`,
`inventoryValuation`, `estimatedLoss` y cualquier dato de compra o derivado. No se muestran etiquetas
vacías ni ceros inferidos. La misma regla cubre estados de carga, vacío, error y mensajes.

## Manejo de errores y recuperación

- Preservar `code`, HTTP status y `correlationId` en un error web seguro; renderizar lenguaje de
  acción (“No se pudo actualizar el stock”) sin trazas ni detalles internos.
- Diferenciar error inicial, vacío confirmado y dato stale. No colapsar todos los recursos por el
  primer rechazo de una carga paralela.
- En `401`/sesión inválida, limpiar inmediatamente información operativa y solicitar sesión válida.
- En `403`, ocultar/deshabilitar el destino si el contexto de capacidades cambió y mantener el rechazo
  del backend como evidencia; no degradar a datos demo.
- En `404` por producto desactivado/ajeno, no revelar existencia y refrescar el catálogo propio.
- En `409` de stock o estado concurrente, conservar el formulario, explicar el conflicto y refrescar
  productos/stock antes de permitir una nueva decisión del usuario.
- Bloquear doble envío durante `submitting`. Una respuesta exitosa fija la venta como confirmada aun
  si todas las lecturas posteriores fallan.
- Permitir reintentos por recurso o por ciclo de lecturas; nunca reutilizar la acción “reintentar” para
  repetir una mutación confirmada.

## Responsive y accesibilidad

Se mantiene el lenguaje visual actual y se hacen ajustes incrementales, sin rediseño completo:

- A 320–560 px, navegación compacta y orden de contenido por prioridad; acciones principales dentro
  del flujo y sin overflow horizontal de página.
- A 768 px, grillas adaptables de una o dos columnas; a 1440 px, conservar densidad de escritorio.
- Tablas anchas dentro de `.table-wrap` con nombre accesible, scroll regional y encabezados
  asociables; cuando una tabla sea crítica en móvil, evaluar filas tipo tarjeta manteniendo etiquetas.
- Botones y controles táctiles con área suficiente, textos largos que envuelvan y formularios sin
  superposición.
- `nav` con nombre, enlace/destino actual mediante `aria-current`, títulos jerárquicos y landmarks.
- Foco `:focus-visible` perceptible, orden DOM lógico, operación completa por teclado y sin depender
  solo de color.
- Carga y confirmaciones con `role="status"`/`aria-live="polite"`; errores críticos con `role="alert"`;
  el foco se mueve al resumen de error cuando una acción falla sin secuestrar navegación rutinaria.
- Skeletons/spinners con texto accesible y respeto por `prefers-reduced-motion` si se usa animación.
- Contraste equivalente a AA y pruebas en 320, 768 y 1440 px.

## Archivos probablemente afectados durante implementación

### Web existentes

- `apps/web/src/demo/browser.ts`: orquestación de sesión, carga agregada, venta y resincronización.
- `apps/web/src/demo/mvp-demo.ts`: render puro desde estado/capacidades, navegación filtrada y estados.
- `apps/web/src/demo/demo-data.ts`: aislamiento como fixture de pruebas o eliminación si queda sin uso.
- `apps/web/src/api/client.ts`: preservación uniforme de errores seguros y cancelación/generaciones.
- `apps/web/src/api/inventory-client.ts`: normalización canónica y proyecciones sin costos.
- `apps/web/src/features/inventory-dashboard.ts`: convergencia con el agregado y estados por región.
- `apps/web/src/features/inventory/inventory-view.ts`: estado común, correlationId y refresh selectivo.
- `apps/web/src/features/products/product-catalog.ts`, `features/lots/lots-view.ts` y
  `features/alerts/alerts-view.ts`: adaptación al estado común y capacidades.
- `apps/web/src/features/bi/inventory-bi-client.ts` y `inventory-bi-dashboard.ts`: carga parcial y
  métricas autorizadas sin fixtures.
- `apps/web/demo/index.html`: responsive, foco visible, landmarks y estilos de estados.

### Web nuevos posibles

- `apps/web/src/features/dashboard/operational-dashboard-state.ts`: uniones de estado y agregado.
- `apps/web/src/features/dashboard/operational-dashboard-controller.ts`: carga, invalidación y ciclos.
- `apps/web/src/features/navigation/capability-navigation.ts`: definición tipada de destinos.
- `apps/web/src/api/sales-client.ts`: cliente tipado para lecturas/mutación de ventas.
- Posible adaptador en `apps/web/src/api/operational-data-adapter.ts`: normalización de respuestas
  resumidas y operativas al agregado, sin cálculos de stock.

Los nombres nuevos son orientativos y deberán respetar la estructura más simple al generar tareas.
No se necesita crear un paquete nuevo.

### Backend, solo si una brecha contractual queda demostrada

- `apps/api/src/http/main.ts`: wiring mínimo de una ruta declarada hacia un servicio ya existente o
  exposición de capacidades ya resueltas en la sesión demo, siempre después de una prueba local que
  demuestre la brecha; no cambiar reglas ni crear una segunda implementación.
- `apps/api/src/modules/sales/quick-sale.service.ts`: no se prevén cambios; solo se tocaría ante un
  defecto reproducible de contrato o autorización, sin alterar FEFO/transacción correctos.
- Contrato OpenAPI existente en `packages/api-contract`: sincronizar únicamente si la forma publicada
  no representa los endpoints ya implementados. No se diseñan endpoints nuevos en este plan.
- Prueba de boundary/rutas existente en `apps/api/test` o ubicación equivalente: demostrar el wiring
  ausente antes de cualquier ajuste permitido en `main.ts`.

### Pruebas

- `apps/web/test/demo.spec.ts`
- `apps/web/test/mvp-web.spec.ts`
- `apps/web/test/product-inventory.spec.tsx`
- `apps/web/test/bi-dashboard.spec.ts`
- `apps/web/e2e/access-admin.spec.ts`
- `apps/web/e2e/product-inventory.spec.ts`
- Posible suite nueva `apps/web/test/web-stabilization.spec.ts` y E2E
  `apps/web/e2e/web-stabilization.spec.ts` para trazabilidad específica del sprint 003.

## Estrategia de pruebas

### Unitarias (Vitest)

- Normalización de productos y stock desde la respuesta real; rechazo de formas inválidas.
- Contratos del adaptador para arreglo resumido, respuesta envuelta y página operativa; todos deben
  producir el modelo común sin calcular ni sobrescribir el stock autoritativo.
- `ResourceState`: transiciones carga/ready/empty/error/stale, correlationId y ciclos tardíos.
- Invalidation graph posterior a venta y reintento exclusivo de GET fallidos.
- Venta: bloqueo de doble submit; `confirmed` no vuelve a `submitting` por fallo de refresh.
- Matriz de capacidades para los tres roles y combinaciones de permisos efectivos.
- Prioridad de `activeTenant.capabilities`/permisos efectivos sobre el fallback de rol demo; el render
  general no consulta nombres de rol para decidir módulos cuando recibe capacidades.
- Cambio tenant/pertenencia: limpieza total e ignorado de respuestas de la generación anterior.
- Proyección `seller`: ausencia estructural y textual de costos/valorización en todos los estados.
- Render de estados vacíos, errores seguros y terminología consistente.
- Prueba anti-fixture: módulos conectados no importan `demo-data.ts` y el stock hardcodeado no aparece.

### Integración web local

Con `fetch` controlado o servidor API local y datos sintéticos:

- Carga inicial usa exclusivamente los endpoints existentes y compone el agregado.
- Un fallo de lotes no borra productos/ventas exitosos y marca lotes stale/error.
- Venta exitosa provoca exactamente un POST y refresca productos, ventas, lotes, balances,
  movimientos, alertas e indicadores.
- Fallo de una lectura posterior mantiene la venta confirmada; “Reintentar actualización” solo emite
  GET del recurso fallido.
- Dos respuestas concurrentes muestran el último saldo autoritativo, no una resta local.
- Producto agotado/desactivado actualiza cero/estado sin conservar el valor positivo previo.
- `401`, `403`, `404`, `409` y correlationId producen recuperación segura.
- Formas de respuesta paginada/arreglo se validan como contratos conservados de los endpoints
  existentes y se normalizan sin crear una segunda fuente de stock.
- Auditoría de rutas comprueba cada endpoint de inventario y BI declarado por los clientes. Una prueba
  roja documenta cualquier ruta sin montar antes del wiring mínimo, y la misma prueba debe pasar tras
  conectarla al servicio existente.

### E2E local (Playwright + PostgreSQL local)

- Para cada rol: login demo local, menú visible, módulos ausentes, acciones permitidas y deep link no
  autorizado sin contenido sensible.
- Para `owner_admin`: Data Warehouse/DataMart de Inventario y dashboard visibles; configuración y
  Empleados disponibles; roles/permisos integrados en Empleados; sin enlace operativo Roadmap ni
  módulo separado Permisos.
- Para `inventory_manager`: productos, categorías, unidades, lotes, stock, movimientos, alertas y
  FEFO visibles; sin configuración, empleados, Data Warehouse, Permisos separado ni Roadmap.
- Para `seller`: búsqueda global de textos/atributos sensibles y comprobación de que no se reciben o
  renderizan costos/valorización; solo catálogo/stock permitido, ventas rápidas e historial permitido.
- Stock idéntico en venta rápida, operación e indicadores antes y después de una venta real local;
  exactamente una venta registrada.
- Intercepción de una consulta postventa para simular sincronización parcial, mensaje stale y
  recuperación sin segundo POST.
- Estados loading/empty/error/retry por superficie.
- Cambio de contexto entre pertenencias con roles diferentes sin residuos del tenant anterior.
- Flujos de login, consulta y venta a 320, 768 y 1440 px: sin overflow de página, superposición ni
  acciones inaccesibles.
- Recorrido por teclado, foco visible, `aria-current`, anuncios de éxito/error y nombres accesibles.
- Regresión de aislamiento: sesión Tenant A no obtiene/renderiza recursos Tenant B y solicitudes
  directas no autorizadas siguen recibiendo rechazo backend.

Todas las pruebas con persistencia se ejecutan exclusivamente contra PostgreSQL local
`127.0.0.1:5432`, con datos sintéticos controlados y sin servicios remotos.

## Fases de implementación

1. **Auditoría local de contratos y wiring**: inventariar las rutas de inventario, BI, productos y
   ventas realmente montadas; agregar pruebas de boundary/contrato que demuestren cualquier brecha.
   Si una ruta declarada falta, conectar solo el wiring mínimo al servicio existente y hacer pasar la
   prueba, sin reglas, persistencia ni endpoints alternativos.
2. **Fundación de estado y normalización**: implementar contract tests del adaptador para las formas
   existentes, cliente de ventas, `ResourceState`, contexto/generación y modelo agregado. El stock de
   salida siempre conserva el valor autoritativo recibido.
3. **Carga autoritativa unificada (HU-001)**: conectar productos, lotes, balances, movimientos,
   alertas, ventas e indicadores; retirar imports operativos de `demo-data.ts`; estados por recurso.
4. **Venta y sincronización (HU-001, HU-003)**: separar confirmación de mutación y refresh, definir
   invalidaciones, `allSettled`, stale parcial y reintento solo de lecturas.
5. **Capacidades, navegación y privacidad (HU-002)**: priorizar permisos efectivos, limitar el rol al
   fallback demo, aplicar la matriz resuelta de módulos e imponer la proyección sin costos de `seller`.
6. **Estados, responsive y accesibilidad (HU-003, HU-004)**: mensajes, correlationId, foco/anuncios,
   tablas contenidas y breakpoints 320/768/1440 sin rediseño integral.
7. **E2E y regresión local**: escenarios de consistencia postventa, fallo parcial, roles, aislamiento,
   responsive y teclado; actualizar selectores manteniendo cobertura.
8. **Documentación y gate final**: comprobar trazabilidad FR/SC, ausencia de fixtures operativos,
   ausencia de migraciones y no contacto con servicios remotos.

## Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `/tenants/current/products` y los endpoints operativos tienen formas y riqueza distintas | Conservarlos, cubrir sus contratos y normalizarlos al agregado; ventas usa el resumen y las superficies ricas usan las lecturas operativas, siempre con stock recibido del backend |
| `Product` de inventario y `QuickSaleProduct` no comparten todos los campos (`salePrice`, categoría, reglas de paginación) | Definir `OperationalProduct` con procedencia explícita y no completar campos ausentes mediante snapshots o cálculos locales |
| `Promise.all` convierte un fallo parcial en dashboard vacío | Cargas por recurso con `allSettled`, estados independientes y reintento selectivo |
| Una venta confirmada se duplica al recuperar un refresh fallido | Estado de mutación separado; guardar `saleId`; reintentos postventa limitados a GET; prueba de un solo POST |
| Respuestas tardías mezclan tenant/rol anterior | `contextKey`, AbortController y descarte antes de escribir estado/DOM |
| Ocultar módulos da falsa seguridad | Mantener guards/permisos backend y pruebas directas 403/404/A-B |
| Costos se filtran por una vista o estado alternativo | Proyección defensiva en el límite de datos, tipos sin costo para seller y pruebas sobre HTML/estado completo |
| Quitar snapshots expone vacíos/errores preexistentes | Estados explícitos y recuperación se implementan en la misma fase que cada conexión |
| Refrescar todos los recursos degrada UX | Paralelizar grupos, conservar formularios y medir NFR-001; optimizar solo lecturas redundantes sin aritmética local |
| Cambios responsive rompen selectores E2E | Selectores semánticos/testid estables y pruebas en tres viewports antes de aceptar cambios |
| La sesión demo solo entrega un rol, no una lista de capacidades | Usar el catálogo compartido como adaptador local y preferir capacidades del contexto real; no ampliar autenticación |
| Un cliente declara una ruta de inventario/BI que el servidor local no monta | Detectarla con prueba de boundary en la primera fase y permitir solo wiring hacia el servicio existente; prohibir una implementación paralela |

## Criterios de rollback

La implementación deberá poder revertirse como cambio exclusivamente web/contractual, sin rollback
de base de datos. Se detiene o revierte si ocurre cualquiera de estos casos:

- una venta puede enviarse más de una vez por reintento automático o doble interacción;
- dos superficies muestran stock distinto tras completar su mismo ciclo de sincronización;
- un valor previo se presenta como vigente después de una lectura postventa fallida;
- `seller` recibe o renderiza costos, valorización, pérdida estimada o datos de compra;
- un cambio de tenant conserva navegación o datos del contexto anterior;
- se debilita una denegación backend, aislamiento multi-tenant, FEFO, auditoría o transacción de venta;
- la carga conectada vuelve a depender de `demo-data.ts` u otro snapshot operativo;
- fallan los recorridos locales de login, consulta o venta en 320/768/1440 px o por teclado;
- la solución exige tabla/migración, secreto, despliegue o servicio remoto no autorizado.

El rollback consiste en revertir los módulos web/coordinadores del sprint hasta el último estado local
estable y conservar intactas las ventas ya confirmadas en PostgreSQL. Nunca se compensa una venta
válida eliminando datos ni ejecutando migraciones inversas.

## Confirmación de persistencia y migraciones

**No se requieren ni se autorizan tablas nuevas, cambios de `schema.prisma`, migraciones Prisma,
seeds de negocio ni cambios de datos persistidos.** El modelo agregado descrito es estado efímero del
navegador. La API y PostgreSQL existentes continúan como fuente autoritativa.

## Decisiones técnicas resueltas

### Contratos y fuente de stock

- Se conservan los endpoints existentes. No se crea una ruta alternativa ni un nuevo cálculo de
  stock en la web.
- Un adaptador/normalizador web convierte las respuestas resumidas, envueltas o paginadas al modelo
  agregado común y conserva la procedencia autoritativa de cada cantidad.
- `GET /tenants/current/products` permanece como resumen válido para ventas rápidas. Las superficies
  ricas de inventario usan los endpoints operativos existentes de productos, lotes, balances,
  movimientos, alertas y FEFO.
- El stock visible siempre procede de respuestas del backend. La web no lo reconstruye desde
  movimientos, no mantiene una segunda fuente y no conserva snapshots operativos.
- Pruebas de contrato cubren cada forma de respuesta y pruebas de consistencia verifican igualdad de
  stock entre superficies para una misma generación de lectura y después de una venta.

### Permisos y roles

- `activeTenant.capabilities` o los permisos efectivos equivalentes son la entrada preferente para
  navegación, módulos, indicadores, columnas y acciones.
- El rol singular del login demo se usa exclusivamente como fallback dentro del adaptador demo local,
  derivando capacidades desde el catálogo compartido.
- El código general de presentación depende de capacidades. No decide visibilidad comparando un único
  nombre de rol cuando el contexto ya ofrece permisos efectivos.
- La adaptación web sigue siendo UX y privacidad defensiva; la autorización backend permanece intacta.

### Wiring de endpoints

- La primera fase audita, mediante pruebas locales, qué endpoints de inventario y BI declarados por
  los clientes están realmente montados en el servidor local.
- Si una prueba demuestra una ruta declarada pero desconectada, se permite únicamente wiring mínimo
  hacia el servicio existente. La prueba debe preceder al cambio y quedar como regresión.
- No se autoriza crear nuevas reglas de negocio, tablas, migraciones, endpoints alternativos ni una
  segunda implementación de inventario. FEFO, stock, transacciones y autorización no se duplican.

### Navegación ordinaria

- `owner_admin` conserva Data Warehouse/DataMart de Inventario y su dashboard, además de
  configuración de bodega y gestión de empleados, cuando sus capacidades efectivas lo permitan.
- La gestión de roles y permisos se integra en Empleados para `owner_admin`; “Permisos” no aparece
  como módulo operativo independiente.
- `inventory_manager` ve productos, categorías, unidades, lotes, stock, movimientos, alertas y FEFO,
  sin configuración exclusiva del propietario, empleados ni Data Warehouse cuando no tiene sus
  capacidades.
- `seller` ve catálogo/stock permitido, ventas rápidas e historial permitido, sin costos,
  valorización, configuración, empleados ni Data Warehouse.
- Roadmap se retira de la navegación operativa para todos los roles.

## Post-design Constitution Check

- **Trazabilidad — PASS**: arquitectura, flujos, pruebas, fases, riesgos y rollback cubren las cuatro
  historias y FR-001…FR-024; `tasks.md` se difiere expresamente.
- **Tenant y seguridad — PASS**: capacidades por pertenencia, clave de contexto, limpieza y pruebas
  A/B impiden mezcla entre bodegas; la UI nunca sustituye guards backend.
- **Integridad — PASS**: no se cambia la transacción de venta; confirmación y sincronización quedan
  separadas y no existe resta local ni reenvío automático.
- **Privacidad — PASS**: costos y derivados se eliminan defensivamente para `seller` en datos,
  navegación, contenido y estados alternativos.
- **UX y calidad — PASS**: estados distinguibles, recuperación parcial, responsive, teclado,
  correlationId y suites Vitest/Playwright locales están definidos.
- **Persistencia y alcance — PASS**: no hay migraciones, tablas, móvil, OCR, clientes, DataMart de
  Ventas, despliegues, secretos ni servicios remotos.

**Gate Result (post-design)**: PASS. No hay violaciones que requieran Complexity Tracking.

## Complexity Tracking

No se registran violaciones constitucionales. El agregado y coordinador propuestos consolidan
responsabilidades actualmente dispersas sin introducir servicios, persistencia o reglas de negocio
nuevos.
