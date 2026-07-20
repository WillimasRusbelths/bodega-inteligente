# Auditoría de alcance MVP

Fecha de revisión: 2026-07-19. Revisión estática de rutas, dependencias, clientes, pruebas y
workflows del repositorio.

## Dentro del gate

Productos, categorías, unidades tenant-scoped, lotes, vencimientos, movimientos, saldos, kardex,
FEFO, alertas, privacidad de costos, auditoría e interfaces web/móvil operativas.

## Fuera de alcance verificado

No se agregaron rutas ni clientes para ventas, clientes, OCR, BI/Data Warehouse, ETL, Power BI,
promociones, IA, reposición inteligente, consumidores, offline, SMS, correo, pairing web,
biometría ni `TENANT_SHARED`.

Los clientes importan únicamente el transporte REST; no importan Prisma, PostgreSQL, Supabase ni
`apps/api/src/infrastructure`. Las métricas de rendimiento y usabilidad no se consideran ejecutadas
por esta auditoría.
