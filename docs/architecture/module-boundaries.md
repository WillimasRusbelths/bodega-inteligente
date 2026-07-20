# Límites arquitectónicos del monorepo

## Dependencias permitidas

- `apps/api` puede depender de paquetes compartidos y, en fases posteriores, de Prisma/PostgreSQL.
- `apps/mobile` y `apps/web` pueden depender de `packages/api-contract`, `packages/config` y de
  identificadores presentacionales de `packages/authz-catalog`.
- Los paquetes compartidos no pueden importar aplicaciones.

## Dependencias prohibidas

- Móvil y web no importan `apps/api`, Prisma, drivers PostgreSQL, clientes Supabase de datos ni
  módulos bajo `apps/api/src/infrastructure`.
- Los clientes no duplican autorización, aislamiento por tenant ni reglas autoritativas.
- Ninguna superficie cliente abre conexiones directas a PostgreSQL.

La API REST es la frontera obligatoria. Las validaciones cliente mejoran la experiencia, pero el
backend vuelve a validar toda entrada y conserva la autoridad final.

## Módulo 002: productos e inventario

El módulo `002-product-inventory-lots` contiene únicamente el catálogo tenant-scoped de productos,
categorías y unidades; lotes, vencimientos, movimientos, saldos, kardex, FEFO y alertas operativas.
Reutiliza la identidad, `TenantContext`, membresías, RBAC, sesiones y `AuditEvent` del módulo 001.

Las entidades operativas llevan `tenantId` y sus consultas pasan por repositorios tenant-aware. Los
clientes web y móvil solo consumen REST/OpenAPI; nunca reciben acceso a Prisma o PostgreSQL ni
seleccionan un tenant enviando `tenantId` en el cuerpo.

Quedan explícitamente fuera de este módulo: ventas, clientes, OCR, BI/Data Warehouse, ETL,
Power BI, promociones, recomendaciones de IA, reposición inteligente, aplicación de consumidores,
modo offline, SMS, correo, pairing web, biometría y dispositivos compartidos.
