import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { CategoryRepository } from "../../src/modules/catalog/repositories/category.repository.js";
import { ProductRepository } from "../../src/modules/catalog/repositories/product.repository.js";
import { UnitRepository } from "../../src/modules/catalog/repositories/unit.repository.js";
import { LotRepository } from "../../src/modules/lots/repositories/lot.repository.js";
import { InventoryTransactionRepository } from "../../src/modules/inventory/repositories/inventory-transaction.repository.js";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;
let prisma: PrismaModule;

function requireLocalDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("Product persistence tests require DATABASE_URL.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !(url.hostname === "localhost" || url.hostname === "127.0.0.1") ||
    database !== "bodegia_test"
  ) {
    throw new Error("Product persistence tests only allow local bodegia_test.");
  }
  return value;
}

async function clearData(): Promise<void> {
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "InventoryBalance", "InventoryMovement", "Lot", "Product",
      "UnitOfMeasure", "ProductCategory", "RefreshCredential", "Session",
      "ActivationManualAlias", "ActivationChallenge", "DeviceProfile", "Device",
      "AuditEvent", "IdempotencyRecord", "MembershipRole", "RolePermission",
      "Permission", "Role", "Membership", "Tenant", "User"
    RESTART IDENTITY CASCADE
  `);
}

async function tenant(suffix: "A" | "B"): Promise<{
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly context: TenantContext;
}> {
  const tenantId =
    suffix === "A"
      ? "00000000-0000-4000-8000-000000002001"
      : "00000000-0000-4000-8000-000000002002";
  const userId =
    suffix === "A"
      ? "00000000-0000-4000-8000-000000002011"
      : "00000000-0000-4000-8000-000000002012";
  const membershipId =
    suffix === "A"
      ? "00000000-0000-4000-8000-000000002021"
      : "00000000-0000-4000-8000-000000002022";
  await client.tenant.create({
    data: {
      id: tenantId,
      name: `Synthetic inventory tenant ${suffix}`,
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
    },
  });
  await client.user.create({
    data: {
      id: userId,
      displayName: `Synthetic inventory owner ${suffix}`,
      phoneE164: suffix === "A" ? "+51910000201" : "+51910000202",
    },
  });
  await client.membership.create({
    data: { id: membershipId, tenantId, userId, status: "ACTIVE" },
  });
  const context = createTenantContextHarness({
    sessionId: `session-${suffix}`,
    userId,
    tenantId,
    membershipId,
    contextVersion: 1,
    roles: ["owner_admin"],
    permissions: [
      "inventory.products.read",
      "inventory.products.write",
      "inventory.lots.read",
      "inventory.lots.write",
    ],
  });
  return { tenantId, userId, membershipId, context };
}

beforeAll(async () => {
  const url = requireLocalDatabase(databaseUrl);
  client = new PrismaClient({ datasources: { db: { url } } });
  prisma = new PrismaModule(client);
  const rows = await client.$queryRaw<
    Array<{
      readonly database: string;
      readonly user: string;
      readonly version: string;
    }>
  >`SELECT current_database() AS database, current_user AS user, current_setting('server_version') AS version`;
  const row = rows[0];
  expect(row).toBeDefined();
  if (row === undefined) throw new Error("PostgreSQL identity row is missing.");
  expect(row.database).toBe("bodegia_test");
  expect(row.user).toBe("bodegia_test");
  expect(row.version).toMatch(/^16\.14\b/u);
});
beforeEach(clearData);
afterAll(async () => {
  await clearData();
  await client.$disconnect();
});

describe("product, category, unit and lot persistence [T010, T014, T021, T024, T025]", () => {
  it("keeps uniqueness tenant-scoped and permits equivalent catalogs in A and B", async () => {
    const a = await tenant("A");
    const b = await tenant("B");
    const categories = new CategoryRepository(prisma);
    const units = new UnitRepository(prisma);
    const categoryA = await categories.create(a.context, {
      name: "Abarrotes",
      normalizedName: "abarrotes",
    });
    const categoryB = await categories.create(b.context, {
      name: "Abarrotes",
      normalizedName: "abarrotes",
    });
    expect(categoryA.tenantId).toBe(a.tenantId);
    expect(categoryB.tenantId).toBe(b.tenantId);
    await expect(
      categories.create(a.context, {
        name: "Abarrotes duplicado",
        normalizedName: "abarrotes",
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    const unitA = await units.create(a.context, {
      code: "KG",
      name: "Kilogramo",
      normalizedName: "kilogramo",
    });
    const unitB = await units.create(b.context, {
      code: "KG",
      name: "Kilogramo",
      normalizedName: "kilogramo",
    });
    expect(unitA.tenantId).toBe(a.tenantId);
    expect(unitB.tenantId).toBe(b.tenantId);
  });

  it("rejects cross-tenant category, unit and product relationships", async () => {
    const a = await tenant("A");
    const b = await tenant("B");
    const categories = new CategoryRepository(prisma);
    const units = new UnitRepository(prisma);
    const products = new ProductRepository(prisma);
    const categoryB = await categories.create(b.context, {
      name: "Bebidas",
      normalizedName: "bebidas",
    });
    const unitB = await units.create(b.context, {
      code: "UN",
      name: "Unidad",
      normalizedName: "unidad",
    });
    await expect(
      products.create(a.context, {
        name: "Producto cruzado",
        normalizedName: "producto cruzado",
        categoryId: categoryB.id,
        unitOfMeasureId: unitB.id,
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("prevents cross-tenant reads and updates through repositories", async () => {
    const a = await tenant("A");
    const b = await tenant("B");
    const categories = new CategoryRepository(prisma);
    const units = new UnitRepository(prisma);
    const products = new ProductRepository(prisma);
    const categoryB = await categories.create(b.context, {
      name: "Limpieza",
      normalizedName: "limpieza",
    });
    const unitB = await units.create(b.context, {
      code: "LT",
      name: "Litro",
      normalizedName: "litro",
    });
    const productB = await products.create(b.context, {
      name: "Producto B",
      normalizedName: "producto b",
      categoryId: categoryB.id,
      unitOfMeasureId: unitB.id,
      sku: "SKU-B",
    });
    await expect(
      products.findById(a.context, productB.id),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(await products.list(a.context)).toHaveLength(0);
    await expect(
      products.updateById(a.context, productB.id, { name: "Intento A" }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(
      products.findById(b.context, productB.id),
    ).resolves.toMatchObject({ name: "Producto B", tenantId: b.tenantId });
  });

  it("requires a product for every lot and rejects negative quantities", async () => {
    const a = await tenant("A");
    const categories = new CategoryRepository(prisma);
    const units = new UnitRepository(prisma);
    const products = new ProductRepository(prisma);
    const lots = new LotRepository(prisma);
    const category = await categories.create(a.context, {
      name: "Alimentos",
      normalizedName: "alimentos",
    });
    const unit = await units.create(a.context, {
      code: "UN",
      name: "Unidad",
      normalizedName: "unidad",
    });
    const product = await products.create(a.context, {
      name: "Arroz",
      normalizedName: "arroz",
      categoryId: category.id,
      unitOfMeasureId: unit.id,
    });
    await expect(
      lots.create(a.context, {
        productId: "00000000-0000-4000-8000-000000009999",
        receivedAt: new Date("2026-01-01T00:00:00Z"),
        expiresAt: new Date("2027-01-01T00:00:00Z"),
        initialQuantity: 1,
        unitCost: 1,
        createdBy: a.userId,
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      lots.create(a.context, {
        productId: product.id,
        receivedAt: new Date("2026-01-01T00:00:00Z"),
        expiresAt: new Date("2027-01-01T00:00:00Z"),
        initialQuantity: -1,
        unitCost: 1,
        createdBy: a.userId,
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("Lot_quantities_non_negative_check"),
    );
  });

  it("runs inventory persistence work inside a typed tenant transaction", async () => {
    const a = await tenant("A");
    const transactions = new InventoryTransactionRepository(prisma);
    await expect(
      transactions.transaction(a.context, async (transaction) => {
        await transaction.productCategory.create({
          data: {
            tenantId: a.tenantId,
            name: "Rollback",
            normalizedName: "rollback",
          },
        });
        throw new Error("synthetic rollback");
      }),
    ).rejects.toThrow("synthetic rollback");
    await expect(
      client.productCategory.findUnique({
        where: {
          tenantId_normalizedName: {
            tenantId: a.tenantId,
            normalizedName: "rollback",
          },
        },
      }),
    ).resolves.toBeNull();
  });
});
