# Calidad final del monorepo

**Fecha**: 2026-09-04 (`America/Lima`)  
**Rama**: `003-web-stabilization`

## TypeScript estricto

`corepack pnpm typecheck`: **PASS**. Pasaron los siete proyectos evaluados: `api-contract`,
`authz-catalog`, `config`, `test-fixtures`, `api`, `mobile` y `web`. En particular, typecheck web y
API quedaron verdes.

## ESLint

La primera ejecución de `corepack pnpm lint` informó 15 errores en archivos web del sprint: una
aserción de tipo innecesaria, callbacks `async` sin `await` y acceso no tipado a un mock. Se corrigió
la tipificación/forma de las promesas sin silenciar reglas ni introducir `any`. Las seis suites
afectadas pasaron `15/15`. La segunda ejecución global de ESLint terminó con código `0` y cero
warnings.

## Prettier

La primera ejecución de `corepack pnpm format:check` señaló nueve archivos. Se formatearon únicamente
ocho archivos del sprint. La segunda ejecución señala solo:

```text
[warn] apps/api/src/http/main.ts
[warn] Code style issues found in the above file.
```

Resultado global: **FAIL (exit 1)** por deuda preexistente. El mismo contenido de `main.ts` en
`f8933ab`, anterior al único cambio CORS posterior, también devuelve exit `1` al pasarlo por Prettier.
`git diff f8933ab c6c95ed -- apps/api/src/http/main.ts` muestra únicamente la adición formateada de
`Idempotency-Key` en la línea 57. El rango problemático observado `883–952` pertenece según
`git blame` a commits de julio/agosto de 2026. No se reformateó esa región ajena para ocultar el
fallo.

Este resultado se conserva como bloqueo verificable para la decisión T074; T070 sí queda ejecutada y
documentada conforme a su definición.

