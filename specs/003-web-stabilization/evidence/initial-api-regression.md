# Regresión API inicial local

**Fecha de ejecución**: 2026-08-20 (`America/Lima`)

**Rama**: `003-web-stabilization`

**Alcance**: T008 únicamente. Se caracterizó la regresión API existente de productos, inventario,
lotes, FEFO, alertas, BI/DataMart y ventas rápidas, sin modificar reglas de negocio.

## Entorno local

- Node.js `v22.23.1`; pnpm `10.20.0`.
- `DATABASE_URL` apuntó exclusivamente a la base local `bodegia_test` en `127.0.0.1:5432`; la
  credencial no se registra en este documento.
- `NODE_ENV=development`, `DEMO_AUTH_ENABLED=true` y `CORS_ORIGIN=http://localhost:5173` se
  definieron solo en las sesiones PowerShell de las suites con persistencia.
- No se ejecutaron migraciones ni seeds. Las integraciones usaron sus fixtures y limpieza existentes
  sobre la base de prueba local. No se usaron Docker ni servicios remotos.

## Scripts seleccionados

El script raíz `test` no es una regresión API completa: solo encadena `test:config` y `test:security`.
Se ejecutaron los scripts existentes que cubren los dominios de T008, sin añadir flags manuales:

```powershell
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm --filter @bodegia/api typecheck
```

## Resultados de suites

| Suite | Resultado | Archivos | Pruebas pasadas | Falladas | Omitidas |
|---|---:|---:|---:|---:|---:|
| `test:unit` | verde | 9 | 36 | 0 | 0 |
| `test:integration` | rojo de baseline | 19 | 142 | 1 | 0 |
| `test:contract` | verde | 14 | 122 | 0 | 0 |

La primera tentativa de `test:unit` dentro del sandbox no llegó a ejecutar pruebas: Vitest reportó
`spawn EPERM` durante resolución de archivos. La misma orden, sin cambios de código, se reejecutó con
permisos para procesos locales y produjo el resultado verde registrado en la tabla.

## Resultado por dominio

| Dominio | Cobertura observada | Resultado |
|---|---|---|
| Productos | `unit/catalog/product.service` (3), `integration/product-catalog` (5), `contract/product-inventory` (4) y wiring de productos | Verde |
| Lotes | `unit/lots/lot.service` (2), `integration/lot-receipt` (4), `contract/lots` (3) | Verde |
| Inventario | unidades de movimientos/error, integración de recibo y movimientos, contratos de inventario y wiring de balances/movimientos | Verde |
| FEFO | `unit/inventory/fefo.service` (2) y `contract/fefo-alerts` (2) verdes; `integration/fefo` (1) rojo | Baseline rojo documentado |
| Alertas | `unit/alerts/alert.service` (2), `integration/inventory-alerts` (1), contratos FEFO/alertas | Verde |
| BI/DataMart | `unit/bi/inventory-bi.service` (3), `contract/datamart-sql` (2) y seis comprobaciones BI del wiring HTTP | Verde |
| Ventas rápidas | `integration/quick-sales` (4) y cinco comprobaciones de ventas del wiring HTTP | Verde |

## Fallo reproducible de baseline

`apps/api/test/integration/fefo.spec.ts` falló en
`orders available lots, allocates partial quantity and isolates tenants`:

- esperado: `canFulfill: true` para `requestedQuantity: 6`;
- observado: `canFulfill: false`;
- causa observable: sus dos lotes disponibles tienen vencimientos fijos `2026-07-25` y `2026-08-01`,
  ambos anteriores a la fecha de ejecución `2026-08-20`.

No se corrigió la prueba ni la lógica FEFO: este fallo queda registrado como baseline previo a las
tareas posteriores.

## Typecheck

```powershell
corepack pnpm --filter @bodegia/api typecheck
```

Resultado: exit code 0 (`tsc --noEmit`).

## Alcance confirmado

No se modificó código productivo, expectativas de prueba, secretos, esquema ni migraciones. T009 y
las tareas posteriores no se ejecutaron.
