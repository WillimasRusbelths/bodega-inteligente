# Regresión local de autorización e aislamiento tenant — T066

Fecha de ejecución: 2026-09-04  
Ambiente: API y PostgreSQL `bodegia_test` exclusivamente locales en `127.0.0.1`.

## Alcance

- Invocación administrativa directa de `seller`, sin depender de ocultamiento de UI.
- Lectura de productos del Tenant A con datos sintéticos privados en Tenant B.
- Intento de venta desde Tenant A con un producto perteneciente al Tenant B.
- Confirmación de que el rechazo no enumera identificadores ni nombres privados.
- Confirmación de que el intento rechazado no persiste ventas en ninguno de los tenants.

## Ejecución observada

Comando local:

```text
corepack pnpm exec vitest run apps/api/test/security/web-stabilization-authorization.spec.ts --pool=threads --maxWorkers=1
```

Resultado: **2/2 pruebas verdes**.

- Administración directa seller: HTTP 403, `INSUFFICIENT_PERMISSION`, bodega sin modificación.
- Venta cross-tenant: HTTP 404, `RESOURCE_NOT_FOUND`, sin revelar producto privado y con cero ventas añadidas en Tenant A o Tenant B.

No se cambió autorización, esquema, migraciones, reglas de negocio ni Prisma. La evidencia corresponde a datos sintéticos creados y limpiados por la prueba sobre PostgreSQL local.
