# Resultado final Playwright local

**Fecha**: 2026-09-04 (`America/Lima`)  
**Runtime**: API local `127.0.0.1:3000`, Vite local `127.0.0.1:5173`, Chromium, un worker  
**Persistencia**: PostgreSQL local `bodegia_test`

## Suites T069

```powershell
corepack pnpm exec playwright test apps/web/e2e/web-stabilization-stock-sale.spec.ts apps/web/e2e/web-stabilization-capabilities.spec.ts apps/web/e2e/web-stabilization-seller-privacy.spec.ts apps/web/e2e/web-stabilization-recovery.spec.ts apps/web/e2e/web-stabilization-responsive-accessibility.spec.ts --workers=1 --reporter=line --output=apps/web/dist/t069-final
```

Resultado final: `13/13` pruebas aprobadas en `46.3 s`.

| Archivo | Casos | Resultado |
|---|---:|---|
| `web-stabilization-stock-sale.spec.ts` | 1 | stock 18→17 en venta, operación, inicio y BI; un POST y una venta persistida |
| `web-stabilization-capabilities.spec.ts` | 4 | owner, inventory manager, seller, cambio de contexto y deep link |
| `web-stabilization-seller-privacy.spec.ts` | 1 | DOM, estados y respuesta visible sin campos financieros |
| `web-stabilization-recovery.spec.ts` | 1 | loading/empty/error/stale y recuperación solo GET |
| `web-stabilization-responsive-accessibility.spec.ts` | 6 | 320/768/1440, teclado/foco, sin overflow de página |

Baselines emitidos por la suite responsive: ancho de página igual al viewport (`320`, `768`,
`1440`), destino actual `#inicio` y lista `overflow: []` en los tres anchos.

Dos ejecuciones previas quedaron `12/13` porque la regresión API había limpiado la membresía demo de
`inventory_manager`; primero el login devolvió `404` y luego los recursos `401 SESSION_INVALID`. El
setup local T069 se completó para reponer usuarios y membresías demo estándar antes de la ejecución.
No se relajó el E2E ni se cambió autenticación o autorización productiva.

## Persistencia y cleanup

Después del E2E:

```json
{"persistedSaleItems":1,"authoritativeStock":17}
```

Después de `cleanup` y `verify-clean`:

```json
{"products":0,"lots":0,"balances":0,"saleItems":0,"categories":0,"units":0}
```

Los servidores locales fueron detenidos. No se usó ningún servicio remoto.

