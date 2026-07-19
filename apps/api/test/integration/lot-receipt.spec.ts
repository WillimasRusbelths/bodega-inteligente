import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { LotsController } from "../../src/modules/lots/lots.controller.js";
import { LotReceiptService } from "../../src/modules/lots/services/lot-receipt.service.js";
import { InventoryController } from "../../src/modules/inventory/inventory.controller.js";
import { InventoryMovementService } from "../../src/modules/inventory/services/inventory-movement.service.js";
import { InventoryBalanceService } from "../../src/modules/inventory/services/inventory-balance.service.js";
import { AuditService } from "../../src/modules/audit/services/audit.service.js";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;
let prisma: PrismaModule;

function localDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("Lot and inventory integration requires DATABASE_URL.");
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
    `TRUNCATE TABLE "InventoryBalance", "InventoryMovement", "Lot", "Product", "UnitOfMeasure", "ProductCategory", "RefreshCredential", "Session", "ActivationManualAlias", "ActivationChallenge", "DeviceProfile", "Device", "AuditEvent", "IdempotencyRecord", "MembershipRole", "RolePermission", "Permission", "Role", "Membership", "Tenant", "User" RESTART IDENTITY CASCADE`,
  );
}

async function seed(suffix: "A" | "B"): Promise<{
  readonly tenantId: string;
  readonly userId: string;
  readonly context: TenantContext;
  readonly seller: TenantContext;
}> {
  const ids =
    suffix === "A"
      ? {
          tenantId: "00000000-0000-4000-8000-000000004001",
          userId: "00000000-0000-4000-8000-000000004011",
          membershipId: "00000000-0000-4000-8000-000000004021",
        }
      : {
          tenantId: "00000000-0000-4000-8000-000000004002",
          userId: "00000000-0000-4000-8000-000000004012",
          membershipId: "00000000-0000-4000-8000-000000004022",
        };
  await client.tenant.create({
    data: {
      id: ids.tenantId,
      name: `Synthetic lot tenant ${suffix}`,
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
    },
  });
  await client.user.create({
    data: {
      id: ids.userId,
      displayName: `Synthetic lot owner ${suffix}`,
      phoneE164: suffix === "A" ? "+51930000401" : "+51930000402",
    },
  });
  await client.membership.create({
    data: {
      id: ids.membershipId,
      tenantId: ids.tenantId,
      userId: ids.userId,
      status: "ACTIVE",
    },
  });
  const base = {
    sessionId: `lot-session-${suffix}`,
    userId: ids.userId,
    tenantId: ids.tenantId,
    membershipId: ids.membershipId,
    contextVersion: 1,
  };
  const permissions = [
    "inventory.products.read",
    "inventory.lots.read",
    "inventory.lots.write",
    "inventory.stock.read",
    "inventory.movements.read",
    "inventory.movements.write",
  ];
  return {
    ...ids,
    context: createTenantContextHarness({
      ...base,
      roles: ["owner_admin"],
      permissions,
    }),
    seller: createTenantContextHarness({
      ...base,
      roles: ["seller"],
      permissions: [
        "inventory.lots.read",
        "inventory.stock.read",
        "inventory.movements.read",
      ],
    }),
  };
}

async function productFor(tenantId: string): Promise<string> {
  const category = await client.productCategory.create({
    data: { tenantId, name: "Alimentos", normalizedName: "alimentos" },
  });
  const unit = await client.unitOfMeasure.create({
    data: {
      tenantId,
      code: "UN",
      name: "Unidad",
      normalizedName: "unidad",
      quantityScale: 0,
    },
  });
  const product = await client.product.create({
    data: {
      tenantId,
      name: "Arroz",
      normalizedName: "arroz",
      categoryId: category.id,
      unitOfMeasureId: unit.id,
    },
  });
  return product.id;
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

describe("lot receipt and inventory movement integration [T034, T036-T038, T042]", () => {
  class FailingAuditService extends AuditService {
    public override append(
      ..._args: Parameters<AuditService["append"]>
    ): Promise<Readonly<Record<string, unknown>>> {
      void _args;
      return Promise.reject(new Error("synthetic audit failure"));
    }
  }

  it("rolls back the lot receipt when audit append fails", async () => {
    const a = await seed("A");
    const productId = await productFor(a.tenantId);
    const lots = new LotsController(
      new LotReceiptService(prisma, new FailingAuditService()),
    );
    await expect(
      lots.createLotReceipt(
        a.context,
        productId,
        {
          receivedAt: "2026-07-01T12:00:00.000Z",
          expiresAt: "2027-07-01",
          initialQuantity: 4,
          unitCost: 2,
        },
        "00000000-0000-4000-8000-000000004100",
      ),
    ).rejects.toThrow("synthetic audit failure");
    expect(await client.lot.count({ where: { tenantId: a.tenantId } })).toBe(0);
    expect(
      await client.inventoryMovement.count({ where: { tenantId: a.tenantId } }),
    ).toBe(0);
    expect(
      await client.inventoryBalance.count({ where: { tenantId: a.tenantId } }),
    ).toBe(0);
  });

  it("creates a lot, initial receipt and balance atomically", async () => {
    const a = await seed("A");
    const productId = await productFor(a.tenantId);
    const lots = new LotsController(new LotReceiptService(prisma));
    const response = (await lots.createLotReceipt(
      a.context,
      productId,
      {
        receivedAt: "2026-07-01T12:00:00.000Z",
        expiresAt: "2027-07-01",
        initialQuantity: 10,
        unitCost: 4.5,
        reason: "Ingreso inicial",
      },
      "00000000-0000-4000-8000-000000004101",
    )) as { data: Record<string, unknown> };
    expect(response.data).toMatchObject({
      productId,
      initialQuantity: 10,
      availableQuantity: 10,
      unitCost: 4.5,
    });
    expect(
      await client.inventoryMovement.count({
        where: { tenantId: a.tenantId, type: "RECEIPT" },
      }),
    ).toBe(1);
    expect(
      await client.inventoryBalance.count({
        where: { tenantId: a.tenantId, productId },
      }),
    ).toBe(1);
    expect(
      await client.auditEvent.count({
        where: { tenantId: a.tenantId, action: "LOT_RECEIPT_CREATED" },
      }),
    ).toBe(1);
    await expect(
      lots.createLotReceipt(
        a.context,
        productId,
        {
          receivedAt: "2026-07-01T12:00:00.000Z",
          expiresAt: "2027-07-01",
          initialQuantity: 10,
          unitCost: 4.5,
          reason: "Ingreso inicial",
        },
        "00000000-0000-4000-8000-000000004101",
      ),
    ).resolves.toMatchObject({ data: { id: response.data["id"] } });
    await expect(
      lots.createLotReceipt(
        a.context,
        productId,
        {
          receivedAt: "2026-07-01T12:00:00.000Z",
          expiresAt: "2027-07-01",
          initialQuantity: 10,
          unitCost: 5,
        },
        "00000000-0000-4000-8000-000000004101",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("applies positive, negative and waste movements without allowing negative stock", async () => {
    const a = await seed("A");
    const productId = await productFor(a.tenantId);
    const lots = new LotsController(new LotReceiptService(prisma));
    const receipt = (await lots.createLotReceipt(
      a.context,
      productId,
      {
        receivedAt: "2026-07-01T12:00:00.000Z",
        expiresAt: "2027-07-01",
        initialQuantity: 20,
        unitCost: 2,
      },
      "00000000-0000-4000-8000-000000004102",
    )) as { data: { id: string } };
    const inventory = new InventoryController(
      new InventoryMovementService(prisma),
      new InventoryBalanceService(prisma),
    );
    await inventory.createMovement(
      a.context,
      {
        productId,
        lotId: receipt.data.id,
        type: "NEGATIVE_ADJUSTMENT",
        quantity: 3,
        reason: "Corrección",
      },
      "00000000-0000-4000-8000-000000004103",
    );
    await inventory.createMovement(
      a.context,
      {
        productId,
        lotId: receipt.data.id,
        type: "POSITIVE_ADJUSTMENT",
        quantity: 2,
        reason: "Conteo positivo",
      },
      "00000000-0000-4000-8000-000000004104",
    );
    await inventory.createMovement(
      a.context,
      {
        productId,
        lotId: receipt.data.id,
        type: "WASTE",
        quantity: 2,
        reason: "Merma",
      },
      "00000000-0000-4000-8000-000000004105",
    );
    const balance = (await inventory.listBalances(a.context, {
      productId,
    })) as { items: readonly Record<string, unknown>[] };
    expect(balance.items[0]?.["availableQuantity"]).toBe(17);
    await expect(
      inventory.createMovement(
        a.context,
        {
          productId,
          lotId: receipt.data.id,
          type: "NEGATIVE_ADJUSTMENT",
          quantity: 18,
          reason: "Exceso",
        },
        "00000000-0000-4000-8000-000000004106",
      ),
    ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
    expect(
      await client.inventoryMovement.count({ where: { tenantId: a.tenantId } }),
    ).toBe(4);
    expect(
      await client.auditEvent.count({
        where: {
          tenantId: a.tenantId,
          action: "INVENTORY_MOVEMENT_CREATED",
        },
      }),
    ).toBe(3);
  });

  it("hides unitCost for seller and prevents Tenant A from enumerating Tenant B", async () => {
    const a = await seed("A");
    const b = await seed("B");
    const productB = await productFor(b.tenantId);
    const lots = new LotsController(new LotReceiptService(prisma));
    const receipt = (await lots.createLotReceipt(
      b.context,
      productB,
      {
        receivedAt: "2026-07-01T12:00:00.000Z",
        expiresAt: "2027-07-01",
        initialQuantity: 3,
        unitCost: 9,
      },
      "00000000-0000-4000-8000-000000004107",
    )) as { data: { id: string; unitCost: number } };
    const sellerB = (await lots.getLot(b.seller, receipt.data.id)) as {
      data: Record<string, unknown>;
    };
    expect(sellerB.data).not.toHaveProperty("unitCost");
    await expect(lots.getLot(a.context, receipt.data.id)).rejects.toMatchObject(
      { code: "RESOURCE_NOT_FOUND" },
    );
    await expect(
      lots.listTenantLots(a.context, { productId: productB }),
    ).resolves.toMatchObject({ items: [] });
  });
});
