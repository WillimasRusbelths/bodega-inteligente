import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { CatalogController } from "../../src/modules/catalog/catalog.controller.js";

const databaseUrl = process.env["DATABASE_URL"];
let client: PrismaClient;
let prisma: PrismaModule;

function localDatabase(value: string | undefined): string {
  if (value === undefined)
    throw new Error("Product catalog integration requires DATABASE_URL.");
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

async function seedTenant(suffix: "A" | "B"): Promise<{
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly owner: TenantContext;
  readonly seller: TenantContext;
}> {
  const ids =
    suffix === "A"
      ? {
          tenantId: "00000000-0000-4000-8000-000000003001",
          userId: "00000000-0000-4000-8000-000000003011",
          membershipId: "00000000-0000-4000-8000-000000003021",
        }
      : {
          tenantId: "00000000-0000-4000-8000-000000003002",
          userId: "00000000-0000-4000-8000-000000003012",
          membershipId: "00000000-0000-4000-8000-000000003022",
        };
  await client.tenant.create({
    data: {
      id: ids.tenantId,
      name: `Synthetic catalog ${suffix}`,
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
    },
  });
  await client.user.create({
    data: {
      id: ids.userId,
      displayName: `Synthetic catalog owner ${suffix}`,
      phoneE164: suffix === "A" ? "+51920000301" : "+51920000302",
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
    sessionId: `session-${suffix}`,
    userId: ids.userId,
    tenantId: ids.tenantId,
    membershipId: ids.membershipId,
    contextVersion: 1,
  };
  const owner = createTenantContextHarness({
    ...base,
    roles: ["owner_admin"],
    permissions: ["inventory.products.read", "inventory.products.write"],
  });
  const seller = createTenantContextHarness({
    ...base,
    roles: ["seller"],
    permissions: ["inventory.products.read"],
  });
  return { ...ids, owner, seller };
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

describe("product catalog API [T022, T023, T026-T029]", () => {
  it("creates categories, units and products and writes sanitized audit events", async () => {
    const a = await seedTenant("A");
    const controller = new CatalogController(prisma);
    const category = (await controller.createCategory(
      a.owner,
      { name: "Abarrotes" },
      "catalog-key-000001",
    )) as { data: { id: string; version: number } };
    const unit = (await controller.createUnit(
      a.owner,
      { code: "UN", name: "Unidad", quantityScale: 0 },
      "catalog-key-000002",
    )) as { data: { id: string } };
    const product = (await controller.createProduct(
      a.owner,
      {
        name: "Arroz",
        categoryId: category.data.id,
        unitOfMeasureId: unit.data.id,
      },
      "catalog-key-000003",
    )) as { data: { id: string; status: string } };
    expect(product.data.status).toBe("ACTIVE");
    const page = (await controller.listProducts(a.owner, { limit: "1" })) as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: string | null;
    };
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    const audits = await client.auditEvent.findMany({
      where: { tenantId: a.tenantId },
      orderBy: { occurredAt: "asc" },
    });
    expect(audits.map(({ action }) => action)).toEqual([
      "CATEGORY_CREATED",
      "UNIT_CREATED",
      "PRODUCT_CREATED",
    ]);
    expect(JSON.stringify(audits)).not.toContain("unitCost");
  });

  it("keeps PATCH partial and uses If-Match optimistic concurrency", async () => {
    const a = await seedTenant("A");
    const controller = new CatalogController(prisma);
    const unit = (await controller.createUnit(
      a.owner,
      { code: "KG", name: "Kilogramo", quantityScale: 3 },
      "catalog-key-000004",
    )) as { data: { id: string } };
    const created = (await controller.createProduct(
      a.owner,
      {
        name: "Harina",
        sku: "SKU-H",
        unitOfMeasureId: unit.data.id,
        minimumStock: 2,
      },
      "catalog-key-000005",
    )) as { data: { id: string; version: number } };
    const updated = (await controller.updateProduct(
      a.owner,
      created.data.id,
      '"1"',
      { name: "Harina integral" },
      "catalog-key-000006",
    )) as {
      data: {
        name: string;
        sku: string;
        minimumStock: number;
        version: number;
      };
    };
    expect(updated.data).toMatchObject({
      name: "Harina integral",
      sku: "SKU-H",
      minimumStock: 2,
      version: 2,
    });
    const disabled = (await controller.updateProduct(
      a.owner,
      created.data.id,
      '"2"',
      { status: "INACTIVE" },
      "catalog-key-000014",
    )) as { data: { status: string; version: number } };
    expect(disabled.data).toMatchObject({ status: "INACTIVE", version: 3 });
    await expect(
      controller.updateProduct(
        a.owner,
        created.data.id,
        '"1"',
        { name: "Stale" },
        "catalog-key-000007",
      ),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
  });

  it("allows seller reads but rejects writes and never crosses Tenant A/B", async () => {
    const a = await seedTenant("A");
    const b = await seedTenant("B");
    const controller = new CatalogController(prisma);
    const unitB = (await controller.createUnit(
      b.owner,
      { code: "UN", name: "Unidad", quantityScale: 0 },
      "catalog-key-000008",
    )) as { data: { id: string } };
    const productB = (await controller.createProduct(
      b.owner,
      { name: "Producto B", unitOfMeasureId: unitB.data.id },
      "catalog-key-000009",
    )) as { data: { id: string } };
    await expect(
      controller.getProduct(a.owner, productB.data.id),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    const visible = (await controller.listProducts(b.seller, {})) as {
      items: readonly Record<string, unknown>[];
    };
    expect(visible.items).toHaveLength(1);
    expect(JSON.stringify(visible.items[0])).not.toMatch(/cost|unitCost/iu);
    await expect(
      controller.createCategory(
        a.seller,
        { name: "No autorizado" },
        "catalog-key-000010",
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_PERMISSION" });
    await expect(
      controller.createProduct(
        a.owner,
        {
          tenantId: b.tenantId,
          name: "Body cross tenant",
          unitOfMeasureId: unitB.data.id,
        },
        "catalog-key-000011",
      ),
    ).rejects.toThrow();
  });

  it("rejects unknown fields and invalid status payloads", async () => {
    const a = await seedTenant("A");
    const controller = new CatalogController(prisma);
    await expect(
      controller.createCategory(
        a.owner,
        { name: "OK", tenantId: a.tenantId },
        "catalog-key-000012",
      ),
    ).rejects.toThrow();
    await expect(
      controller.setCategoryStatus(
        a.owner,
        "00000000-0000-4000-8000-000000009999",
        '"1"',
        { status: "BROKEN" },
      ),
    ).rejects.toThrow();
  });

  it("replays an idempotent create and rejects a changed payload", async () => {
    const a = await seedTenant("A");
    const controller = new CatalogController(prisma);
    const first = await controller.createCategory(
      a.owner,
      { name: "Bebidas" },
      "catalog-key-000013",
    );
    const replay = await controller.createCategory(
      a.owner,
      { name: "Bebidas" },
      "catalog-key-000013",
    );
    expect(replay).toEqual(first);
    await expect(
      controller.createCategory(
        a.owner,
        { name: "Otra" },
        "catalog-key-000013",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
