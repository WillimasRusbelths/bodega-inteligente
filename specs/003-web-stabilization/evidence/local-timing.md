# Medición local de sincronización postventa

**Fecha de ejecución**: 2026-09-03 (`America/Lima`)

**Rama**: `003-web-stabilization`

**Alcance**: T037. La medición cubre el ciclo postventa del coordinador web ya implementado, sin
servicios remotos, datos persistidos, snapshots operativos ni aritmética local de stock.

## Método

- El caso exitoso mide con `performance.now()` desde la confirmación solicitada mediante
  `submitSale` hasta que las siete lecturas afectadas (`products`, `lots`, `balances`, `movements`,
  `alerts`, `sales` e `indicators`) vuelven a quedar disponibles. La aceptación exige menos de
  `2.000 ms`.
- El caso de espera lenta usa una latencia controlada de `2.100 ms`. A los `2.001 ms` verifica que la
  venta ya está confirmada y que cada recurso conserva un estado perceptible `stale` con razón
  `POST_SALE_REFRESH_PENDING`. Tras completar la espera, los siete recursos quedan `ready`.
- Ambos casos verifican que la función que representa el único POST se invoque exactamente una vez.
  Los temporizadores virtuales del segundo caso evitan convertir una condición temporal de interfaz
  en una prueba lenta o inestable.

## Ejecución observada

```powershell
corepack pnpm exec vitest run apps/web/test/post-sale-synchronization.spec.ts --pool=threads --maxWorkers=1
```

Resultado: `1` archivo verde, `2/2` pruebas verdes. Vitest informó `213 ms` para el archivo y
`1,75 s` de duración total del proceso. La medición interna del caso exitoso satisfizo el límite
estricto `< 2.000 ms`; la espera controlada conservó el estado pendiente después de superar ese
límite y terminó sin repetir la mutación.

## Límites confirmados

- Solo se ejecutaron procesos y pruebas locales.
- No se usaron Docker, Supabase, Render, Vercel ni otros servicios remotos.
- No se modificaron reglas backend, FEFO, persistencia, Prisma, migraciones ni secretos.
