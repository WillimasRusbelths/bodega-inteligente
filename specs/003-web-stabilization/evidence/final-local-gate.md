# Gate final local T074

**Fecha**: 2026-09-04 (`America/Lima`)  
**Rama**: `003-web-stabilization`  
**Decisión**: **BLOCKED**

## Dependencias

T067–T073 están ejecutadas, documentadas y marcadas `[x]`. La matriz T073 contiene `24/24` FR,
`8/8` SC y `9/9` principios constitucionales con evidencia.

## Gate funcional

| Check | Resultado final |
|---|---|
| Web completo | `24/24` archivos, `78/78` pruebas, `38.03 s` |
| T009 no fixtures | `1/1` PASS |
| T010 stock autoritativo | `1/1` PASS |
| T011 navegación | `5/5` PASS |
| T012 privacidad seller | `1/1` PASS |
| T013 estados/recuperación | `10/10` PASS |
| T014 responsive/teclado | `6/6` PASS dentro de T069 |
| API unit | `9/9` archivos, `36/36` pruebas PASS |
| API contract final | `14/14` archivos, `122/122` pruebas PASS |
| API integration | `19/19` archivos, `143/143` pruebas PASS |
| API security | `17/17` archivos, `102/102` pruebas PASS |
| API config | `2/2` archivos, `14/14` pruebas PASS |
| Playwright Sprint 003 | `13/13` PASS en 320/768/1440, un worker |
| Medición E2E | carga `966.7543 ms`; postventa `522.7806 ms` |
| Persistencia | una venta, stock backend 17 |
| Cleanup PostgreSQL | seis conteos operativos sintéticos en cero |

## Gate de calidad

| Check | Resultado final |
|---|---|
| Typecheck monorepo | PASS, siete proyectos |
| Typecheck web | PASS |
| Typecheck API | PASS |
| ESLint global | PASS, exit `0`, cero warnings |
| `git diff --check` | PASS; solo avisos informativos LF→CRLF |
| Servidores locales | detenidos; HTTP `000` en puertos 3000 y 5173 |
| Hooks Spec Kit | `.specify/extensions.yml` no existe; no hay hooks posteriores |
| Prettier global | **FAIL**, exit `1`, solo `apps/api/src/http/main.ts` |

## Bloqueador verificable

El check global requerido no está completamente verde. Prettier señala únicamente
`apps/api/src/http/main.ts`. El rango observado `883–952` proviene según `git blame` de commits de
julio/agosto de 2026. El mismo archivo leído desde `f8933ab`, antes de la adición CORS del cierre
anterior, también falla Prettier. El diff `f8933ab..c6c95ed` contiene solo la línea 57,
`Idempotency-Key`, que ya está formateada.

La restricción prohíbe reformatear una región grande y ajena únicamente para satisfacer el check.
Por ello el fallo no se ocultó ni se cambió la regla. La política solicitada para T074 exige cero
bloqueadores: T074 permanece `[ ]` y el Sprint 003 no recibe aprobación final local en esta ejecución.

No quedan bloqueadores funcionales, de persistencia, seguridad, TypeScript, lint, E2E o cleanup.

---

## Cierre del bloqueo de formato — 2026-09-05

**Decisión actual**: **APPROVED**

Se reprodujo el único bloqueo con el mismo comando global:

- `corepack pnpm format:check`: FAIL, exit `1`, únicamente `apps/api/src/http/main.ts`.

Con autorización expresa se ejecutó Prettier exclusivamente sobre ese archivo. El diff resultante se
limita a convertir en una sola línea la invocación multilínea de
`handleInventoryReadRoute(request, response, inventoryReads, sales)` en la región 887–894: `1` línea
añadida y `6` eliminadas. No cambian identificadores, argumentos, orden, flujo, endpoints,
autorización ni CORS; `Idempotency-Key` permanece en `Access-Control-Allow-Headers`.

### Revalidación posterior

| Check | Resultado observado |
|---|---|
| `corepack pnpm --filter @bodegia/api typecheck` | PASS, exit `0` |
| Contratos inventario + ventas/BI, autorización web y demo auth | `4/4` archivos, `26/26` pruebas PASS |
| ESLint focal de `apps/api/src/http/main.ts` | PASS, exit `0`, cero warnings |
| `corepack pnpm format:check` global | PASS, exit `0`; todos los archivos coinciden con Prettier |
| `git diff --check` | PASS, exit `0`; solo avisos informativos LF→CRLF |

T067–T073 permanecen ejecutadas y marcadas `[x]`; sus resultados históricos no se reescriben ni se
presentan como recién ejecutados. Al desaparecer el único bloqueador verificable, el gate final local
queda aprobado y T074 se marca `[x]`.
