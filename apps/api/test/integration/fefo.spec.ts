import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { FefoRepository } from "../../src/modules/inventory/repositories/fefo.repository.js";
import { FefoService } from "../../src/modules/inventory/services/fefo.service.js";
import { InventoryController } from "../../src/modules/inventory/inventory.controller.js";
import { InventoryBalanceService } from "../../src/modules/inventory/services/inventory-balance.service.js";
import { InventoryMovementService } from "../../src/modules/inventory/services/inventory-movement.service.js";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;
let prisma: PrismaModule;

function localDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("FEFO integration requires DATABASE_URL.");
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
    `TRUNCATE TABLE "InventoryAlert", "AlertRule", "InventoryBalance", "InventoryMovement", "Lot", "Product", "UnitOfMeasure", "ProductCategory", "AuditEvent", "Membership", "Tenant", "User" RESTART IDENTITY CASCADE`,
  );
}

async function seed(
  suffix: "A" | "B",
): Promise<{ tenantId: string; userId: string; context: TenantContext }> {
  const id = suffix === "A" ? "1" : "2";
  const tenantId = `00000000-0000-4000-8000-0000000071${id}0`;
  const userId = `00000000-0000-4000-8000-0000000071${id}1`;
  const membershipId = `00000000-0000-4000-8000-0000000071${id}2`;
  await client.tenant.create({
    data: {
      id: tenantId,
      name: `FEFO Tenant ${suffix}`,
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
      operatingTimeZone: "America/Lima",
    },
  });
  await client.user.create({
    data: {
      id: userId,
      displayName: `FEFO Owner ${suffix}`,
      phoneE164: `+51970000${id}01`,
    },
  });
  await client.membership.create({
    data: { id: membershipId, tenantId, userId, status: "ACTIVE" },
  });
  return {
    tenantId,
    userId,
    context: createTenantContextHarness({
      sessionId: `fefo-${suffix}`,
      userId,
      tenantId,
      membershipId,
      contextVersion: 1,
      roles: ["owner_admin"],
      permissions: [
        "inventory.stock.read",
        "inventory.stock.adjust",
        "inventory.movements.write",
      ],
    }),
  };
}

async function product(tenantId: string): Promise<string> {
  const category = await client.productCategory.create({
    data: { tenantId, name: "Alimentos", normalizedName: "alimentos" },
  });
  const unit = await client.unitOfMeasure.create({
    data: { tenantId, code: "UN", name: "Unidad", normalizedName: "unidad" },
  });
  return (
    await client.product.create({
      data: {
        tenantId,
        name: "Producto FEFO",
        normalizedName: "producto fefo",
        categoryId: category.id,
        unitOfMeasureId: unit.id,
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

describe("FEFO integration [T053-T055]", () => {
  it("orders available lots, allocates partial quantity and isolates tenants", async () => {
    const a = await seed("A");
    const b = await seed("B");
    const productA = await product(a.tenantId);
    const productB = await product(b.tenantId);
    await client.lot.createMany({
      data: [
        {
          tenantId: a.tenantId,
          productId: productA,
          receivedAt: new Date("2026-06-01T00:00:00Z"),
          expiresAt: new Date("2026-08-01T00:00:00Z"),
          initialQuantity: 5,
          availableQuantity: 5,
          unitCost: 1,
          createdBy: a.userId,
        },
        {
          tenantId: a.tenantId,
          productId: productA,
          receivedAt: new Date("2026-06-02T00:00:00Z"),
          expiresAt: new Date("2026-07-25T00:00:00Z"),
          initialQuantity: 3,
          availableQuantity: 3,
          unitCost: 1,
          createdBy: a.userId,
        },
        {
          tenantId: a.tenantId,
          productId: productA,
          receivedAt: new Date("2026-01-01T00:00:00Z"),
          expiresAt: new Date("2020-01-01T00:00:00Z"),
          initialQuantity: 9,
          availableQuantity: 9,
          unitCost: 1,
          createdBy: a.userId,
        },
        {
          tenantId: b.tenantId,
          productId: productB,
          receivedAt: new Date("2026-06-01T00:00:00Z"),
          expiresAt: new Date("2026-07-20T00:00:00Z"),
          initialQuantity: 9,
          availableQuantity: 9,
          unitCost: 1,
          createdBy: b.userId,
        },
      ],
    });
    const service = new FefoService(new FefoRepository(prisma));
    const result = await service.suggest(a.context, productA, 6);
    expect(result).toMatchObject({
      productId: productA,
      requestedQuantity: 6,
      canFulfill: true,
    });
    expect(result["items"] as readonly { lotId: string }[]).toHaveLength(2);
    const expired = await client.lot.findFirstOrThrow({
      where: {
        tenantId: a.tenantId,
        productId: productA,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    await client.inventoryBalance.create({
      data: {
        tenantId: a.tenantId,
        productId: productA,
        lotId: expired.id,
        availableQuantity: 9,
        reservedQuantity: 0,
      },
    });
    const inventory = new InventoryController(
      new InventoryMovementService(prisma),
      new InventoryBalanceService(prisma),
    );
    await inventory.createMovement(
      a.context,
      {
        productId: productA,
        lotId: expired.id,
        type: "NEGATIVE_ADJUSTMENT",
        quantity: 1,
        reason: "Ajuste vencido autorizado",
        allowExpiredManualAdjustment: true,
      },
      "00000000-0000-4000-8000-000000007199",
    );
    expect(
      await client.auditEvent.count({
        where: { tenantId: a.tenantId, action: "INVENTORY_MOVEMENT_CREATED" },
      }),
    ).toBe(1);
    await expect(service.suggest(a.context, productB, 1)).rejects.toMatchObject(
      { code: "RESOURCE_NOT_FOUND" },
    );
  });
});
