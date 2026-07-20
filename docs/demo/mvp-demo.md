# BodegIA MVP demo

Esta demo abre en navegador una interfaz web administrativa y analitica del MVP
de inventario. Usa `Demo mode` con login funcional basico contra la API local y
PostgreSQL de pruebas. No implementa ventas reales, clientes, OCR, IA, offline
ni Supabase remoto.

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

La API expone `GET /health`, endpoints tenant-scoped del MVP, BI bajo
`/tenants/current/bi/*`, login demo bajo `/demo/auth/*`, configuracion de bodega
bajo `/tenants/current/settings` y empleados demo bajo
`/tenants/current/memberships`.

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
3. Levantar la API y la demo web. Ambos servidores escuchan en `0.0.0.0` para
   la demo local.
4. Abrir desde el celular usando `http://IP_DE_LA_LAPTOP:5173`.

Para limitar la demo solo a la laptop, ejecutar la web con `HOST=127.0.0.1`.

## Login MVP demo

La pantalla inicial muestra `BodegIA`, el subtitulo `Plataforma inteligente para
bodegas familiares`, el texto `MVP web con login funcional, bodega activa, roles
e inventario`, tarjetas de usuario demo y el boton `Iniciar sesion`.

Usuarios sinteticos creados por `corepack pnpm seed:demo`:

| Usuario       | PIN demo | Rol                 |
| ------------- | -------- | ------------------- |
| `propietario` | `100001` | `owner_admin`       |
| `inventario`  | `100002` | `inventory_manager` |
| `vendedor`    | `100003` | `seller`            |

El login demo valida estas credenciales contra la API local y crea una sesion
MVP de demostracion mediante `X-Demo-Session`. Este flujo esta deshabilitado si
`NODE_ENV=production` y no sustituye el hardening productivo de autenticacion
web.

## Que puede hacer cada rol

- `owner_admin`: ve gestion completa, configuracion de bodega, empleados,
  costos, valorizacion de inventario, perdida estimada, Data Warehouse/DataMart
  y BI/OLAP completo.
- `inventory_manager`: ve productos, lotes, stock, movimientos, alertas, FEFO y
  BI operativo. Puede ver valorizacion operativa, pero no administra empleados
  en este Sprint 1.
- `seller`: ve productos, stock, alertas basicas y FEFO operativo. No ve costos,
  valorizacion, perdida estimada, configuracion de bodega ni administracion de
  empleados. La interfaz muestra `Vista operativa: costos protegidos`.

## Que mostrar en la exposicion

- Login MVP demo con usuario, PIN, sesion activa y cierre de sesion.
- Dashboard principal con barra lateral, encabezado, rol activo y estado del
  sistema.
- Configuracion de bodega para `owner_admin`: nombre, ubicacion textual, moneda,
  horario referencial y estado.
- Empleados y roles para `owner_admin`: propietario, encargado de inventario y
  vendedor asociados a la bodega activa.
- Inicio: KPIs de productos, stock, stock bajo, proximos a vencer, vencidos,
  alertas activas y valorizacion solo para roles autorizados.
- OLTP: productos, categorias, lotes, movimientos/kardex, stock, alertas y
  sugerencia FEFO.
- Data Warehouse / DataMart: flujo OLTP -> DataMart -> OLAP/BI -> Dashboard,
  schema `dw`, dimensiones y hechos.
- BI/OLAP: KPIs, barras de stock por categoria, movimientos por tipo, riesgo de
  vencimiento y alertas por tipo/estado.
- Permisos: comparacion clara entre dueno administrador, encargado de inventario
  y vendedor.
- Roadmap: APK Android, hardening de login, escaneo, OCR, ventas rapidas,
  clientes, proveedores, compras, promociones, precios y DataMarts futuros.

## Diferencia OLTP, DataMart y BI/OLAP

OLTP es la capa transaccional diaria: registra productos, lotes, movimientos,
stock, alertas y FEFO en operaciones concretas del tenant activo.

Data Warehouse/DataMart es la capa analitica estructurada. En el MVP solo esta
implementado el DataMart de Inventario en el schema `dw`, con dimensiones y
hechos de inventario.

BI/OLAP resume datos agregados para tomar decisiones: stock por categoria,
riesgo de vencimiento, movimientos por tipo, alertas y valorizacion para roles
autorizados.

## Pendiente para produccion y movil/APK

Queda pendiente el hardening productivo de autenticacion web, recuperacion de
cuenta, alta completa de empleados, APK Android, login real movil, escaneo
QR/codigo de barras, OCR de vencimientos y modo offline movil como fases
posteriores.

El alcance implementado y el roadmap del sistema completo estan documentados en
`docs/roadmap/sistema-final-bodegia.md`.
