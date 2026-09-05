import { PrismaClient } from "@prisma/client";
import process from "node:process";
import { URL } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
const database = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(database.hostname) ||
  database.pathname !== "/bodegia_test"
) {
  throw new Error("T062 only allows the local bodegia_test database.");
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const ids = {
  tenant: "00000000-0000-4000-8000-000000000001",
  owner: "00000000-0000-4000-8000-000000000011",
  membership: "00000000-0000-4000-8000-000000000101",
  category: "00000000-0000-4000-8000-000000000961",
  unit: "00000000-0000-4000-8000-000000000962",
  product: "00000000-0000-4000-8000-000000000963",
  lot: "00000000-0000-4000-8000-000000000964",
};

async function cleanup() {
  const sales = await prisma.saleItem.findMany({
    where: { productId: ids.product },
    select: { saleId: true },
  });
  const saleIds = [...new Set(sales.map(({ saleId }) => saleId))];
  await prisma.saleItem.deleteMany({ where: { productId: ids.product } });
  if (saleIds.length > 0)
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.inventoryAlert.deleteMany({ where: { productId: ids.product } });
  await prisma.alertRule.deleteMany({ where: { productId: ids.product } });
  await prisma.inventoryMovement.deleteMany({
    where: { productId: ids.product },
  });
  await prisma.inventoryBalance.deleteMany({
    where: { productId: ids.product },
  });
  await prisma.lot.deleteMany({ where: { id: ids.lot } });
  await prisma.product.deleteMany({ where: { id: ids.product } });
  await prisma.unitOfMeasure.deleteMany({ where: { id: ids.unit } });
  await prisma.productCategory.deleteMany({ where: { id: ids.category } });
  await prisma.user.updateMany({
    where: { id: ids.owner },
    data: { displayName: "Propietario demo" },
  });
}

async function setup() {
  await cleanup();
  await prisma.user.upsert({
    where: { id: ids.owner },
    update: { displayName: "Propietario local T062", status: "ACTIVE" },
    create: {
      id: ids.owner,
      displayName: "Propietario local T062",
      phoneE164: "+51900000001",
      status: "ACTIVE",
    },
  });
  await prisma.tenant.upsert({
    where: { id: ids.tenant },
    update: { status: "ACTIVE" },
    create: {
      id: ids.tenant,
      name: "Bodega local T062",
      status: "ACTIVE",
      createdByTechnicalAdminId: ids.owner,
      operatingTimeZone: "America/Lima",
      currencyCode: "PEN",
    },
  });
  await prisma.membership.upsert({
    where: { id: ids.membership },
    update: { tenantId: ids.tenant, userId: ids.owner, status: "ACTIVE" },
    create: {
      id: ids.membership,
      tenantId: ids.tenant,
      userId: ids.owner,
      status: "ACTIVE",
      joinedAt: new Date("2026-09-04T00:00:00Z"),
    },
  });
  await prisma.productCategory.create({
    data: {
      id: ids.category,
      tenantId: ids.tenant,
      name: "Lacteos T062",
      normalizedName: "lacteos t062",
    },
  });
  await prisma.unitOfMeasure.create({
    data: {
      id: ids.unit,
      tenantId: ids.tenant,
      code: "UND-T062",
      name: "Unidad T062",
      normalizedName: "unidad t062",
    },
  });
  await prisma.product.create({
    data: {
      id: ids.product,
      tenantId: ids.tenant,
      name: "Leche PostgreSQL T062",
      normalizedName: "leche postgresql t062",
      sku: "LEC-T062",
      categoryId: ids.category,
      unitOfMeasureId: ids.unit,
      minimumStock: 2,
      expiryAlertDays: 10,
      salePrice: 5.5,
      status: "ACTIVE",
    },
  });
  await prisma.lot.create({
    data: {
      id: ids.lot,
      tenantId: ids.tenant,
      productId: ids.product,
      receivedAt: new Date("2026-09-01T00:00:00Z"),
      expiresAt: new Date("2027-12-31T00:00:00Z"),
      initialQuantity: 18,
      availableQuantity: 18,
      unitCost: 3,
      status: "AVAILABLE",
      createdBy: ids.owner,
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      tenantId: ids.tenant,
      productId: ids.product,
      lotId: ids.lot,
      availableQuantity: 18,
    },
  });
}

async function verify() {
  const [sales, balance] = await Promise.all([
    prisma.saleItem.count({ where: { productId: ids.product } }),
    prisma.inventoryBalance.findUniqueOrThrow({
      where: {
        tenantId_productId_lotId: {
          tenantId: ids.tenant,
          productId: ids.product,
          lotId: ids.lot,
        },
      },
      select: { availableQuantity: true },
    }),
  ]);
  if (sales !== 1 || balance.availableQuantity.toNumber() !== 17) {
    throw new Error(
      `T062 persistence mismatch: sales=${sales}, stock=${balance.availableQuantity.toString()}`,
    );
  }
  process.stdout.write(
    JSON.stringify({
      persistedSaleItems: sales,
      authoritativeStock: balance.availableQuantity.toNumber(),
    }),
  );
}

try {
  const command = process.argv[2];
  if (command === "setup") await setup();
  else if (command === "verify") await verify();
  else if (command === "cleanup") await cleanup();
  else throw new Error("Use setup, verify or cleanup.");
} finally {
  await prisma.$disconnect();
}
