# Runbook de persistencia de productos e inventario

La migración comprometida es `0002_product_inventory_lots`; las alertas/FEFO posteriores usan la
migración versionada existente del repositorio. Ejecutar siempre en una base de pruebas PostgreSQL
16.14, nunca contra producción.

```powershell
$env:DATABASE_URL='postgresql://bodegia_test:BodegiaLocal2026@127.0.0.1:5432/bodegia_test?schema=public'
corepack pnpm exec prisma migrate deploy
corepack pnpm exec prisma migrate status
```

Antes de una aplicación en un ambiente compartido, tomar un backup aprobado. Para rollback no se
editan migraciones aplicadas ni se borran filas históricas: se restaura el backup del ambiente de
prueba o se prepara una migración compensatoria revisada. La auditoría y el kardex son append-only.
