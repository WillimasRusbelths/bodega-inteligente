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
