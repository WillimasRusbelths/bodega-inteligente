import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;

function localDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("Alert persistence requires DATABASE_URL.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !(url.hostname === "localhost" || url.hostname === "127.0.0.1") ||
    database !== "bodegia_test"
  )
    throw new Error("Only local bodegia_test is allowed.");
  return value;
}

async function clean(): Promise<void> {
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE "InventoryAlert", "AlertRule", "InventoryBalance", "InventoryMovement", "Lot", "Product", "UnitOfMeasure", "ProductCategory", "Membership", "Tenant", "User" RESTART IDENTITY CASCADE`,
  );
}

beforeAll(() => {
  client = new PrismaClient({
    datasources: { db: { url: localDatabase(databaseUrl) } },
  });
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await client.$disconnect();
});

describe("alert persistence constraints [T058]", () => {
  it("keeps rules tenant-scoped and prevents duplicate active conditions while retaining history", async () => {
    const tenantId = "00000000-0000-4000-8000-000000007501";
    const userId = "00000000-0000-4000-8000-000000007502";
    await client.tenant.create({
      data: {
        id: tenantId,
        name: "Alert Tenant",
        createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
      },
    });
    await client.user.create({
      data: {
        id: userId,
        displayName: "Alert Owner",
        phoneE164: "+519800007501",
      },
    });
    const membership = await client.membership.create({
      data: { tenantId, userId, status: "ACTIVE" },
    });
    const category = await client.productCategory.create({
      data: { tenantId, name: "A", normalizedName: "a" },
    });
    const unit = await client.unitOfMeasure.create({
      data: { tenantId, code: "UN", name: "Unidad", normalizedName: "unidad" },
    });
    const product = await client.product.create({
      data: {
        tenantId,
        name: "Alert Product",
        normalizedName: "alert product",
        categoryId: category.id,
        unitOfMeasureId: unit.id,
      },
    });
    await client.alertRule.create({
      data: {
        tenantId,
        productId: product.id,
        minimumStock: 2,
        expiryAlertDays: 7,
      },
    });
    const active = await client.inventoryAlert.create({
      data: {
        tenantId,
        productId: product.id,
        type: "LOW_STOCK",
        observedValue: 0,
        thresholdValue: 2,
      },
    });
    await expect(
      client.inventoryAlert.create({
        data: {
          tenantId,
          productId: product.id,
          type: "LOW_STOCK",
          observedValue: 0,
          thresholdValue: 2,
        },
      }),
    ).rejects.toThrow();
    await client.inventoryAlert.update({
      where: { tenantId_id: { tenantId, id: active.id } },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: userId },
    });
    await expect(
      client.inventoryAlert.create({
        data: {
          tenantId,
          productId: product.id,
          type: "LOW_STOCK",
          observedValue: 0,
          thresholdValue: 2,
        },
      }),
    ).resolves.toBeDefined();
    expect(membership.tenantId).toBe(tenantId);
  });
});
