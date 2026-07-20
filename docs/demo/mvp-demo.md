# BodegIA MVP demo

Esta demo abre en navegador una interfaz web administrativa y analitica del MVP
de inventario. Usa `Demo mode`: no implementa login real, ventas reales,
clientes, OCR, IA, offline ni Supabase remoto.

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

URL esperada en la laptop: `http://127.0.0.1:5173`.

Tambien se puede compilar y previsualizar:

```powershell
corepack pnpm --dir apps/web build
corepack pnpm --dir apps/web preview
```

## Abrir desde celular

1. Conectar laptop y celular a la misma red.
2. Obtener la IP local de la laptop, por ejemplo con `ipconfig`.
3. Levantar la demo web. El servidor escucha en `0.0.0.0` por defecto para la
   demo local.
4. Abrir desde el celular usando `http://IP_DE_LA_LAPTOP:5173`.

Para limitar la demo solo a la laptop, ejecutar con `HOST=127.0.0.1`.

## Login demo

La pantalla inicial muestra `BodegIA`, el subtitulo `Plataforma inteligente para
bodegas familiares`, el texto `MVP web administrativo y analitico`, tarjetas de
usuario demo y el boton `Entrar al dashboard`.

El acceso por rol es simulado para la presentacion del MVP. No hay contrasena,
tokens ni autenticacion real en esta pantalla.

## Quien entra a la web

- Dueño administrador: ve gestion completa, costos, valorizacion de inventario,
  perdida estimada, Data Warehouse/DataMart y BI/OLAP completo.
- Encargado de inventario: ve productos, lotes, stock, movimientos, alertas,
  FEFO y BI operativo. Puede ver valorizacion en la demo.
- Vendedor: ve productos, stock, alertas basicas y FEFO operativo. No ve costos,
  valorizacion ni perdida estimada. La interfaz muestra `Vista operativa:
costos protegidos`.

## Que mostrar

- Login demo profesional con selector de rol.
- Dashboard principal con barra lateral, encabezado, rol activo y estado del
  sistema.
- Inicio: KPIs de productos, stock, stock bajo, proximos a vencer, vencidos,
  alertas activas y valorizacion solo para roles autorizados.
- OLTP: productos, categorias, lotes, movimientos/kardex, stock, alertas y
  sugerencia FEFO.
- Data Warehouse / DataMart: flujo OLTP -> DataMart -> OLAP/BI -> Dashboard,
  schema `dw`, dimensiones y hechos.
- BI/OLAP: KPIs, barras de stock por categoria, movimientos por tipo, riesgo de
  vencimiento y alertas por tipo/estado.
- Roles: comparacion clara entre dueño administrador, encargado de inventario y
  vendedor.
- Roadmap: APK Android, login real, escaneo, OCR, ventas rapidas, clientes,
  proveedores, compras, promociones, precios y DataMarts futuros.

## Diferencia OLTP, DataMart y BI/OLAP

OLTP es la capa transaccional diaria: registra productos, lotes, movimientos,
stock, alertas y FEFO en operaciones concretas del tenant activo.

Data Warehouse/DataMart es la capa analitica estructurada. En el MVP solo esta
implementado el DataMart de Inventario en el schema `dw`, con dimensiones y
hechos de inventario.

BI/OLAP resume datos agregados para tomar decisiones: stock por categoria,
riesgo de vencimiento, movimientos por tipo, alertas y valorizacion para roles
autorizados.

## Pendiente para movil/APK

La demo web no genera APK ni implementa app movil final. El roadmap contempla
APK Android, login real movil, escaneo QR/codigo de barras, OCR de vencimientos
y modo offline movil como fases posteriores.

El alcance implementado y el roadmap del sistema completo estan documentados en
`docs/roadmap/sistema-final-bodegia.md`.
