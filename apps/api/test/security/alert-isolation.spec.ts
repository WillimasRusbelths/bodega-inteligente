import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { AlertService } from "../../src/modules/alerts/services/alert.service.js";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;
let prisma: PrismaModule;

function localDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("Alert isolation requires DATABASE_URL.");
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
    `TRUNCATE TABLE "InventoryAlert", "AlertRule", "Product", "UnitOfMeasure", "ProductCategory", "Membership", "Tenant", "User" RESTART IDENTITY CASCADE`,
  );
}

async function seed(suffix: "A" | "B"): Promise<{
  tenantId: string;
  context: TenantContext;
  seller: TenantContext;
}> {
  const id = suffix === "A" ? "1" : "2";
  const tenantId = `00000000-0000-4000-8000-0000000080${id}0`;
  const userId = `00000000-0000-4000-8000-0000000080${id}1`;
  const membershipId = `00000000-0000-4000-8000-0000000080${id}2`;
  await client.tenant.create({
    data: {
      id: tenantId,
      name: `Isolation ${suffix}`,
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
    },
  });
  await client.user.create({
    data: {
      id: userId,
      displayName: `Isolation ${suffix}`,
      phoneE164: `+51960000${id}01`,
    },
  });
  await client.membership.create({
    data: { id: membershipId, tenantId, userId, status: "ACTIVE" },
  });
  const base = {
    sessionId: `isolation-${suffix}`,
    userId,
    tenantId,
    membershipId,
    contextVersion: 1,
  };
  return {
    tenantId,
    context: createTenantContextHarness({
      ...base,
      roles: ["owner_admin"],
      permissions: ["inventory.alerts.read", "inventory.alerts.write"],
    }),
    seller: createTenantContextHarness({
      ...base,
      roles: ["seller"],
      permissions: ["inventory.alerts.read"],
    }),
  };
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

describe("alert tenant isolation [T060]", () => {
  it("does not enumerate another tenant and seller receives no costs", async () => {
    const a = await seed("A");
    const b = await seed("B");
    const category = await client.productCategory.create({
      data: { tenantId: b.tenantId, name: "B", normalizedName: "b" },
    });
    const unit = await client.unitOfMeasure.create({
      data: {
        tenantId: b.tenantId,
        code: "UN",
        name: "Unidad",
        normalizedName: "unidad",
      },
    });
    const product = await client.product.create({
      data: {
        tenantId: b.tenantId,
        name: "B product",
        normalizedName: "b product",
        categoryId: category.id,
        unitOfMeasureId: unit.id,
      },
    });
    await client.inventoryAlert.create({
      data: {
        tenantId: b.tenantId,
        productId: product.id,
        type: "EXPIRED",
        observedValue: 0,
        thresholdValue: 0,
      },
    });
    const alerts = new AlertService(prisma);
    await expect(alerts.list(a.context, { limit: 20 })).resolves.toMatchObject({
      items: [],
    });
    await expect(alerts.list(b.seller, { limit: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ productId: product.id })],
    });
    const page = (await alerts.list(b.seller, { limit: 20 })) as {
      items: readonly Record<string, unknown>[];
    };
    expect(page.items[0]).not.toHaveProperty("unitCost");
  });
});
