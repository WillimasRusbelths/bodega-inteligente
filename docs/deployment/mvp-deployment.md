# Despliegue MVP de BodegIA

Esta guia prepara el MVP demostrable para una arquitectura simple:

- PostgreSQL administrado en Supabase.
- API Node.js/TypeScript en Render o Railway.
- Web estatica en Vercel.

No incluye app movil, APK, OCR, IA, offline ni DataMarts adicionales. El unico
DataMart implementado sigue siendo Inventario en el schema `dw`.

## Arquitectura de despliegue

```text
Vercel Web
  VITE_API_BASE_URL
      |
      v
Render/Railway API Node.js
  DATABASE_URL, PORT, CORS_ORIGIN
      |
      v
Supabase PostgreSQL
  schemas public y dw
```

La web no accede a PostgreSQL. Consume la API con el tenant activo y la sesion
demo MVP. La API es el unico proceso que usa Prisma.

## Variables de entorno

### Backend API

| Variable          | Requerida        | Descripcion                                                          |
| ----------------- | ---------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`    | Si               | URL PostgreSQL de Supabase o del entorno de pruebas.                 |
| `NODE_ENV`        | Si               | Usar `production` en Render/Railway.                                 |
| `PORT`            | Si               | Puerto asignado por Render/Railway. La API lo respeta.               |
| `CORS_ORIGIN`     | Si en produccion | Origen web permitido, por ejemplo `https://bodegia-demo.vercel.app`. |
| `ALLOW_DEMO_SEED` | Solo seed demo   | Usar `true` unicamente para cargar datos en una base demo aprobada.  |

### Web

| Variable            | Requerida | Descripcion                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Si        | URL publica de la API, por ejemplo `https://bodegia-api.onrender.com`. |

### Mobile futuro

| Variable                   | Requerida | Descripcion                                                |
| -------------------------- | --------- | ---------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL` | Futuro    | URL publica de la API para la app movil cuando exista APK. |

## Scripts de produccion

### API

Build:

```powershell
corepack pnpm --filter @bodegia/api build
```

Start productivo:

```powershell
corepack pnpm --filter @bodegia/api start:prod
```

Equivalente directo desde `apps/api` despues del build:

```powershell
node dist/src/http/main.js
```

La API escucha en `0.0.0.0` y usa `process.env.PORT`.

### Web

Desarrollo local:

```powershell
corepack pnpm --dir apps/web dev
```

Build estatico:

```powershell
corepack pnpm --dir apps/web build
```

Preview local:

```powershell
corepack pnpm --dir apps/web preview
```

En Vercel, la opcion recomendada para este monorepo es usar la raiz del
repositorio como root directory. El archivo `vercel.json` raiz usa:

- Build command: `corepack pnpm --dir apps/web build`
- Output directory: `apps/web/dist`

Si se configura `apps/web` como root directory, el archivo
`apps/web/vercel.json` usa:

- Build command: `corepack pnpm build`
- Output directory: `dist`

## Supabase PostgreSQL

1. Crear un proyecto Supabase.
2. Copiar la URL de conexion PostgreSQL para Prisma en `DATABASE_URL`.
3. No guardar credenciales reales en el repositorio.
4. Ejecutar migraciones contra la base destino:

```powershell
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

5. Verificar que existan los schemas:

```sql
select schema_name
from information_schema.schemata
where schema_name in ('public', 'dw');
```

6. Verificar dimensiones y hechos del DataMart:

```sql
select table_schema, table_name
from information_schema.views
where table_schema = 'dw'
order by table_name;
```

7. Para una base demo aprobada, cargar datos sinteticos:

```powershell
$env:ALLOW_DEMO_SEED = "true"
corepack pnpm seed:demo
```

El seed usa `DATABASE_URL`; no depende de `localhost`. Con `NODE_ENV=production`
se niega a correr si `ALLOW_DEMO_SEED` no esta definido como `true`.

## Render o Railway

Configurar el servicio API con:

- Runtime: Node.js 22.
- Install command: `corepack pnpm install --frozen-lockfile`.
- Build command:

```powershell
corepack pnpm exec prisma generate --schema prisma/schema.prisma
corepack pnpm --filter @bodegia/api build
```

- Start command:

```powershell
corepack pnpm --filter @bodegia/api start:prod
```

Antes de iniciar una version nueva, ejecutar:

```powershell
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

## Vercel

Configurar opcion recomendada:

- Root directory: raiz del repositorio.
- Build command: `corepack pnpm --dir apps/web build`.
- Output directory: `apps/web/dist`.
- Environment variable: `VITE_API_BASE_URL=https://URL_PUBLICA_DE_LA_API`.

El build genera `apps/web/dist/index.html` y los assets compilados de la demo
web cuando se ejecuta desde la raiz del monorepo.

## CORS

En desarrollo, la API permite `http://localhost:5173` y
`http://127.0.0.1:5173`.

En produccion, definir `CORS_ORIGIN` con la URL de Vercel. Si `NODE_ENV` es
`production` y `CORS_ORIGIN` no esta definido, la API no publica un origen
abierto con `*`.

La API responde `OPTIONS` para preflight y permite los headers:

- `Content-Type`
- `X-Demo-Session`
- `X-Correlation-Id`

## Healthcheck

Render/Railway pueden verificar:

```text
GET /health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "api",
  "correlationId": "..."
}
```

## Endpoints para probar

```text
GET  /health
POST /demo/auth/login
GET  /tenants/current/bi/inventory-summary
GET  /tenants/current/sales
POST /tenants/current/sales
```

Ejemplo login demo:

```powershell
curl -Method POST https://URL_API/demo/auth/login `
  -ContentType "application/json" `
  -Body '{"username":"vendedor","pin":"100003"}'
```

## Checklist final

- [ ] `DATABASE_URL` configurada en API.
- [ ] `NODE_ENV=production` configurado en API.
- [ ] `PORT` provisto por Render/Railway.
- [ ] `CORS_ORIGIN` apunta a la URL de Vercel.
- [ ] `VITE_API_BASE_URL` apunta a la URL publica de la API.
- [ ] `prisma migrate deploy` ejecutado correctamente.
- [ ] `prisma generate` ejecutado antes de build/lint/tests en CI.
- [ ] `GET /health` responde en la API publicada.
- [ ] Seed demo ejecutado solo en base demo aprobada.
- [ ] Schemas `public` y `dw` verificados.
- [ ] Login demo, BI y venta rapida probados desde la web publicada.
