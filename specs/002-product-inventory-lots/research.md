# Research: Productos, inventario, lotes y vencimientos

## R-001 — Propiedad tenant y restricciones compuestas

**Decision**: Product, ProductCategory, UnitOfMeasure configurable, Lot, InventoryMovement,
InventoryBalance, AlertRule, InventoryAlert e IdempotencyRecord de inventario llevarán una
asociación explícita al tenant. Las relaciones hacia producto/lote usarán el tenant como parte de
la referencia lógica y los repositorios exigirán `TenantContext`.

**Rationale**: Un identificador global por sí solo permite errores de consulta o escritura cruzada.
La defensa debe existir en guard, servicio, repositorio, relaciones, restricciones y pruebas A/B.

**Alternatives considered**: Confiar solo en un filtro de aplicación o en RLS; ambos se rechazan como
única barrera. RLS podrá estudiarse en un incremento posterior, pero no sustituirá la autorización
de la API ni las restricciones compuestas.

Las unidades de medida son siempre tenant-scoped, con unicidad por tenant y rechazo anti-enumeración
de referencias provenientes de otra bodega.

## R-002 — Identidad de producto dentro de una bodega

**Decision**: SKU y código de barras serán opcionales individualmente y únicos por tenant cuando
estén presentes. El nombre será buscable pero no una clave única. La activación/desactivación será
un estado lógico que conserva la historia.

**Rationale**: Dos bodegas pueden usar el mismo SKU interno o código sin compartir datos; una
unicidad global produciría acoplamiento y filtración innecesaria.

**Alternatives considered**: Unicidad global, rechazada por multi-tenancy; exigir ambos identificadores,
rechazado porque una bodega familiar puede iniciar solo con nombre y unidad.

## R-003 — Precisión de cantidades y costos

**Decision**: Las cantidades se representan con precisión decimal definida por la unidad de medida
del tenant/producto; los costos usan precisión monetaria fija de la moneda configurada por tenant.
La validación rechaza NaN, infinitos, signos no permitidos y valores fuera de rango.

**Rationale**: Evita errores de redondeo y mantiene consistencia para productos por unidad, peso o
volumen sin implementar todavía balanzas ni conversiones complejas.

**Alternatives considered**: `float` binario, rechazado por errores acumulativos; enteros universales,
rechazados porque no cubren cantidades fraccionarias futuras.

## R-004 — Kardex append-only y saldo derivado

**Decision**: InventoryMovement es el registro histórico append-only. InventoryBalance es una
proyección consistente para lectura rápida y debe coincidir con los movimientos confirmados. Cada
mutación actualiza movimiento, saldo y AuditEvent dentro de una única transacción.

**Rationale**: El kardex explica cada variación y la proyección permite consultas operativas sin
recalcular todo el historial.

**Alternatives considered**: Guardar únicamente un contador mutable, rechazado por pérdida de
trazabilidad; recalcular siempre desde el kardex, insuficiente para listados frecuentes y alertas.

## R-005 — Concurrencia e idempotencia de movimientos

**Decision**: Las mutaciones de stock usarán una condición de versión o bloqueo de fila dentro de una
transacción PostgreSQL, junto con `Idempotency-Key` tenant-scoped. Un retry con la misma clave y
payload devuelve el resultado equivalente; una clave reutilizada con payload diferente devuelve
conflicto seguro.

**Rationale**: Dos responsables pueden registrar movimientos simultáneos y redes móviles pueden
repetir solicitudes. No se permite saldo negativo ni duplicación silenciosa.

**Alternatives considered**: Última escritura gana, rechazada; idempotencia solo en cliente,
rechazada porque no protege reintentos después de una respuesta perdida.

## R-006 — FEFO y lotes vencidos

**Decision**: La sugerencia FEFO ordena saldo disponible por `expiresAt`, luego `receivedAt` y un
identificador estable. Los lotes vencidos quedan excluidos del flujo normal. Un consumo vencido solo
es posible por ajuste manual autorizado, con motivo, reautenticación si la política lo exige y
auditoría.

**Rationale**: Mantiene la regla constitucional de vencimientos por lote y prepara la integración
con ventas futuras sin implementar ventas.

**Alternatives considered**: Ordenar por fecha de ingreso (FIFO), incorrecto para productos con
fechas diferentes; permitir vencidos automáticamente, riesgoso y no auditable.

## R-007 — Alertas operativas

**Decision**: Las alertas se generan con reglas por producto/tenant: stock disponible menor al mínimo,
vencimiento dentro de `expiryAlertDays` y lote vencido. Se conserva estado activo/resuelto e historial
mínimo, y el cálculo puede ejecutarse sin depender de un dashboard BI.

**Rationale**: La bodega necesita señal operativa inmediata; la lógica es determinista y tenant-scoped.

**Alternatives considered**: Alertas globales o configuradas como constantes, rechazadas por
multi-tenancy; pipeline BI, fuera del alcance del MVP.

## R-008 — Visibilidad de costos por rol

**Decision**: `owner_admin` e `inventory_manager` pueden ver costos de compra dentro del tenant;
`seller` solo recibe producto y stock disponible. Los serializers de respuesta se construyen por
permisos y las pruebas negativas buscan costos en listados, detalle, errores, auditoría y E2E.

**Rationale**: El costo es información operativa sensible y no es necesario para vender o consultar
existencias.

**Alternatives considered**: Ocultar costos solo en la interfaz, rechazado porque la API seguiría
filtrando datos sensibles; permiso global de costo, rechazado por roles por pertenencia.

## R-009 — Contrato REST y clientes

**Decision**: La API REST versionada documentará recursos de categorías, unidades, productos, lotes
por producto, listado tenant-wide de lotes, saldos, movimientos, FEFO y alertas en OpenAPI. Web y
móvil consumirán únicamente esos contratos; las respuestas de lotes y saldos usarán proyecciones
operativas o administrativas según el rol, sin exponer costos a `seller`; no se expondrán tablas,
Prisma ni PostgreSQL a clientes.

**Rationale**: Mantiene el límite arquitectónico del módulo 001 y permite evolucionar ventas y OCR
sin duplicar reglas en clientes.

**Alternatives considered**: Acceso directo a Supabase desde web/móvil, prohibido por constitución;
GraphQL nuevo, innecesario para el alcance actual.

Las operaciones de categorías, unidades, lotes tenant-wide y resolución de alertas mantienen el mismo
`TenantContext`, permisos por pertenencia y errores anti-enumeración que el resto del contrato.

## R-010 — Auditoría y fallos transaccionales

**Decision**: Cambios de producto, categoría, unidad, lote, stock, FEFO excepcional, reglas y alertas sensibles insertan
AuditEvent sanitizado en la misma transacción. Si la auditoría no puede persistirse, la mutación falla
y revierte el estado operativo.

**Rationale**: Conserva trazabilidad completa y evita inventario cambiado sin evidencia.

**Alternatives considered**: Auditoría asíncrona best-effort, rechazada; log de aplicación como única
fuente, rechazado por falta de inmutabilidad y alcance tenant.

## R-011 — OCR y escáner como extensiones diferidas

**Decision**: El MVP acepta fechas digitadas o confirmadas por el usuario y deja interfaces de
extensión para escáner/OCR. No se instala ni ejecuta OCR, y ninguna fecha no confirmada se persiste.

**Rationale**: Cumple la Constitución sobre confirmación humana y evita incorporar una dependencia no
aprobada.

**Alternatives considered**: Persistir automáticamente la fecha detectada, rechazado; integrar OCR
ahora, fuera de alcance explícito.

## R-012 — Estrategia de pruebas y ambientes

**Decision**: Vitest cubrirá unidades y contratos; integración/persistencia usará PostgreSQL real de
pruebas con Prisma; seguridad ejecutará una matriz A/B y privacidad de costos; Playwright y Maestro
cubrirán las superficies cuando existan; k6 medirá consultas y movimientos en un ambiente controlado;
SC-008 usará un protocolo controlado con cuatro participantes sintéticos, códigos anónimos, métricas
por tarea y evidencia separada, sin inventar resultados.

**Rationale**: Mocks no prueban constraints, transacciones, aislamiento ni concurrencia. La regresión
del módulo 001 debe seguir pasando en CI.

**Alternatives considered**: SQLite o base en memoria para persistencia, rechazados; datos reales,
prohibidos por separación de ambientes.

## R-013 — Migración versionada y reversión

**Decision**: La implementación futura añadirá una migración Prisma posterior a `0001_identity_access_mvp`,
con nombre propuesto `0002_product_inventory_lots`, revisión SQL, seed sintético y plan de rollback.
Este documento no crea ni aplica la migración.

**Rationale**: Respeta la Constitución y evita modificar la base durante la fase de especificación.

**Alternatives considered**: Cambios manuales en PostgreSQL, rechazados; reutilizar tablas de acceso,
rechazado porque mezcla bounded contexts.
