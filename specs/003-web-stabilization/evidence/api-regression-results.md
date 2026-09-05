# Regresión API local final

**Fecha**: 2026-09-04 (`America/Lima`)  
**Base**: PostgreSQL local `bodegia_test` en `127.0.0.1:5432`  
**Variables**: `NODE_ENV=development`, `DEMO_AUTH_ENABLED=true`,
`CORS_ORIGIN=http://localhost:5173`

## Resultados T068

| Suite | Comando | Resultado final |
|---|---|---|
| Unit | `corepack pnpm test:unit` | `9/9` archivos, `36/36` pruebas, `13.70 s` |
| Contract | `corepack pnpm test:contract` | `14/14` archivos, `122/122` pruebas, `28.44 s` |
| Integration | `corepack pnpm test:integration` | `19/19` archivos, `143/143` pruebas, `60.54 s` |
| Security | `corepack pnpm test:security` | `17/17` archivos, `102/102` pruebas, `33.91 s` |

La primera invocación unit falló antes de recolectar pruebas por nueve `spawn EPERM` de Windows en
el sandbox. La misma suite fuera de esa restricción ejecutó y pasó; no fue un fallo de producto.

La primera integración ejecutó `142/143`: `fefo.spec.ts` trataba como vigentes fechas fijas de
julio/agosto de 2026, ya vencidas el día de ejecución. Se cambió únicamente el setup del test a
fechas relativas futuras. El caso aislado pasó `1/1` y la suite completa pasó `143/143`. No se
modificó el servicio FEFO ni ninguna regla backend.

Cobertura observada: acceso, aislamiento tenant, productos, lotes, inventario, FEFO, alertas, BI,
ventas, idempotencia, transacciones y privacidad de costos. No quedan regresiones API conocidas.

En el gate final se repitió la suite contract tras su formateo: `14/14` archivos, `122/122` pruebas
en `26.74 s`. También se ejecutó `test:config`: `2/2` archivos y `14/14` pruebas en `3.56 s`.
