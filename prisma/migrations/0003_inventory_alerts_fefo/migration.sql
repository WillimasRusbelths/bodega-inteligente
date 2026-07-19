-- CreateEnum
CREATE TYPE "InventoryAlertType" AS ENUM ('LOW_STOCK', 'EXPIRING_SOON', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "operatingTimeZone" VARCHAR(64) NOT NULL DEFAULT 'America/Lima';

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "minimumStock" DECIMAL(20,6) NOT NULL,
    "expiryAlertDays" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAlert" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "lotId" UUID,
    "type" "InventoryAlertType" NOT NULL,
    "status" "InventoryAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "observedValue" DECIMAL(20,6) NOT NULL,
    "thresholdValue" DECIMAL(20,6) NOT NULL,
    "triggeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedBy" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertRule_tenantId_enabled_idx" ON "AlertRule"("tenantId", "enabled");
CREATE UNIQUE INDEX "AlertRule_tenantId_id_key" ON "AlertRule"("tenantId", "id");
CREATE UNIQUE INDEX "AlertRule_tenantId_productId_key" ON "AlertRule"("tenantId", "productId");
CREATE INDEX "InventoryAlert_tenantId_status_type_triggeredAt_idx" ON "InventoryAlert"("tenantId", "status", "type", "triggeredAt");
CREATE INDEX "InventoryAlert_tenantId_productId_lotId_type_status_idx" ON "InventoryAlert"("tenantId", "productId", "lotId", "type", "status");
CREATE UNIQUE INDEX "InventoryAlert_tenantId_id_key" ON "InventoryAlert"("tenantId", "id");
CREATE UNIQUE INDEX "InventoryAlert_active_condition_key"
  ON "InventoryAlert"("tenantId", "productId", "lotId", "type")
  WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "InventoryAlert_active_low_stock_key"
  ON "InventoryAlert"("tenantId", "productId", "type")
  WHERE "status" = 'ACTIVE' AND "type" = 'LOW_STOCK';

ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_tenantId_productId_fkey"
  FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_tenantId_productId_fkey"
  FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_tenantId_productId_lotId_fkey"
  FOREIGN KEY ("tenantId", "productId", "lotId") REFERENCES "Lot"("tenantId", "productId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
