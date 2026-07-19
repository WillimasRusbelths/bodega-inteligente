import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { AlertsController } from "../../src/modules/alerts/alerts.controller.js";
import { AlertService } from "../../src/modules/alerts/services/alert.service.js";
import { LotsController } from "../../src/modules/lots/lots.controller.js";
import { LotReceiptService } from "../../src/modules/lots/services/lot-receipt.service.js";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;
let prisma: PrismaModule;

function localDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("Alert integration requires DATABASE_URL.");
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
    `TRUNCATE TABLE "InventoryAlert", "AlertRule", "InventoryBalance", "InventoryMovement", "Lot", "Product", "UnitOfMeasure", "ProductCategory", "AuditEvent", "IdempotencyRecord", "Membership", "Tenant", "User" RESTART IDENTITY CASCADE`,
  );
}

async function seed(suffix: "A" | "B"): Promise<{
  tenantId: string;
  userId: string;
  context: TenantContext;
  seller: TenantContext;
}> {
  const id = suffix === "A" ? "1" : "2";
  const tenantId = `00000000-0000-4000-8000-0000000078${id}0`;
  const userId = `00000000-0000-4000-8000-0000000078${id}1`;
  const membershipId = `00000000-0000-4000-8000-0000000078${id}2`;
  await client.tenant.create({
    data: {
      id: tenantId,
      name: `Alert Tenant ${suffix}`,
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
      operatingTimeZone: "America/Lima",
    },
  });
  await client.user.create({
    data: {
      id: userId,
      displayName: `Alert Owner ${suffix}`,
      phoneE164: `+51990000${id}01`,
    },
  });
  await client.membership.create({
    data: { id: membershipId, tenantId, userId, status: "ACTIVE" },
  });
  const base = {
    sessionId: `alert-${suffix}`,
    userId,
    tenantId,
    membershipId,
    contextVersion: 1,
  };
  return {
    tenantId,
    userId,
    context: createTenantContextHarness({
      ...base,
      roles: ["owner_admin"],
      permissions: [
        "inventory.lots.read",
        "inventory.lots.write",
        "inventory.alerts.read",
        "inventory.alerts.write",
      ],
    }),
    seller: createTenantContextHarness({
      ...base,
      roles: ["seller"],
      permissions: ["inventory.alerts.read"],
    }),
  };
}

async function product(tenantId: string): Promise<string> {
  const category = await client.productCategory.create({
    data: { tenantId, name: "Alertas", normalizedName: "alertas" },
  });
  const unit = await client.unitOfMeasure.create({
    data: { tenantId, code: "UN", name: "Unidad", normalizedName: "unidad" },
  });
  return (
    await client.product.create({
      data: {
        tenantId,
        name: "Producto alerta",
        normalizedName: "producto alerta",
        categoryId: category.id,
        unitOfMeasureId: unit.id,
        minimumStock: 5,
        expiryAlertDays: 30,
      },
    })
  ).id;
}

beforeAll(() => {
  client = new PrismaClient({
    datasources: { db: { url: localDatabase(databaseUrl) } },
  });
  prisma = new PrismaModule(client);
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await client.$disconnect();
});

describe("inventory alerts integration [T059-T065]", () => {
  it("generates low-stock, expiring and expired alerts without duplicates", async () => {
    const a = await seed("A");
    const b = await seed("B");
    const productA = await product(a.tenantId);
    const productB = await product(b.tenantId);
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const lots = new LotsController(new LotReceiptService(prisma));
    await lots.createLotReceipt(
      a.context,
      productA,
      {
        receivedAt: new Date().toISOString(),
        expiresAt: tomorrow,
        initialQuantity: 2,
        unitCost: 3,
      },
      "00000000-0000-4000-8000-000000007801",
    );
    await lots.createLotReceipt(
      a.context,
      productA,
      {
        receivedAt: new Date().toISOString(),
        expiresAt: "2020-01-01",
        initialQuantity: 2,
        unitCost: 3,
      },
      "00000000-0000-4000-8000-000000007802",
    );
    const alerts = new AlertService(prisma);
    await alerts.evaluate(a.context, productA);
    const page = (await alerts.list(a.context, { limit: 20 })) as {
      items: readonly Record<string, unknown>[];
    };
    expect(page.items.map((item) => item["type"])).toEqual(
      expect.arrayContaining(["LOW_STOCK", "EXPIRING_SOON", "EXPIRED"]),
    );
    expect(
      await client.inventoryAlert.count({
        where: { tenantId: a.tenantId, status: "ACTIVE" },
      }),
    ).toBe(3);
    await alerts.evaluate(a.context, productA);
    expect(
      await client.inventoryAlert.count({
        where: { tenantId: a.tenantId, status: "ACTIVE" },
      }),
    ).toBe(3);
    await expect(alerts.list(a.context, { limit: 20 })).resolves.toBeDefined();
    await expect(
      alerts.list(a.context, {
        limit: 20,
        categoryId: "00000000-0000-4000-8000-000000009999",
      }),
    ).resolves.toMatchObject({ items: [] });
    await expect(
      alerts.list(a.context, { limit: 20 }),
    ).resolves.not.toMatchObject({ productId: productB });
    const first = page.items[0];
    if (first === undefined) throw new Error("Expected an active alert.");
    const controller = new AlertsController(alerts);
    const resolved = (await controller.resolve(
      a.context,
      String(first["id"]),
      { status: "RESOLVED", reason: "Revisada" },
      "00000000-0000-4000-8000-000000007803",
    )) as { data: Record<string, unknown> };
    expect(resolved.data).toMatchObject({ status: "RESOLVED" });
    expect(
      await client.auditEvent.count({
        where: { tenantId: a.tenantId, action: "INVENTORY_ALERT_RESOLVED" },
      }),
    ).toBe(1);
    const sellerPage = (await alerts.list(a.seller, { limit: 20 })) as {
      items: readonly Record<string, unknown>[];
    };
    expect(sellerPage.items[0]).not.toHaveProperty("unitCost");
  });
});
