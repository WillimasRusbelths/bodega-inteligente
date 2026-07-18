# Spike RLS con Prisma, pool PostgreSQL y `SET LOCAL`

Fecha de ejecución: 2026-07-17 (America/Lima).

## Alcance y límites

El spike se ejecutó únicamente contra PostgreSQL local:

- Base: `bodegia_test`.
- Host: `localhost`.
- PostgreSQL: `16.14`.
- Rol: `bodegia_test`.
- Prisma Client: `6.19.0`.
- Pool Prisma del spike: `connection_limit=2`.

No se usó Docker, Supabase remoto ni se modificó una migración. Se creó una
tabla sintética con nombre aleatorio, se habilitó RLS solo para el experimento,
y se eliminó en un bloque `finally`. La migración MVP y las tablas de producto
quedaron intactas.

## Estado real antes y después

La consulta de catálogo sobre las 15 tablas MVP (`User`, `Tenant`,
`Membership`, RBAC, activación, dispositivos, sesiones, refresh, auditoría e
idempotencia) devolvió en todos los casos:

```text
rls_enabled = false
rls_forced  = false
policy_count = 0
```

El rol local resultó `bodegia_test`, no superusuario y sin `rolbypassrls`, pero
es propietario de todas las tablas MVP. El estado final volvió a ser el mismo
después del spike. `corepack pnpm exec prisma migrate status` informó:

```text
1 migration found in prisma/migrations
Database schema is up to date!
```

## Prueba sintética RLS + pool

La tabla sintética efímera usó dos filas (`tenant-a` y `tenant-b`), RLS `ENABLE`,
`FORCE ROW LEVEL SECURITY` y una policy que compara `tenant_id` con:

```sql
current_setting('app.tenant_id', true)
```

Cada operación se ejecutó dentro de `PrismaClient.$transaction` con:

```sql
SET LOCAL app.tenant_id = '<tenant>'
```

Se hicieron dos transacciones concurrentes con `pg_sleep` tipado para mantener
ocupadas ambas conexiones del pool y observar sus `pg_backend_pid`.

Resultado real de la ejecución exitosa:

```json
{
  "database": "bodegia_test",
  "serverVersion": "16.14",
  "role": "bodegia_test",
  "isSuperuser": false,
  "bypassRls": false,
  "connectionLimit": 2,
  "forcedRlsOnSyntheticTable": true,
  "noContextRows": 0,
  "concurrentBackendPidsDistinct": true,
  "tenantAVisibleRows": 1,
  "tenantBVisibleRows": 1,
  "localSettingAfterCommit": "",
  "setLocalResetAfterCommit": true,
  "pooledConnectionNoContextRows": 0
}
```

Interpretación verificable:

1. Tenant A solo vio su fila y Tenant B solo vio su fila.
2. Sin contexto no se vio ninguna fila.
3. Las transacciones concurrentes usaron conexiones distintas.
4. Tras `COMMIT`, `current_setting` no conservó `tenant-a` ni `tenant-b`.
   PostgreSQL dejó el valor vacío de la variable personalizada en esa conexión;
   la policy siguió devolviendo cero filas.
5. La tabla y su policy fueron eliminadas; una consulta posterior no encontró
   tablas `RlsSpike_*` ni policies experimentales.

## Control negativo: `SET` de sesión

En una conexión Prisma con `connection_limit=1` se ejecutó, únicamente para el
control y con `RESET` garantizado en `finally`:

```sql
SET app.tenant_id = 'tenant-a'
```

La consulta posterior sobre la conexión reutilizada observó realmente:

```json
{
  "sessionLevelSetLeakedValue": "tenant-a",
  "resetPerformed": true
}
```

Esto demuestra que una implementación que use `SET` (sin `LOCAL`) puede dejar
un tenant en una conexión del pool. `SET LOCAL` dentro de la transacción es una
condición obligatoria, no una optimización opcional.

## Análisis de seguridad y decisión

El experimento demuestra el comportamiento deseado en una tabla sintética,
pero no demuestra que sea seguro activar RLS en el esquema MVP actual:

- El rol que usa Prisma es propietario de las tablas. Sin `FORCE ROW LEVEL
SECURITY` el propietario puede omitir las policies; activar `FORCE` en todas
  las tablas requeriría una decisión de esquema y una política completa para
  cada operación.
- No existe todavía una policy revisada para cada tabla/relación MVP ni un
  helper único que establezca y valide el contexto antes de cada transacción.
- Los repositorios y guards actuales ya aplican `TenantContext`, filtros
  compuestos y constraints A/B. RLS no puede sustituirlos.
- La prueba no cubre un pooler externo, migración de policies, privilegios de
  roles de producción, `INSERT/UPDATE/DELETE` de todas las tablas ni rollback
  operativo.

**Decisión T151: opción (c), RLS no habilitado por ahora por riesgo y evidencia
insuficiente para el esquema Prisma/pool actual.** Los guards, repositorios
tenant-aware y constraints continúan siendo los controles obligatorios.

RLS queda como hardening recomendado para un incremento posterior, condicionado
a separar el rol propietario del rol de aplicación, definir policies completas,
centralizar `SET LOCAL`, probar todas las mutaciones y repetir la matriz A/B con
pool/pooler reales. No se habilita RLS en `0001_identity_access_mvp`.
