# BodegIA

Monorepo TypeScript para la API REST, la aplicación móvil y la plataforma web de BodegIA.

## Requisitos

- Node.js 22 LTS
- pnpm 10.20.0 mediante Corepack

## Límites

`apps/api` es la única superficie autorizada para persistencia y reglas de negocio. `apps/mobile` y
`apps/web` consumen exclusivamente la API REST documentada mediante OpenAPI. Ningún cliente importa
Prisma, drivers PostgreSQL, Supabase Data API ni infraestructura interna del backend.

Consulta [los límites de módulos](docs/architecture/module-boundaries.md) antes de añadir paquetes.
