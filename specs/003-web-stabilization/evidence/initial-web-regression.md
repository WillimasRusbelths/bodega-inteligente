# Regresión web inicial local

**Fecha de ejecución**: 2026-08-20 12:17:23 -05:00 (`America/Lima`)

**Rama**: `003-web-stabilization`

**Alcance**: T007 únicamente. Se ejecutó la regresión web existente antes de cambios funcionales de
las fases posteriores.

## Scripts verificados

- `apps/web/package.json` define `test` como `vitest run apps/web/test --pool=threads --maxWorkers=1`.
- `apps/web/package.json` define `typecheck` como `tsc --noEmit`.
- El repositorio también define `build:web`, pero T007 y el plan no lo exigen como parte de esta
  regresión inicial; no se ejecutó.

## Entorno local

- Node.js `v22.23.1`
- pnpm `10.20.0`
- No se requirió `DATABASE_URL`, PostgreSQL, Docker ni ningún servicio remoto.

## Comandos y resultados

```powershell
corepack pnpm --dir apps/web test
```

- Resultado: exit code 0.
- Archivos de prueba: 4 pasados de 4.
- Pruebas: 21 pasadas, 0 falladas, 0 omitidas.
- Suites ejecutadas:
  - `apps/web/test/product-inventory.spec.tsx`: 6 pruebas.
  - `apps/web/test/bi-dashboard.spec.ts`: 3 pruebas.
  - `apps/web/test/mvp-web.spec.ts`: 7 pruebas.
  - `apps/web/test/demo.spec.ts`: 5 pruebas.

```powershell
corepack pnpm --dir apps/web typecheck
```

- Resultado: exit code 0 (`tsc --noEmit`).

## Baseline observado

No se observaron fallos preexistentes ni pruebas omitidas en la regresión web actual. No se modificó
código productivo, expectativas de prueba, secretos ni configuración de entorno. T008 y las tareas
posteriores no se ejecutaron.
