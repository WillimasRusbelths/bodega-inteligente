-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'DEPLETED', 'EXPIRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'POSITIVE_ADJUSTMENT', 'NEGATIVE_ADJUSTMENT', 'WASTE', 'SALE_OUT');

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalizedName" VARCHAR(120) NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalizedName" VARCHAR(120) NOT NULL,
    "quantityScale" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalizedName" VARCHAR(160) NOT NULL,
    "sku" VARCHAR(80),
    "barcode" VARCHAR(80),
    "categoryId" UUID,
    "unitOfMeasureId" UUID NOT NULL,
    "minimumStock" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "expiryAlertDays" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" DATE NOT NULL,
    "initialQuantity" DECIMAL(20,6) NOT NULL,
    "availableQuantity" DECIMAL(20,6) NOT NULL,
    "unitCost" DECIMAL(20,4) NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "quantityDelta" DECIMAL(20,6) NOT NULL,
    "balanceBefore" DECIMAL(20,6) NOT NULL,
    "balanceAfter" DECIMAL(20,6) NOT NULL,
    "reason" VARCHAR(240) NOT NULL,
    "actorId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "availableQuantity" DECIMAL(20,6) NOT NULL,
    "reservedQuantity" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("tenantId","productId","lotId")
);

-- CreateIndex
CREATE INDEX "ProductCategory_tenantId_status_idx" ON "ProductCategory"("tenantId", "status");
CREATE UNIQUE INDEX "ProductCategory_tenantId_id_key" ON "ProductCategory"("tenantId", "id");
CREATE UNIQUE INDEX "ProductCategory_tenantId_normalizedName_key" ON "ProductCategory"("tenantId", "normalizedName");
CREATE INDEX "UnitOfMeasure_tenantId_status_idx" ON "UnitOfMeasure"("tenantId", "status");
CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_id_key" ON "UnitOfMeasure"("tenantId", "id");
CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_code_key" ON "UnitOfMeasure"("tenantId", "code");
CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_normalizedName_key" ON "UnitOfMeasure"("tenantId", "normalizedName");
CREATE INDEX "Product_tenantId_normalizedName_idx" ON "Product"("tenantId", "normalizedName");
CREATE INDEX "Product_tenantId_status_idx" ON "Product"("tenantId", "status");
CREATE UNIQUE INDEX "Product_tenantId_id_key" ON "Product"("tenantId", "id");
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");
CREATE UNIQUE INDEX "Product_tenantId_barcode_key" ON "Product"("tenantId", "barcode");
CREATE INDEX "Lot_tenantId_productId_status_expiresAt_idx" ON "Lot"("tenantId", "productId", "status", "expiresAt");
CREATE UNIQUE INDEX "Lot_tenantId_id_key" ON "Lot"("tenantId", "id");
CREATE UNIQUE INDEX "Lot_tenantId_productId_id_key" ON "Lot"("tenantId", "productId", "id");
CREATE INDEX "InventoryMovement_tenantId_productId_createdAt_id_idx" ON "InventoryMovement"("tenantId", "productId", "createdAt", "id");
CREATE INDEX "InventoryMovement_tenantId_lotId_createdAt_id_idx" ON "InventoryMovement"("tenantId", "lotId", "createdAt", "id");
CREATE UNIQUE INDEX "InventoryMovement_tenantId_id_key" ON "InventoryMovement"("tenantId", "id");
CREATE UNIQUE INDEX "InventoryMovement_tenantId_idempotencyKey_key" ON "InventoryMovement"("tenantId", "idempotencyKey");
CREATE INDEX "InventoryBalance_tenantId_productId_idx" ON "InventoryBalance"("tenantId", "productId");

-- Preserve the identity relation already present in 0001 while aligning its Prisma name.
ALTER TABLE "DeviceProfile" RENAME CONSTRAINT "DeviceProfile_membership_user_fkey" TO "DeviceProfile_tenantId_membershipId_userId_fkey";

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "ProductCategory"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_unitOfMeasureId_fkey" FOREIGN KEY ("tenantId", "unitOfMeasureId") REFERENCES "UnitOfMeasure"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_productId_lotId_fkey" FOREIGN KEY ("tenantId", "productId", "lotId") REFERENCES "Lot"("tenantId", "productId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_productId_lotId_fkey" FOREIGN KEY ("tenantId", "productId", "lotId") REFERENCES "Lot"("tenantId", "productId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep quantities non-negative at the database boundary. Inventory operations
-- still validate business rules in the service layer before writing movements.
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_quantities_non_negative_check"
  CHECK ("initialQuantity" > 0 AND "availableQuantity" >= 0 AND "availableQuantity" <= "initialQuantity" AND "unitCost" >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantities_non_negative_check"
  CHECK ("quantity" > 0 AND "balanceBefore" >= 0 AND "balanceAfter" >= 0);
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_quantities_non_negative_check"
  CHECK ("availableQuantity" >= 0 AND "reservedQuantity" >= 0);
