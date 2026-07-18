# Auditoría de alcance del gate MVP

Fecha de revisión: 2026-07-17 (America/Lima).

## Evidencia inspeccionada

Los módulos actuales de `apps/api/src/modules` son únicamente:
`access`, `activation`, `audit`, `auth`, `devices`, `identity`, `memberships`
y `tenants`. No existen rutas de implementación para ventas, inventario
operativo, productos, OCR, BI, soporte, pairing web o biometría.

Las comprobaciones de rutas devolvieron `False` para:

```text
apps/api/src/modules/sales
apps/api/src/modules/inventory
apps/api/src/modules/products
apps/api/src/modules/ocr
apps/api/src/modules/bi
apps/api/src/modules/support
apps/api/src/modules/web-pairing
apps/api/src/modules/biometric
apps/api/test/performance/access.js
apps/mobile/e2e
apps/web/e2e
```

No hay dependencias de proveedores SMS/correo, BI, Playwright, Maestro o k6 en
los manifiestos de paquetes. Los scripts de E2E/performance existentes son
solo convenciones futuras y no se ejecutaron.

## Hallazgos que no constituyen funcionalidad fuera de alcance

- `packages/authz-catalog` conserva identificadores reservados de vendedor y
  responsable de inventario porque FR-013/FR-032 exige la matriz de roles. No
  existen servicios ni endpoints de ventas, productos, lotes o stock.
- El servicio de auditoría contiene reglas de sanitización para términos
  comerciales y datos biométricos; son controles de privacidad, no módulos
  funcionales.
- El contrato fuente contiene operaciones diferidas, pero el snapshot generado
  y la conformance MVP las excluyen explícitamente. No se ejecutaron ni se
  marcaron tareas de esos incrementos.
- No se añadió modo offline, sincronización, OCR, ETL, Power BI, SMS, correo,
  soporte, pairing web ni dispositivo compartido.

## Constitution Check

- PASS: móvil y web solo consumen el cliente REST/OpenAPI; no hay acceso directo
  a PostgreSQL.
- PASS: Prisma y PostgreSQL son la vía de persistencia del API; no se generó ni
  aplicó una migración en esta auditoría.
- PASS: el gate mantiene aislamiento por tenant, auditoría append-only,
  secretos fuera de logs/respuestas posteriores y datos sintéticos.
- PASS: las capacidades comerciales y los incrementos posteriores permanecen
  fuera de la implementación MVP.
