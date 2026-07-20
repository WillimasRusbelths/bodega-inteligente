CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED');

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "salePrice" DECIMAL(20, 4) NOT NULL DEFAULT 0;

CREATE TABLE "Sale" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "sellerUserId" UUID NOT NULL,
  "saleNumber" VARCHAR(40) NOT NULL,
  "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
  "subtotal" DECIMAL(20, 4) NOT NULL,
  "total" DECIMAL(20, 4) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'PEN',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "lotId" UUID,
  "quantity" DECIMAL(20, 6) NOT NULL,
  "unitPrice" DECIMAL(20, 4) NOT NULL,
  "lineTotal" DECIMAL(20, 4) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sale_tenantId_id_key" ON "Sale"("tenantId", "id");
CREATE UNIQUE INDEX "Sale_tenantId_saleNumber_key" ON "Sale"("tenantId", "saleNumber");
CREATE INDEX "Sale_tenantId_createdAt_id_idx" ON "Sale"("tenantId", "createdAt", "id");
CREATE INDEX "Sale_tenantId_membershipId_createdAt_idx" ON "Sale"("tenantId", "membershipId", "createdAt");

CREATE UNIQUE INDEX "SaleItem_tenantId_id_key" ON "SaleItem"("tenantId", "id");
CREATE INDEX "SaleItem_tenantId_saleId_idx" ON "SaleItem"("tenantId", "saleId");
CREATE INDEX "SaleItem_tenantId_productId_idx" ON "SaleItem"("tenantId", "productId");
CREATE INDEX "SaleItem_tenantId_lotId_idx" ON "SaleItem"("tenantId", "lotId");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_tenantId_membershipId_fkey"
FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_sellerUserId_fkey"
FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_tenantId_saleId_fkey"
FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_tenantId_productId_fkey"
FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_tenantId_productId_lotId_fkey"
FOREIGN KEY ("tenantId", "productId", "lotId") REFERENCES "Lot"("tenantId", "productId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_unitPrice_non_negative_check" CHECK ("unitPrice" >= 0);

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_lineTotal_non_negative_check" CHECK ("lineTotal" >= 0);

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_subtotal_non_negative_check" CHECK ("subtotal" >= 0);

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_total_non_negative_check" CHECK ("total" >= 0);
