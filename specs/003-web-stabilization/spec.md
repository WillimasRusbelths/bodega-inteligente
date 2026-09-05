# Feature Specification: Estabilización funcional de la web

**Feature Branch**: `003-web-stabilization`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Estabilizar la experiencia web, unificar el stock operativo y adaptar navegación, datos y acciones a cada rol"

## Objetivo

Estabilizar la aplicación web para que presente información operativa coherente y actualizada, adapte
la experiencia al rol efectivo de la pertenencia activa y comunique claramente los estados de carga,
vacío, error y confirmación, sin ampliar las capacidades de negocio ni sustituir la autorización del
backend.

## Alcance

- Superficies web de ventas rápidas, inventario operativo, indicadores y navegación.
- Consumo coherente de las fuentes autoritativas ya disponibles para productos, stock, lotes,
  movimientos, alertas, ventas y resúmenes aplicables.
- Visibilidad de módulos, indicadores, datos y acciones según `owner_admin`, `inventory_manager` y
  `seller` en la pertenencia y bodega activas.
- Actualización visible después de ventas y otras operaciones confirmadas.
- Estados de carga, vacío, error y recuperación; navegación consistente; etiquetas comprensibles;
  comportamiento responsive y accesibilidad básica.
- Pruebas web y de sistema que prevengan regresiones de consistencia, roles y actualización.
- Documentación propia del sprint.

## Actores

- **Propietario administrador (`owner_admin`)**: administra su bodega y puede consultar y operar las
  funciones administrativas, de inventario y ventas permitidas por el backend.
- **Responsable de inventario (`inventory_manager`)**: gestiona catálogo, lotes, stock, movimientos,
  alertas y FEFO; consulta costos y valorización cuando el permiso vigente lo autoriza.
- **Vendedor (`seller`)**: consulta productos y stock y registra ventas permitidas, sin acceder a
  costos, valorización, configuración ni administración de miembros.

## User Scenarios & Testing *(mandatory)*

### HU-001 — Consultar stock operativo coherente (Priority: P1)

Como miembro de una bodega, quiero ver el mismo stock vigente de un producto en todas las superficies
operativas para tomar decisiones y registrar operaciones con información confiable.

**Why this priority**: Mostrar cantidades contradictorias puede provocar ventas fallidas, reposición
innecesaria y pérdida de confianza en todo el sistema.

**Independent Test**: Puede probarse con un producto visible en ventas rápidas e inventario, registrando
una venta y verificando que todas las superficies muestran la misma cantidad inicial y final obtenida
del tenant activo.

**Acceptance Scenarios**:

1. **Given** un producto con stock disponible en la bodega activa, **When** el usuario consulta ventas
   rápidas, operación diaria e indicadores operativos, **Then** todas las superficies muestran la misma
   cantidad autoritativa para ese momento.
2. **Given** una venta confirmada que descuenta unidades de uno o más lotes, **When** termina la
   operación, **Then** productos, ventas rápidas, lotes, stock e indicadores afectados muestran el
   saldo posterior sin requerir cerrar sesión ni recargar manualmente la página completa.
3. **Given** datos de demostración o snapshots incluidos en el cliente, **When** se presenta una
   superficie operativa conectada, **Then** esos datos no se renderizan como si fueran datos vigentes.
4. **Given** que una actualización posterior a una operación no puede completarse, **When** la web no
   puede confirmar el saldo vigente, **Then** informa que los datos podrían estar desactualizados,
   evita presentar el valor anterior como confirmado y ofrece reintentar.

---

### HU-002 — Trabajar con una experiencia pertinente al rol (Priority: P1)

Como miembro de una bodega, quiero ver solamente la navegación, información y acciones pertinentes a
mis permisos para concentrarme en mi trabajo y no inferir capacidades que no puedo utilizar.

**Why this priority**: Mostrar módulos bloqueados como navegación normal confunde al usuario y aumenta
el riesgo de exponer información sensible, especialmente costos y valorización.

**Independent Test**: Puede probarse iniciando sesiones separadas para los tres roles y comparando
navegación, indicadores, secciones, campos y acciones visibles, además de intentar directamente una
operación no autorizada contra el backend.

**Acceptance Scenarios**:

1. **Given** una sesión `owner_admin`, **When** se muestra el área de trabajo, **Then** aparecen las
   funciones administrativas, de inventario y ventas autorizadas para la bodega activa.
2. **Given** una sesión `inventory_manager`, **When** se muestra el área de trabajo, **Then** aparecen
   catálogo, lotes, stock, movimientos, alertas y demás funciones operativas autorizadas, pero no la
   administración exclusiva del propietario.
3. **Given** una sesión `seller`, **When** se muestra el área de trabajo, **Then** aparecen únicamente
   consulta operativa de productos y stock y ventas permitidas, sin módulos administrativos, costos,
   valorización, costos de compra ni acciones de gestión de inventario.
4. **Given** cualquier rol, **When** carece de permiso para un módulo, **Then** el módulo y su enlace no
   se muestran como parte de la navegación ordinaria, en vez de renderizar una sección bloqueada.
5. **Given** que el cliente oculta una opción no autorizada, **When** el usuario intenta invocar la
   operación por otro medio, **Then** el backend continúa validando tenant, pertenencia y permisos y
   rechaza la solicitud de forma segura.

---

### HU-003 — Comprender y recuperar estados de la interfaz (Priority: P2)

Como usuario de la web, quiero reconocer cuándo una sección está cargando, no tiene información o
falló, y saber cómo continuar, para no confundir ausencia temporal con un resultado real.

**Why this priority**: Una interfaz estable debe hacer explícito el estado de cada operación y permitir
recuperarse de fallos locales o transitorios sin perder el trabajo innecesariamente.

**Independent Test**: Puede probarse simulando respuestas pendientes, colecciones vacías, errores
seguros y recuperación posterior para cada superficie de datos incluida en el sprint.

**Acceptance Scenarios**:

1. **Given** una consulta en curso, **When** todavía no existe respuesta, **Then** la sección muestra un
   estado de carga identificable y no presenta valores anteriores como vigentes.
2. **Given** una consulta exitosa sin resultados, **When** finaliza, **Then** la sección muestra un
   estado vacío específico y comprensible, distinto de un error.
3. **Given** una consulta u operación fallida, **When** se recibe un error seguro, **Then** la web
   comunica qué acción no se completó, conserva el identificador de correlación cuando esté disponible
   y ofrece una recuperación apropiada sin exponer detalles internos.
4. **Given** un formulario con datos válidos que falla por una causa recuperable, **When** se muestra el
   error, **Then** los datos ingresados se conservan siempre que hacerlo sea seguro y el usuario puede
   reintentar sin duplicar una operación ya confirmada.

---

### HU-004 — Navegar y operar en distintos tamaños de pantalla (Priority: P2)

Como usuario con computadora, tableta o teléfono, quiero navegar y completar los flujos web principales
sin perder información ni acciones para poder usar BodegIA en el contexto cotidiano de la bodega.

**Why this priority**: La operación diaria puede realizarse desde pantallas pequeñas y necesita
controles legibles, orden estable y acciones accesibles.

**Independent Test**: Puede probarse recorriendo inicio de sesión, consulta de stock y venta rápida en
anchos representativos de teléfono, tableta y escritorio, usando teclado y controles táctiles.

**Acceptance Scenarios**:

1. **Given** una pantalla desde 320 píxeles de ancho, **When** el usuario navega por las secciones
   permitidas, **Then** no existe desplazamiento horizontal de la página, superposición de controles ni
   contenido crítico inaccesible.
2. **Given** una tabla con más columnas que el espacio disponible, **When** se consulta en una pantalla
   pequeña, **Then** mantiene encabezados y valores comprensibles mediante una presentación adaptada o
   desplazamiento contenido en la propia región.
3. **Given** navegación por teclado, **When** el usuario recorre enlaces, formularios y acciones,
   **Then** el foco es visible, el orden es lógico y los estados y errores se anuncian de forma
   perceptible.

### Edge Cases

- Una venta confirmada responde correctamente, pero falla una de las consultas de actualización
  posteriores: la venta no debe repetirse y las superficies afectadas deben marcarse como no
  sincronizadas hasta recuperar datos vigentes.
- Dos operaciones concurrentes modifican el mismo producto: la siguiente lectura debe mostrar el saldo
  confirmado por la fuente autoritativa, nunca un cálculo local acumulado sobre un snapshot anterior.
- Un producto queda sin stock o sin lotes disponibles: todas las superficies muestran cero y el estado
  correspondiente, sin conservar el último valor positivo.
- Un producto se desactiva entre la carga y una operación: la interfaz informa el rechazo seguro y
  actualiza el catálogo sin revelar datos de otro tenant.
- La sesión, pertenencia o bodega deja de estar activa durante el uso: se detienen las consultas
  protegidas, se elimina información operativa obsoleta de la vista y se solicita recuperar una sesión
  válida.
- Un usuario posee roles diferentes en dos bodegas: al cambiar la bodega activa se recalculan por
  completo navegación, datos, indicadores y acciones, sin conservar elementos del tenant anterior.
- Una respuesta omite campos opcionales de costo para `seller`: la vista sigue siendo usable y no
  muestra etiquetas vacías, ceros inferidos ni señales que permitan deducir el valor protegido.
- Una colección extensa o una etiqueta larga no rompe la navegación ni oculta la acción principal.
- Un enlace directo apunta a una sección no visible para el rol: no se renderiza información sensible
  y la denegación del backend sigue siendo autoritativa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Todas las superficies web operativas MUST obtener productos, stock, lotes, movimientos,
  alertas, ventas e indicadores vigentes desde fuentes autoritativas del backend para el tenant activo;
  MUST NOT presentar snapshots, mocks o constantes del cliente como datos reales. (HU-001, AS1-AS3)
- **FR-002**: La cantidad disponible de un producto MUST tener una interpretación común en todas las
  superficies y coincidir con el saldo autoritativo agregado de sus lotes/balances aplicables dentro
  del tenant activo. (HU-001, AS1)
- **FR-003**: Después de confirmar una venta u otra operación que altere inventario, la web MUST
  actualizar todas las superficies afectadas antes de tratarlas como vigentes. (HU-001, AS2-AS4)
- **FR-004**: La actualización posterior MUST reutilizar el resultado confirmado o volver a consultar
  la fuente autoritativa; MUST NOT ajustar el stock solamente mediante aritmética local susceptible a
  concurrencia. (HU-001, AS2; Edge Cases)
- **FR-005**: Si la actualización posterior falla total o parcialmente, la web MUST distinguir las
  superficies no sincronizadas, impedir que un valor anterior parezca confirmado y permitir reintentar
  sin repetir la operación mutante. (HU-001, AS4; HU-003, AS3-AS4)
- **FR-006**: La navegación MUST construirse según los permisos efectivos de la pertenencia y tenant
  activos y MUST recalcularse al cambiar cualquiera de esos contextos. (HU-002, AS1-AS4; Edge Cases)
- **FR-007**: Los módulos no autorizados MUST quedar fuera de la navegación ordinaria y no MUST
  renderizarse como paneles bloqueados que distraigan al usuario. (HU-002, AS4)
- **FR-008**: `owner_admin` MUST ver las capacidades administrativas, de inventario y ventas que el
  backend autorice para la bodega activa. (HU-002, AS1)
- **FR-009**: `inventory_manager` MUST ver capacidades operativas de productos, categorías, unidades,
  lotes, stock, movimientos, alertas y FEFO, además de las ventas permitidas, pero MUST NOT ver
  administración exclusiva del propietario. (HU-002, AS2)
- **FR-010**: `seller` MUST limitarse a consulta de catálogo y stock y a ventas permitidas; la web MUST
  omitir costos unitarios, costos totales, valorización, datos de compra, configuración, administración
  de miembros y acciones de gestión de inventario. (HU-002, AS3)
- **FR-011**: Ocultar navegación o acciones en la web MUST ser únicamente una medida de experiencia y
  privacidad defensiva; toda solicitud protegida MUST continuar sujeta a autorización del backend por
  tenant, pertenencia y permisos. (HU-002, AS5)
- **FR-012**: Cada superficie que consulte datos MUST tener estados mutuamente distinguibles de carga,
  contenido, vacío y error. (HU-003, AS1-AS3)
- **FR-013**: Los estados vacíos MUST identificar la colección o filtro sin resultados y, cuando el rol
  lo permita, orientar hacia una acción válida; MUST NOT presentarse como fallos. (HU-003, AS2)
- **FR-014**: Los errores MUST usar lenguaje comprensible, identificar la acción afectada, conservar el
  `correlationId` recibido cuando exista y omitir detalles internos o sensibles. (HU-003, AS3)
- **FR-015**: Los formularios MUST conservar entradas seguras ante errores recuperables, impedir doble
  envío mientras una operación está pendiente y distinguir éxito confirmado de resultado incierto.
  (HU-003, AS4)
- **FR-016**: Las etiquetas, títulos, nombres de acciones y mensajes MUST usar terminología consistente
  para el mismo concepto y distinguir claramente stock de producto, stock por lote, costos y
  valorización. (HU-001, AS1; HU-003, AS1-AS3)
- **FR-017**: La navegación MUST mantener destino, selección actual, orden y mecanismo de retorno
  predecibles dentro de cada experiencia por rol. (HU-002, AS1-AS4; HU-004, AS1)
- **FR-018**: Los flujos de inicio de sesión, consulta de stock y venta rápida MUST ser utilizables
  desde 320 píxeles de ancho hasta escritorio sin pérdida de contenido o acciones esenciales.
  (HU-004, AS1-AS2)
- **FR-019**: Las tablas y colecciones MUST adaptar su presentación a pantallas pequeñas sin mezclar
  encabezados y valores ni provocar desplazamiento horizontal de toda la página. (HU-004, AS2)
- **FR-020**: Enlaces, botones, formularios, estados y mensajes MUST admitir navegación por teclado,
  foco visible, nombres accesibles y anuncio perceptible de cambios relevantes. (HU-004, AS3)
- **FR-021**: Toda lectura web de datos de negocio MUST permanecer limitada al tenant activo; ante un
  identificador, filtro o resultado de otro tenant, el backend MUST responder de forma segura y la web
  MUST no revelar ni conservar ese contenido. (HU-001, AS1; HU-002, AS5; Edge Cases)
- **FR-022**: Las pruebas automatizadas MUST verificar consistencia de stock entre superficies antes y
  después de una venta, ausencia de datos operativos hardcodeados, navegación por rol, privacidad de
  costos de `seller`, estados de interfaz, actualización y tamaños de pantalla incluidos. (HU-001-HU-004)
- **FR-023**: Las pruebas de autorización MUST demostrar que ocultar una opción no permite omitir la
  denegación autoritativa del backend y que una sesión del Tenant A no obtiene datos del Tenant B.
  (HU-002, AS5; HU-001, AS1)
- **FR-024**: La estabilización MUST consumir las capacidades existentes sin crear tablas, migraciones,
  autenticación real ni nuevas reglas de negocio ajenas al sprint. (HU-001-HU-004)

### Non-Functional Requirements

- **NFR-001 — Rendimiento percibido**: En condiciones locales normales, el 95 % de las consultas y
  actualizaciones de las superficies incluidas MUST presentar contenido, vacío o error visible en menos
  de 2 segundos; toda espera superior MUST mantener un indicador de carga perceptible.
- **NFR-002 — Accesibilidad**: Los flujos principales MUST cumplir navegación completa por teclado,
  foco visible, estructura semántica, nombres accesibles y contraste legible equivalente al nivel AA.
- **NFR-003 — Responsive**: La experiencia MUST conservar funcionalidad entre 320 y 1440 píxeles de
  ancho, sin desplazamiento horizontal de página ni acciones críticas fuera del área alcanzable.
- **NFR-004 — Privacidad**: En el 100 % de las vistas y estados de `seller`, incluidos carga, vacío y
  error, no MUST aparecer costos, valorización, datos de compra ni valores derivados de ellos.
- **NFR-005 — Confiabilidad**: Una operación confirmada MUST mostrarse una sola vez y no MUST repetirse
  automáticamente como mecanismo de recuperación de una lectura posterior fallida.
- **NFR-006 — Mantenibilidad funcional**: Cada concepto operativo MUST tener una única definición de
  presentación y procedencia, evitando que una superficie conectada dependa de fixtures o snapshots.

### Key Entities

- **Contexto de sesión web**: Identidad, tenant activo, pertenencia, roles y permisos efectivos que
  determinan navegación, visibilidad y solicitudes permitidas; no introduce autenticación nueva.
- **Producto operativo**: Producto del tenant activo presentado con su estado y stock disponible
  vigente; los costos solo son visibles para roles autorizados.
- **Saldo de inventario**: Cantidad autoritativa disponible por producto y lote dentro de un tenant,
  utilizada coherentemente por todas las superficies operativas.
- **Operación confirmada**: Venta o movimiento ya aceptado por el backend cuyo resultado obliga a
  actualizar las lecturas relacionadas sin repetir la mutación.
- **Estado de superficie**: Estado visible de carga, contenido, vacío, error o desactualización parcial
  para una región de la interfaz.
- **Elemento de navegación**: Destino visible y accionable condicionado por permisos efectivos, no un
  sustituto de autorización.

### Constitutional Requirements *(mandatory)*

- **Tenant Isolation**: Toda lectura conserva el tenant activo y la pertenencia válida; cambiar de
  bodega limpia el estado anterior. Un intento cross-tenant se rechaza sin enumeración y nunca se
  renderiza ni conserva en la web.
- **Roles and Authorization**: Los roles provienen de la pertenencia activa y aplican mínimo privilegio.
  La adaptación visual no reemplaza controles del backend; `seller` nunca recibe ni visualiza costos o
  valorización.
- **Transactions and Concurrency**: El sprint no redefine transacciones. La web trata una venta
  confirmada como definitiva, vuelve a leer el saldo autoritativo ante concurrencia y no repite una
  mutación por el fallo de una actualización posterior.
- **Audit and Historical Record**: No se alteran auditoría ni conservación histórica. Ventas y
  movimientos existentes continúan siendo la evidencia autoritativa y la web no simula ni reemplaza
  registros históricos.
- **Security and Privacy**: No se introducen datos personales. Entradas se validan para usabilidad sin
  debilitar validaciones del servidor; errores son seguros y costos/datos de compra permanecen ocultos
  a `seller` en todas las variantes de interfaz.
- **Lot and FEFO Rules**: El sprint solo presenta resultados de las reglas existentes; no cambia FEFO,
  vencimientos, selección de lotes ni excepciones autorizadas.
- **Human Confirmation**: OCR no interviene en esta funcionalidad y no se capturan fechas mediante
  cámara.
- **Environment Boundaries**: Desarrollo y pruebas se realizan exclusivamente en local con PostgreSQL
  16 en `127.0.0.1:5432` y datos sintéticos. No se usa ni modifica Supabase, Render, Vercel, secretos o
  configuraciones productivas; no se despliega ni se ejecutan comandos contra servicios remotos.
- **Out of Scope**: Nuevas tablas o migraciones, cambios de backend no indispensables para consumir sus
  capacidades existentes, autenticación real, aplicación móvil, OCR, IA, DataMart de Ventas, clientes,
  despliegues y cambios funcionales no relacionados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de los escenarios automatizados, un producto visible en dos o más superficies
  operativas muestra exactamente el mismo stock para la misma bodega y momento de lectura.
- **SC-002**: En el 100 % de las ventas exitosas de prueba, todas las superficies afectadas muestran el
  nuevo saldo en menos de 2 segundos, sin recarga manual completa ni duplicación de la venta.
- **SC-003**: Ninguna superficie operativa conectada renderiza snapshots, mocks o constantes del cliente
  como datos reales en las pruebas de regresión.
- **SC-004**: El 100 % de los escenarios por rol muestra únicamente navegación y acciones permitidas por
  la matriz vigente, y el 100 % de intentos directos no autorizados sigue siendo rechazado por el
  backend.
- **SC-005**: En el 100 % de las vistas de `seller`, incluidos errores y estados vacíos, no aparecen
  costos, valorización, datos de compra ni módulos administrativos.
- **SC-006**: Todas las superficies de datos incluidas superan casos automatizados de carga, vacío,
  error seguro y recuperación, sin presentar estados ambiguos.
- **SC-007**: Los tres flujos principales —inicio de sesión, consulta de stock y venta rápida— se
  completan en anchos de 320, 768 y 1440 píxeles sin pérdida de acciones, superposición ni
  desplazamiento horizontal de página.
- **SC-008**: El 100 % de los controles interactivos de los flujos principales puede alcanzarse y
  activarse por teclado con foco visible y mensajes de estado perceptibles.

## Risks

- Los endpoints existentes pueden devolver modelos con formas distintas para el mismo concepto de
  stock; debe conservarse una definición funcional común sin rediseñar el backend completo.
- La eliminación de snapshots operativos puede revelar estados vacíos o errores que antes quedaban
  ocultos por datos demo, por lo que la recuperación debe formar parte del mismo alcance.
- Una recarga global después de cada operación puede degradar la experiencia o perder datos de
  formularios; la especificación exige coherencia, pero la estrategia se decidirá en planificación.
- Ocultar módulos por rol sin pruebas negativas podría dar una falsa sensación de seguridad; los
  controles y pruebas del backend siguen siendo obligatorios.
- Cambios responsive pueden afectar selectores o recorridos automatizados existentes y requerir su
  actualización sin reducir la cobertura funcional.

## Assumptions

- Los endpoints locales existentes proporcionan los datos necesarios para productos, stock, lotes,
  movimientos, alertas, ventas e indicadores incluidos; cualquier brecha se documentará antes de
  ampliar el alcance del backend.
- La matriz funcional vigente se hereda de las specs 001 y 002: `owner_admin` tiene alcance completo,
  `inventory_manager` opera inventario y `seller` consulta catálogo/stock y vende sin costos.
- La autorización y sesión demo existentes se reutilizan; este sprint no define autenticación real.
- La fuente autoritativa de stock sigue siendo el saldo operativo mantenido por el backend dentro del
  tenant, coherente con lotes y movimientos; la web no redefine su cálculo de negocio.
- Los datos estáticos pueden conservarse únicamente en pruebas, fixtures o demostraciones claramente
  aisladas y nunca representarse como información operativa conectada.
- Las pruebas que necesiten persistencia usarán exclusivamente PostgreSQL local y datos sintéticos
  controlados, sin contactar servicios remotos.

## Exclusions

- Creación o modificación de tablas, relaciones, migraciones o seeds de negocio.
- Uso o modificación de Supabase, Render o Vercel; despliegues y cambios de secretos o producción.
- Autenticación real, recuperación de cuenta o cambios del modelo de identidad.
- Aplicación móvil, OCR, IA, DataMart de Ventas, clientes y módulos comerciales futuros.
- Rediseño completo del backend o incorporación de reglas de negocio ajenas a la estabilización web.
- Cambios funcionales de FEFO, transacciones de venta, auditoría o inventario que ya sean correctos.
