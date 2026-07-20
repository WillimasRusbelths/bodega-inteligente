import { PrismaClient } from "@prisma/client";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiServer } from "../../src/http/main.js";

const databaseUrl = process.env["DATABASE_URL"];
const tenantId = "00000000-0000-4000-8000-000000000001";
const otherTenantId = "00000000-0000-4000-8000-000000000901";
const ownerUserId = "00000000-0000-4000-8000-000000000011";
const sellerUserId = "00000000-0000-4000-8000-000000000013";
const ownerMembershipId = "00000000-0000-4000-8000-000000000101";
const sellerMembershipId = "00000000-0000-4000-8000-000000000103";
const categoryId = "00000000-0000-4000-8000-000000000921";
const unitId = "00000000-0000-4000-8000-000000000922";
const productId = "00000000-0000-4000-8000-000000000923";
const lotSoonId = "00000000-0000-4000-8000-000000000924";
const lotLaterId = "00000000-0000-4000-8000-000000000925";
const otherProductId = "00000000-0000-4000-8000-000000000926";
const otherCategoryId = "00000000-0000-4000-8000-000000000927";
const otherUnitId = "00000000-0000-4000-8000-000000000928";

let client: PrismaClient;
let server: Server;
let baseUrl: string;

interface HttpResult {
  readonly status: number;
  readonly body: unknown;
}

function assertLocalDatabase(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("quick-sales requires DATABASE_URL.");
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    database !== "bodegia_test"
  ) {
    throw new Error("quick-sales refuses non-local test databases.");
  }
  return value;
}

function listen(apiServer: Server): Promise<string> {
  return new Promise((resolveListening) => {
    apiServer.listen(0, "127.0.0.1", () => {
      const address = apiServer.address();
      if (address === null || typeof address === "string") {
        throw new Error("Unexpected HTTP test address.");
      }
      resolveListening(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function request(
  path: string,
  options?: RequestInit,
): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return { status: response.status, body: await response.json() };
}

async function cleanup(): Promise<void> {
  await client.saleItem.deleteMany({
    where: { tenantId: { in: [tenantId, otherTenantId] } },
  });
  await client.sale.deleteMany({
    where: { tenantId: { in: [tenantId, otherTenantId] } },
  });
  await client.inventoryMovement.deleteMany({
    where: {
      OR: [
        { productId },
        { productId: otherProductId },
        { reason: { startsWith: "Venta rapida" } },
      ],
    },
  });
  await client.inventoryBalance.deleteMany({
    where: { productId: { in: [productId, otherProductId] } },
  });
  await client.lot.deleteMany({
    where: { id: { in: [lotSoonId, lotLaterId] } },
  });
  await client.product.deleteMany({
    where: { id: { in: [productId, otherProductId] } },
  });
  await client.unitOfMeasure.deleteMany({
    where: { id: { in: [unitId, otherUnitId] } },
  });
  await client.productCategory.deleteMany({
    where: { id: { in: [categoryId, otherCategoryId] } },
  });
  await client.membership.deleteMany({
    where: { tenantId: otherTenantId },
  });
  await client.tenant.deleteMany({
    where: { id: otherTenantId },
  });
}

async function seedBaseAccess(): Promise<void> {
  await client.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: "Bodega San Cristobal",
      status: "ACTIVE",
      currencyCode: "PEN",
    },
    create: {
      id: tenantId,
      name: "Bodega San Cristobal",
      status: "ACTIVE",
      createdByTechnicalAdminId: ownerUserId,
      operatingTimeZone: "America/Lima",
      currencyCode: "PEN",
    },
  });
  await client.tenant.create({
    data: {
      id: otherTenantId,
      name: "Bodega ajena",
      status: "ACTIVE",
      createdByTechnicalAdminId: ownerUserId,
      operatingTimeZone: "America/Lima",
      currencyCode: "PEN",
    },
  });
  for (const user of [
    {
      id: ownerUserId,
      displayName: "Propietario demo",
      phoneE164: "+51900000001",
    },
    {
      id: sellerUserId,
      displayName: "Vendedor demo",
      phoneE164: "+51900000003",
    },
  ]) {
    await client.user.upsert({
      where: { id: user.id },
      update: { displayName: user.displayName, status: "ACTIVE" },
      create: { ...user, status: "ACTIVE" },
    });
  }
  for (const membership of [
    { id: ownerMembershipId, userId: ownerUserId },
    { id: sellerMembershipId, userId: sellerUserId },
  ]) {
    await client.membership.upsert({
      where: { id: membership.id },
      update: { tenantId, userId: membership.userId, status: "ACTIVE" },
      create: {
        id: membership.id,
        tenantId,
        userId: membership.userId,
        status: "ACTIVE",
        joinedAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    });
  }
}

async function seedInventory(): Promise<void> {
  await client.productCategory.createMany({
    data: [
      {
        id: categoryId,
        tenantId,
        name: "Ventas demo",
        normalizedName: "ventas demo",
      },
      {
        id: otherCategoryId,
        tenantId: otherTenantId,
        name: "Ajena",
        normalizedName: "ajena",
      },
    ],
  });
  await client.unitOfMeasure.createMany({
    data: [
      {
        id: unitId,
        tenantId,
        code: "unidad-test",
        name: "Unidad test",
        normalizedName: "unidad test",
      },
      {
        id: otherUnitId,
        tenantId: otherTenantId,
        code: "unidad-ajena",
        name: "Unidad ajena",
        normalizedName: "unidad ajena",
      },
    ],
  });
  await client.product.createMany({
    data: [
      {
        id: productId,
        tenantId,
        name: "Producto venta FEFO",
        normalizedName: "producto venta fefo",
        sku: "SALE-FEFO",
        categoryId,
        unitOfMeasureId: unitId,
        minimumStock: 2,
        expiryAlertDays: 10,
        salePrice: 3.5,
        status: "ACTIVE",
      },
      {
        id: otherProductId,
        tenantId: otherTenantId,
        name: "Producto ajeno",
        normalizedName: "producto ajeno",
        sku: "OTHER-SALE",
        categoryId: otherCategoryId,
        unitOfMeasureId: otherUnitId,
        minimumStock: 1,
        expiryAlertDays: 10,
        salePrice: 9,
        status: "ACTIVE",
      },
    ],
  });
  await client.lot.createMany({
    data: [
      {
        id: lotSoonId,
        tenantId,
        productId,
        receivedAt: new Date("2026-07-01T10:00:00.000Z"),
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        initialQuantity: 5,
        availableQuantity: 5,
        unitCost: 1,
        status: "AVAILABLE",
        createdBy: ownerUserId,
      },
      {
        id: lotLaterId,
        tenantId,
        productId,
        receivedAt: new Date("2026-07-02T10:00:00.000Z"),
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        initialQuantity: 10,
        availableQuantity: 10,
        unitCost: 1.2,
        status: "AVAILABLE",
        createdBy: ownerUserId,
      },
    ],
  });
  await client.inventoryBalance.createMany({
    data: [
      {
        tenantId,
        productId,
        lotId: lotSoonId,
        availableQuantity: 5,
      },
      {
        tenantId,
        productId,
        lotId: lotLaterId,
        availableQuantity: 10,
      },
    ],
  });
}

beforeAll(async () => {
  client = new PrismaClient({
    datasources: { db: { url: assertLocalDatabase(databaseUrl) } },
  });
  server = createApiServer();
  baseUrl = await listen(server);
});

beforeEach(async () => {
  await cleanup();
  await seedBaseAccess();
  await seedInventory();
});

afterAll(async () => {
  await cleanup();
  await client.$disconnect();
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
});

describe("quick sales MVP integration", () => {
  it("registers a sale, consumes FEFO lots, discounts stock and creates SALE_OUT movements", async () => {
    const result = await request("/tenants/current/sales", {
      method: "POST",
      headers: { "X-Demo-Session": "demo-web-session-seller" },
      body: JSON.stringify({
        items: [{ productId, quantity: 7, unitPrice: 3.5 }],
      }),
    });

    expect(result.status).toBe(201);
    expect(JSON.stringify(result.body)).toContain("Producto venta FEFO");
    expect(JSON.stringify(result.body)).toContain(lotSoonId);
    expect(JSON.stringify(result.body)).toContain(lotLaterId);
    expect(JSON.stringify(result.body)).not.toMatch(/unitCost|valuation/iu);

    const [soon, later, movements, sales] = await Promise.all([
      client.lot.findUniqueOrThrow({ where: { id: lotSoonId } }),
      client.lot.findUniqueOrThrow({ where: { id: lotLaterId } }),
      client.inventoryMovement.findMany({
        where: { tenantId, productId, type: "SALE_OUT" },
        orderBy: { createdAt: "asc" },
      }),
      client.sale.findMany({
        where: { tenantId },
        include: { items: true },
      }),
    ]);
    expect(Number(soon.availableQuantity)).toBe(0);
    expect(soon.status).toBe("DEPLETED");
    expect(Number(later.availableQuantity)).toBe(8);
    expect(movements).toHaveLength(2);
    expect(movements.map((movement) => movement.lotId)).toEqual([
      lotSoonId,
      lotLaterId,
    ]);
    expect(sales).toHaveLength(1);
    expect(sales[0]?.items).toHaveLength(2);
  });

  it("lists sales history after a successful sale", async () => {
    await request("/tenants/current/sales", {
      method: "POST",
      headers: { "X-Demo-Session": "demo-web-session-owner_admin" },
      body: JSON.stringify({
        items: [{ productId, quantity: 2, unitPrice: 4 }],
      }),
    });

    const history = await request("/tenants/current/sales", {
      headers: { "X-Demo-Session": "demo-web-session-owner_admin" },
    });

    expect(history.status).toBe(200);
    expect(JSON.stringify(history.body)).toContain("Producto venta FEFO");
    expect(JSON.stringify(history.body)).toContain("COMPLETED");
    expect(JSON.stringify(history.body)).not.toMatch(/unitCost|cost/iu);
  });

  it("rejects insufficient stock and leaves balances untouched", async () => {
    const result = await request("/tenants/current/sales", {
      method: "POST",
      headers: { "X-Demo-Session": "demo-web-session-seller" },
      body: JSON.stringify({
        items: [{ productId, quantity: 99, unitPrice: 3.5 }],
      }),
    });

    const balances = await client.inventoryBalance.findMany({
      where: { tenantId, productId },
      orderBy: { lotId: "asc" },
    });
    expect(result.status).toBe(409);
    expect(JSON.stringify(result.body)).toContain("STOCK_INSUFFICIENT");
    expect(
      balances.map((balance) => Number(balance.availableQuantity)),
    ).toEqual([5, 10]);
    expect(await client.sale.count({ where: { tenantId } })).toBe(0);
  });

  it("does not allow selling a product from another tenant", async () => {
    const result = await request("/tenants/current/sales", {
      method: "POST",
      headers: { "X-Demo-Session": "demo-web-session-owner_admin" },
      body: JSON.stringify({
        items: [{ productId: otherProductId, quantity: 1, unitPrice: 9 }],
      }),
    });

    expect(result.status).toBe(404);
    expect(JSON.stringify(result.body)).toContain("RESOURCE_NOT_FOUND");
    expect(
      await client.sale.count({ where: { tenantId: otherTenantId } }),
    ).toBe(0);
  });
});
