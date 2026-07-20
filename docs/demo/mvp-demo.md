# BodegIA MVP demo

Esta demo permite abrir en navegador el MVP final de inventario sin depender de
ventas reales, clientes, OCR, IA, offline ni Supabase remoto.

## Preparar base local

1. Definir `DATABASE_URL` apuntando al PostgreSQL local de pruebas.
2. Aplicar migraciones:

```powershell
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

3. Cargar datos sinteticos:

```powershell
corepack pnpm seed:demo
```

El seed crea la bodega demo `Bodega San Cristobal`, roles `owner_admin`,
`inventory_manager` y `seller`, productos, lotes vigentes/proximos/vencidos,
movimientos y alertas.

## Levantar API

```powershell
corepack pnpm --filter @bodegia/api start:performance
```

La API expone `GET /health` y los endpoints tenant-scoped del MVP, incluyendo
BI bajo `/tenants/current/bi/*`.

## Levantar frontend

```powershell
corepack pnpm --dir apps/web dev
```

URL esperada: `http://127.0.0.1:5173`.

Tambien se puede compilar y previsualizar:

```powershell
corepack pnpm --dir apps/web build
corepack pnpm --dir apps/web preview
```

## Que mostrar

- Titulo `BodegIA MVP` y etiqueta `Demo mode`.
- OLTP: productos, lotes, movimientos/kardex, stock, alertas y sugerencia FEFO.
- BI/OLAP: KPIs de productos, stock disponible, stock bajo, proximos a vencer,
  vencidos, alertas activas, stock por categoria, riesgo de vencimiento,
  movimientos por tipo y alertas por tipo.
- Selector de rol: `owner_admin`, `inventory_manager` y `seller`.
- En rol `seller`, costos, valorizacion y perdidas estimadas permanecen ocultos.

## Diferencia OLTP vs OLAP/BI

OLTP es la capa transaccional diaria: registra productos, lotes, movimientos,
stock, alertas y FEFO en operaciones concretas del tenant activo.

OLAP/BI es la capa analitica: resume los datos OLTP para explicar el estado del
inventario mediante indicadores, agrupaciones por categoria, riesgo de
vencimiento, movimientos por tipo y alertas activas. En esta demo se presenta
como tablero operativo para exposicion, no como SLA ni como data warehouse final.
