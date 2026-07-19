# Feature Specification: Productos, inventario, lotes y vencimientos

**Feature Branch**: `002-product-inventory-lots`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Núcleo OLTP multi-bodega de productos, inventario, lotes,
vencimientos, FEFO y alertas para una bodega familiar"

## User Scenarios & Testing _(mandatory)_

### HU-001 / User Story 1 - Mantener el catálogo de productos (Priority: P1)

Como propietario administrador o responsable de inventario, quiero crear, editar, activar,
desactivar y buscar productos de mi bodega para mantener un catálogo operativo y consistente.

**Why this priority**: Sin un producto asociado al tenant no pueden registrarse lotes ni calcularse
existencias.

**Independent Test**: En una bodega sintética se puede crear un producto, editar sus datos,
desactivarlo, reactivarlo y buscarlo por nombre, SKU y código de barras sin observar productos de
otra bodega.

**Acceptance Scenarios**:

1. **Given** un `owner_admin` o `inventory_manager` con un tenant activo, **When** crea un producto
   con nombre, unidad y datos identificadores válidos, **Then** el producto queda activo y asociado
   exclusivamente a ese tenant.
2. **Given** un SKU o código de barras ya usado en el mismo tenant, **When** se intenta repetirlo,
   **Then** la operación se rechaza sin crear un duplicado.
3. **Given** un producto activo, **When** un rol autorizado lo desactiva, **Then** deja de aparecer
   en altas nuevas y conserva lotes, movimientos y auditoría histórica.
4. **Given** productos de Tenant A y Tenant B, **When** se busca desde el contexto A por nombre,
   SKU, código o identificador de B, **Then** no se revela ningún resultado de B.
5. **Given** un `seller`, **When** consulta productos y stock, **Then** puede leer el catálogo de su
   tenant pero no puede crear, editar, activar, desactivar ni consultar costos.

### HU-002 / User Story 2 - Registrar lotes e ingresos (Priority: P1)

Como propietario administrador o responsable de inventario, quiero registrar el ingreso de un
producto por lote con vencimiento, cantidad y costo para conservar la trazabilidad de lo recibido.

**Why this priority**: El lote es la unidad de trazabilidad que permite conocer vencimientos,
costos autorizados y existencias por entrada.

**Independent Test**: Se registra un lote para un producto del tenant activo, se consulta su detalle
y se verifica que el lote no puede apuntar a un producto inexistente o perteneciente a otro tenant.

**Acceptance Scenarios**:

1. **Given** un producto activo del tenant activo, **When** un rol autorizado registra un lote con
   fecha de vencimiento, cantidad inicial positiva y costo unitario válido, **Then** se crea el lote,
   su saldo inicial y un evento auditable en una operación atómica.
2. **Given** una fecha de vencimiento anterior al ingreso, **When** se intenta registrar el lote,
   **Then** se rechaza o se exige el flujo explícito de lote vencido autorizado, sin ocultar el
   motivo.
3. **Given** un producto de otro tenant o un producto inexistente, **When** se usa su identificador
   al crear un lote, **Then** se responde con error anti-enumeración y no se crea ninguna fila.
4. **Given** un lote registrado, **When** se consulta su trazabilidad, **Then** se observan producto,
   tenant, actor, fecha, cantidad inicial, saldo y vencimiento sin poder cambiar la historia original.

### HU-003 / User Story 3 - Controlar existencias y kardex (Priority: P1)

Como responsable de inventario, quiero consultar y ajustar el stock por producto y por lote para
conocer las existencias reales sin permitir saldos negativos.

**Why this priority**: El stock confiable es la base del trabajo diario y de las salidas futuras.

**Independent Test**: Con dos lotes se registran ingresos, ajustes positivos, ajustes negativos,
mermas y una salida futura; el stock total y el kardex coinciden y una operación que produciría
saldo negativo se rechaza de forma atómica.

**Acceptance Scenarios**:

1. **Given** lotes con saldo disponible, **When** se registra un ingreso o ajuste positivo,
   **Then** aumenta el saldo del lote y del producto y queda un movimiento inmutable con actor,
   motivo y tenant.
2. **Given** un lote con saldo insuficiente, **When** se registra ajuste negativo, merma o salida
   futura por una cantidad mayor al saldo, **Then** se rechaza toda la operación y no cambian ni el
   saldo ni el kardex.
3. **Given** un `seller`, **When** consulta stock, **Then** ve cantidades disponibles por producto
   y tenant, pero no costo unitario, costo total ni datos de compra.
4. **Given** dos operaciones concurrentes sobre el mismo lote, **When** ambas compiten por el saldo,
   **Then** solo se confirma una combinación que mantenga la invariantes y la otra se reintenta o se
   rechaza sin pérdida silenciosa.
5. **Given** un movimiento confirmado, **When** se intenta editarlo o borrarlo, **Then** se rechaza y
   se conserva la secuencia histórica; cualquier corrección usa un movimiento compensatorio auditado.

### HU-004 / User Story 4 - Aplicar FEFO y consultar vencimientos (Priority: P1)

Como responsable de inventario, quiero que el sistema ordene lotes por vencimiento próximo y sugiera
el lote correcto para una salida, evitando consumir productos vencidos salvo autorización explícita.

**Why this priority**: FEFO reduce mermas y prepara la operación para ventas futuras sin adelantar el
módulo de ventas.

**Independent Test**: Con tres lotes de fechas distintas, la sugerencia devuelve primero el vencimiento
más próximo disponible, omite lotes vencidos y registra una excepción manual autorizada cuando aplica.

**Acceptance Scenarios**:

1. **Given** varios lotes disponibles del mismo producto, **When** se solicita una sugerencia FEFO,
   **Then** se ordenan por vencimiento ascendente y, ante empate, por fecha de ingreso e identificador
   estable.
2. **Given** un lote vencido y otro vigente, **When** se solicita una salida futura, **Then** se
   sugiere el lote vigente y se excluye el vencido.
3. **Given** que solo existen lotes vencidos, **When** un `inventory_manager` intenta consumirlos,
   **Then** la operación se rechaza salvo que indique un ajuste manual autorizado con motivo y
   reautenticación conforme a la política vigente.
4. **Given** una excepción autorizada, **When** se consume un lote vencido, **Then** se registra la
   excepción y sus motivos en el kardex y la auditoría sin alterar la fecha histórica.

### HU-005 / User Story 5 - Recibir alertas operativas (Priority: P2)

Como propietario administrador o responsable de inventario, quiero ver alertas de stock bajo y de
vencimiento para actuar antes de una quiebra o merma.

**Why this priority**: Las alertas convierten el inventario registrado en decisiones operativas
accionables sin construir todavía un dashboard BI.

**Independent Test**: Se configuran umbrales por producto, se cambian saldos y fechas, y se verifica
que cada alerta se active, se resuelva y permanezca aislada al tenant.

**Acceptance Scenarios**:

1. **Given** un producto con umbral mínimo configurado, **When** su stock disponible queda por debajo
   del umbral, **Then** aparece una alerta de stock bajo para los roles autorizados.
2. **Given** un producto con días de aviso configurados, **When** un lote entra en la ventana de
   vencimiento, **Then** aparece una alerta de próximo vencimiento con lote y fecha.
3. **Given** un lote cuya fecha ya pasó, **When** se consulta el centro de alertas, **Then** aparece
   una alerta de vencido diferenciada de la alerta de próximo vencimiento.
4. **Given** que el saldo o la fecha dejan de cumplir la condición, **When** se recalculan alertas,
   **Then** la alerta se resuelve sin borrar la historia de que ocurrió.
5. **Given** Tenant A y Tenant B, **When** se consulta el listado de alertas desde A, **Then** no se
   devuelve ni se filtra información de B.

### HU-006 / User Story 6 - Operar desde web y móvil (Priority: P2)

Como miembro autorizado, quiero usar la web para administrar el inventario y el móvil para consultar
rápidamente productos, registrar ingresos básicos y revisar alertas.

**Why this priority**: La bodega necesita una vista administrativa completa y una operación móvil
simple, pero ambas deben reutilizar las mismas reglas autorizadas del backend.

**Independent Test**: En una sesión de desarrollo controlada se completan las pantallas web de
productos, inventario, lotes y filtros, y en móvil se consulta un producto, se registra un ingreso y
se revisan alertas sin acceso directo a PostgreSQL.

**Acceptance Scenarios**:

1. **Given** una sesión web autorizada, **When** abre productos, inventario o lotes, **Then** solo
   observa el tenant activo y los campos permitidos por su pertenencia.
2. **Given** una sesión móvil autorizada, **When** consulta un producto o registra un ingreso básico,
   **Then** la operación usa la API, muestra estados de carga/vacío/error y actualiza el stock visible.
3. **Given** el intento de utilizar OCR o escáner antes de su incremento aprobado, **When** se inicia
   el flujo, **Then** se muestra que la capacidad no está disponible y no se persiste una fecha no
   confirmada.

### Edge Cases

- Nombre, SKU o código de barras vacío, excesivamente largo o con caracteres no permitidos se rechaza
  con errores de validación seguros.
- SKU y código de barras son únicos por tenant; el mismo valor puede existir en otro tenant sin que
  una búsqueda revele esa existencia.
- Categorías y unidades de medida son configurables y obligatoriamente tenant-scoped; una categoría
  o unidad de otro tenant se trata como inexistente y nunca se acepta en una relación.
- Un producto desactivado no admite nuevos lotes, pero mantiene lotes, movimientos, costos y auditoría
  histórica para roles autorizados.
- Un lote requiere producto del mismo tenant, fecha válida, cantidad inicial positiva y costo no
  negativo; no se aceptan referencias cruzadas.
- Cantidad cero, precisión incompatible con la unidad o cantidad que produzca saldo negativo se rechaza
  antes de confirmar la transacción.
- El redondeo de cantidades y costos usa la precisión definida por unidad y moneda del tenant; no se
  permiten valores NaN, infinitos ni desbordamientos.
- Un movimiento repetido con la misma clave de idempotencia no duplica stock; la misma clave con payload
  diferente se rechaza.
- Dos movimientos concurrentes sobre el mismo lote no pueden dejar saldo negativo ni perder uno de los
  cambios confirmados.
- Un lote vencido no se consume por FEFO normal; una excepción exige permiso, motivo y auditoría.
- Desactivar un producto no elimina alertas, lotes ni movimientos; los estados se resuelven conforme a
  reglas explícitas.
- El acceso a costos, alertas y movimientos se deniega sin revelar si el producto o lote existe en otro
  tenant.
- El móvil y la web no escriben directamente en PostgreSQL y no pueden omitir `TenantContext`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El sistema MUST crear productos y unidades de medida asociados exclusivamente al tenant
  activo, y cada producto MUST referenciar una unidad válida del mismo tenant. (US1, AS1)
- **FR-002**: El sistema MUST permitir crear, editar, activar y desactivar categorías y unidades, y
  editar nombre, categoría, unidad, SKU, código de barras, umbral mínimo, días de alerta y estado de
  un producto mediante roles autorizados. (US1, AS3; US5, AS1-AS3)
- **FR-003**: El sistema MUST mantener unicidad de SKU y código de barras dentro de cada tenant y
  rechazar duplicados sin revelar datos de otro tenant. (US1, AS2-AS4)
- **FR-004**: El sistema MUST permitir activar y desactivar productos con borrado lógico, conservando
  lotes, movimientos, costos y auditoría. (US1, AS3; Edge Cases)
- **FR-005**: El sistema MUST buscar y listar productos por nombre, SKU o código de barras, siempre
  filtrando por `TenantContext` y estado solicitado. (US1, AS4)
- **FR-006**: El sistema MUST permitir consultar productos y stock disponible a `seller` sin exponer
  costos unitarios, costos totales, proveedor ni datos de compra. (US1, AS5; US3, AS3)
- **FR-007**: El sistema MUST registrar un lote solo si referencia un producto activo del mismo tenant.
  (US2, AS1-AS3)
- **FR-008**: El sistema MUST almacenar por lote fecha de vencimiento, cantidad inicial, saldo,
  costo unitario, fecha de ingreso, actor y tenant, preservando los valores originales. (US2, AS1-AS4)
- **FR-009**: El sistema MUST rechazar lotes con cantidad no positiva, costo inválido, fecha inválida
  o producto inexistente/cross-tenant. (US2, AS2-AS3; Edge Cases)
- **FR-010**: El sistema MUST impedir nuevos lotes para productos desactivados salvo un flujo
  administrativo explícitamente autorizado y auditado. (US1, AS3; US2, AS1)
- **FR-011**: El sistema MUST calcular stock disponible por producto como la suma de saldos de sus
  lotes del tenant activo. (US3, AS1-AS3)
- **FR-012**: El sistema MUST registrar movimientos de ingreso, ajuste positivo, ajuste negativo,
  merma y salida futura con actor, tenant, producto, lote, cantidad, motivo, fecha y saldo resultante.
  (US3, AS1-AS5)
- **FR-013**: El sistema MUST impedir stock negativo en cada lote y en el total del producto, con
  rollback completo si una operación falla. (US3, AS2-AS4)
- **FR-014**: El sistema MUST conservar el kardex append-only y corregir movimientos solo mediante
  movimientos compensatorios autorizados. (US3, AS5)
- **FR-015**: El sistema MUST soportar idempotencia para registrar movimientos y rechazar la misma
  clave cuando el payload sea diferente. (US3, Edge Cases)
- **FR-016**: El sistema MUST proteger actualizaciones concurrentes del mismo lote mediante una
  condición de versión o equivalente que no permita pérdida silenciosa de cambios. (US3, AS4)
- **FR-017**: El sistema MUST ordenar sugerencias FEFO por vencimiento ascendente, fecha de ingreso e
  identificador estable, considerando solo saldo disponible. (US4, AS1)
- **FR-018**: El sistema MUST excluir lotes vencidos de salidas FEFO normales y permitir su consumo
  solo mediante ajuste manual autorizado, con motivo y auditoría. (US4, AS2-AS4)
- **FR-019**: El sistema MUST exponer una sugerencia FEFO reutilizable por futuras ventas sin crear
  todavía el módulo de ventas ni registrar una venta real. (US4, AS1-AS2)
- **FR-020**: El sistema MUST configurar por producto el stock mínimo y los días de alerta de
  vencimiento, con valores asociados al tenant. (US5, AS1-AS3)
- **FR-021**: El sistema MUST generar alertas tenant-scoped de stock bajo, próximo a vencer y vencido,
  con estado activo/resuelto e historial mínimo. (US5, AS1-AS5)
- **FR-022**: El sistema MUST permitir consultar, filtrar y resolver alertas sin exponer alertas de
  otro tenant. (US5, AS4-AS5)
- **FR-023**: La web MUST ofrecer administración de productos, categorías, unidades, inventario,
  lotes/vencimientos y filtros por categoría, estado, stock bajo y vencimiento mediante la API REST;
  también MUST ofrecer un listado tenant-wide de lotes paginado y filtrable, con etiquetas accesibles,
  foco/teclado predecibles y mensajes comprensibles de carga, vacío y error. (US6, AS1)
- **FR-024**: La aplicación móvil MUST ofrecer consulta rápida de productos, registro básico de
  ingreso de lote y vista de alertas mediante la API REST, con etiquetas accesibles y estados
  comprensibles de carga, vacío y error. (US6, AS2)
- **FR-025**: El sistema MUST dejar preparado un punto de integración para escáner de código de
  barras y OCR de vencimiento sin implementar OCR ni persistir fechas no confirmadas. (US6, AS3)
- **FR-026**: Toda operación de productos, categorías, unidades, lotes, movimientos y alertas MUST validar `TenantContext`,
  pertenencia activa y permisos derivados del rol de esa pertenencia. (US1-US6)
- **FR-027**: El sistema MUST rechazar lecturas, listados, escrituras, filtros, cursores e IDs de
  Tenant B cuando el contexto autorizado sea Tenant A, usando un error anti-enumeración seguro y sin
  cambios parciales. (US1, AS4; US2, AS3; US5, AS5)
- **FR-028**: Los repositorios MUST exigir el tenant autorizado y aplicar la condición de tenant en
  relaciones, claves únicas, actualizaciones, borrados lógicos y consultas anidadas. (US1-US5)
- **FR-029**: `owner_admin` MUST tener acceso total al alcance de esta funcionalidad; `inventory_manager`
  MUST administrar productos, categorías, unidades, lotes, inventario y alertas; `seller` MUST
  consultar productos, categorías, unidades y stock sin costos. (US1, AS5; US3, AS3; US5)
- **FR-030**: El sistema MUST impedir permisos globales de inventario y derivar autorización de la
  pertenencia y el tenant activo. (US1, AS5; US6, AS1-AS2)
- **FR-031**: El sistema MUST registrar `AuditEvent` inmutable para creación/edición/estado de
  productos, categorías y unidades, altas de lotes, movimientos, ajustes, excepciones FEFO, cambios
  de umbral y resolución de alertas sensibles. (US1-US5)
- **FR-032**: Cada evento auditable MUST incluir actor, tenant, sesión/dispositivo cuando esté
  disponible, operación, fecha, resultado, motivo y valores anterior/nuevo sin secretos. (US2, AS4; US3, AS1; US5, AS4)
- **FR-033**: Los cambios de stock, lote y producto MUST ejecutarse en transacciones explícitas que
  reviertan completamente ante error de persistencia, auditoría o validación. (US2, AS1; US3, AS2-AS4)
- **FR-034**: El sistema MUST conservar físicamente lotes, movimientos, alertas resueltas y auditoría;
  la desactivación será lógica y no eliminará historia. (US1, AS3; US3, AS5; US5, AS4)
- **FR-035**: El sistema MUST validar formato, longitud, precisión, timestamps UTC, fechas de negocio
  de vencimiento, cantidades y costos en servidor además de las validaciones de cliente, sin aceptar
  `any` ni valores no finitos en contratos.
  (US1-US6)
- **FR-036**: Las respuestas y errores MUST omitir costos y datos internos para `seller`, y omitir
  identificadores o estados de recursos pertenecientes a otro tenant. (US1, AS4-AS5; US3, AS3)
- **FR-037**: El sistema MUST soportar paginación y filtros tenant-scoped para productos, lotes
  (incluido el listado tenant-wide con producto, categoría, estado, vencimiento y stock), movimientos,
  alertas y auditoría, sin permitir reutilizar cursores de otro tenant. (US1, AS4; US5, AS5)
- **FR-038**: El sistema MUST devolver `correlationId` y errores seguros para validaciones, conflictos
  de concurrencia, stock insuficiente, lote vencido no autorizado y referencias cross-tenant. (US2, AS3; US3, AS2-AS4; US4, AS3)
- **FR-039**: Los contratos REST de la funcionalidad MUST documentar entradas, respuestas, estados,
  permisos, errores y campos visibles por rol en OpenAPI. (US1-US6)
- **FR-040**: Las pruebas MUST cubrir unidades de FEFO/stock/alertas, persistencia y constraints,
  contratos, integración transaccional, aislamiento A/B, privacidad de costos, regresión del módulo
  001 y los flujos web/móvil principales. (US1-US6)
- **FR-041**: La suite MUST incluir pruebas negativas antes o junto a la implementación de operaciones
  sensibles, incluyendo referencias cruzadas, cantidades negativas, vencidos, conflictos e
  idempotencia. (US2-US5)
- **FR-042**: La configuración de categorías, unidades, umbrales y alertas MUST pertenecer al tenant,
  mantener unicidad dentro de ese tenant y no codificarse como constantes globales. (US1, AS1; US5, AS1)
- **FR-043**: Las migraciones de PostgreSQL MUST ser versionadas, reversibles o acompañadas de un
  plan de rollback y nunca ejecutarse contra producción durante pruebas. (US1-US6)
- **FR-044**: El diseño MUST permanecer compatible con futuras ventas, clientes, OCR, BI, promociones,
  reposición inteligente, app de consumidores y modo offline sin implementar esas capacidades en
  este MVP. (US4, AS1-AS2; US6, AS3)

### Key Entities

- **Product**: Catálogo de un producto perteneciente a un tenant; incluye nombre, SKU, código de
  barras, categoría, unidad, estado, umbral mínimo, días de alerta y versión de concurrencia.
- **ProductCategory**: Categoría tenant-scoped reutilizable por productos activos e históricos.
- **UnitOfMeasure**: Unidad configurable obligatoriamente perteneciente a un tenant, con código, nombre,
  estado y precisión de cantidad; no existen unidades compartidas entre tenants.
- **Lot**: Entrada trazable de un producto con vencimiento, ingreso, cantidad inicial, saldo, costo
  unitario, estado y tenant.
- **InventoryMovement**: Registro append-only de ingreso, ajuste, merma o salida futura; referencia
  obligatoria a tenant, producto y lote, actor, cantidad, motivo, saldo y fecha.
- **InventoryBalance**: Proyección consistente del saldo por producto/lote para lecturas rápidas,
  siempre derivable del kardex y protegida contra divergencia.
- **AlertRule**: Umbral de stock mínimo y ventana de vencimiento configurados por producto y tenant.
- **InventoryAlert**: Alerta tenant-scoped de stock bajo, próximo a vencer o vencido, con estado,
  timestamps y referencia al lote/producto.
- **AuditEvent**: Registro inmutable de cambios sensibles con actor, tenant, operación, resultado,
  motivo y valores anterior/nuevo sanitizados.
- **IdempotencyRecord**: Evidencia de clave y payload de operaciones mutantes, asociada al tenant
  para evitar duplicar movimientos.

### Constitutional Requirements _(mandatory)_

- **Tenant Isolation**: Cada producto, categoría, unidad configurable, lote, saldo, movimiento,
  alerta, regla e idempotencia se asocia a un tenant; `TenantContext`, Membership y repositorios
  tenant-aware son obligatorios y todo intento A/B se rechaza sin enumeración.
- **Roles and Authorization**: Los permisos se derivan de la pertenencia; `owner_admin` tiene alcance
  total, `inventory_manager` opera inventario y `seller` consulta sin costos. No hay permisos globales.
- **Transactions and Concurrency**: Alta de lote y movimientos son atómicos; stock negativo,
  conflictos de versión, idempotencia y rollback de auditoría/persistencia están definidos.
- **Audit and Historical Record**: Productos y reglas se desactivan lógicamente; lotes, movimientos,
  alertas resueltas y auditoría permanecen append-only o históricamente conservados.
- **Security and Privacy**: Se validan entradas en cliente y servidor, se ocultan costos a vendedores,
  se usan errores seguros, las respuestas operativas no incluyen costos y las respuestas administrativas
  de lotes/saldos los incluyen solo para `owner_admin` e `inventory_manager`; no se exponen datos de otro tenant.
- **Lot and FEFO Rules**: Vencimientos pertenecen al lote; salidas sugeridas aplican FEFO y los lotes
  vencidos requieren excepción manual autorizada y auditada.
- **Human Confirmation**: OCR no forma parte del MVP; cualquier futura fecha leída por cámara deberá
  confirmarse y corregirse antes de persistirse.
- **Environment Boundaries**: Desarrollo, pruebas y CI usan PostgreSQL y datos sintéticos separados;
  no se usan datos reales ni Supabase remoto para validar esta funcionalidad.
- **Out of Scope**: Ventas, clientes, OCR, BI/Data Warehouse, promociones automáticas, precio óptimo
  IA, reposición inteligente, app de consumidores, offline y cualquier pairing/soporte posterior.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100% de los productos, lotes, movimientos y alertas creados en pruebas de aislamiento
  conserva el tenant correcto y el 100% de los intentos A/B esperados se rechaza sin datos parciales.
- **SC-002**: El 100% de los ingresos y movimientos válidos actualiza el stock de producto y lote,
  kardex y auditoría en una operación consistente; el 100% de los intentos de stock negativo se
  rechaza sin cambios.
- **SC-003**: En pruebas controladas, al menos el 95% de las búsquedas y consultas de inventario
  devuelve una respuesta visible para el usuario en menos de 1 segundo.
- **SC-004**: El 100% de las sugerencias FEFO de prueba ordena correctamente lotes vigentes por
  vencimiento, y ningún lote vencido se consume por el flujo normal.
- **SC-005**: El 100% de los casos de stock bajo, próximo a vencer y vencido genera la alerta correcta,
  la mantiene aislada por tenant y permite resolverla sin borrar su evidencia histórica.
- **SC-006**: El 100% de las respuestas para `seller` omite costo unitario, costo total y datos de
  compra, mientras que los roles autorizados pueden consultar esos campos dentro de su tenant.
- **SC-007**: El 100% de las mutaciones sensibles produce un evento de auditoría sanitizado con actor,
  tenant, operación, resultado y fecha; una falla transaccional no deja operación sin auditoría.
- **SC-008**: Al menos el 90% de una cohorte de cuatro usuarios internos sintéticos —que incluya como
  mínimo un `owner_admin` o responsable de bodega, un `inventory_manager` o encargado de inventario y
  un `seller` o vendedor operativo— completa en menos de 2 minutos cada escenario de consulta de
  producto, registro básico de lote y revisión de alertas, sin ayuda correctiva en el primer intento.
  La medición MUST registrar tiempo individual, finalización, errores, comprensión de alertas,
  confirmación de que `seller` no identifica campos de costo y comentarios cualitativos en
  `specs/002-product-inventory-lots/evidence/usability.md`; no se consideran resultados válidos sin
  protocolo y consentimiento/privacidad documentados.
- **SC-009**: En una prueba de concurrencia con al menos 20 operaciones sobre el mismo lote, no se
  produce saldo negativo ni pérdida silenciosa; cada conflicto se informa de forma segura.
- **SC-010**: Las suites unitarias, persistencia, contrato, integración, seguridad, regresión del
  módulo 001 y superficies web/móvil pasan en CI sin usar producción, Supabase remoto ni datos reales.

## Assumptions

- El módulo 001 ya entrega sesión, `TenantContext`, Membership, RBAC, auditoría base, idempotencia
  y controles de aislamiento reutilizables.
- Cada producto tiene una unidad de medida principal en este MVP; productos por peso, balanzas y
  conversiones complejas quedan para una evolución posterior.
- SKU y código de barras son opcionales individualmente, pero cualquier valor informado es único por
  tenant; no se exige unicidad global.
- Los costos se almacenan y muestran solo a `owner_admin` e `inventory_manager`; la moneda y precisión
  del tenant existente se reutilizan sin crear ventas.
- `expiresAt` se transporta como fecha ISO (`format: date`) y se evalúa al inicio del día operativo
  local configurado por el tenant; los timestamps de ingreso y auditoría permanecen en UTC.
- `SALE_OUT` se modela como tipo de movimiento preparado para la integración futura; este MVP no crea
  pedidos, ventas, clientes ni comprobantes.
- Las fechas de vencimiento se reciben como dato digitado o confirmado por el usuario. El escáner y
  OCR solo tendrán contratos de extensión, no implementación.
- Los umbrales por defecto son configurables por tenant/producto y se establecen explícitamente al
  crear o editar un producto; no se infieren de datos comerciales.
- Las pruebas usan UUID, fechas UTC y datos sintéticos deterministas en PostgreSQL de pruebas.
