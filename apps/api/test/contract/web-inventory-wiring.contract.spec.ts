import { PrismaClient } from "@prisma/client";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../../src/http/main.js";
import { requireLocalInventoryDatabase } from "../setup/inventory-test-environment.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
const ownerUserId = "00000000-0000-4000-8000-000000000011";
const ownerMembershipId = "00000000-0000-4000-8000-000000000101";
const sellerUserId = "00000000-0000-4000-8000-000000000013";
const sellerMembershipId = "00000000-0000-4000-8000-000000000103";
const categoryId = "00000000-0000-4000-8000-000000009911";
const unitId = "00000000-0000-4000-8000-000000009912";
const productId = "00000000-0000-4000-8000-000000009913";
const lotId = "00000000-0000-4000-8000-000000009914";

let client: PrismaClient;
let server: Server;
let baseUrl: string;

interface HttpResult {
  readonly status: number;
  readonly contentType: string | null;
  readonly body: unknown;
}

function record(value: unknown): Record<string, unknown> {
  expect(value).not.toBeNull();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

function assertSafeJson(result: HttpResult): Record<string, unknown> {
  expect(result.contentType).toContain("application/json");
  const body = record(result.body);
  expect(JSON.stringify(body)).not.toMatch(
    /password|authorization|database_url/iu,
  );
  if (result.status >= 400) {
    const error = record(body["error"]);
    expect(error["code"]).toEqual(expect.any(String));
    expect(error["message"]).toEqual(expect.any(String));
    expect(error["correlationId"]).toEqual(expect.any(String));
  }
  return body;
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
  role: "owner_admin" | "seller" = "owner_admin",
): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { "X-Demo-Session": `demo-web-session-${role}` },
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.json(),
  };
}

async function cleanupInventoryFixture(): Promise<void> {
  await client.inventoryBalance.deleteMany({ where: { lotId } });
  await client.lot.deleteMany({ where: { id: lotId } });
  await client.product.deleteMany({ where: { id: productId } });
  await client.unitOfMeasure.deleteMany({ where: { id: unitId } });
  await client.productCategory.deleteMany({ where: { id: categoryId } });
}

async function seedInventoryFixture(): Promise<void> {
  await cleanupInventoryFixture();
  await client.productCategory.create({
    data: {
      id: categoryId,
      tenantId,
      name: "Boundary inventory",
      normalizedName: "boundary inventory",
    },
  });
  await client.unitOfMeasure.create({
    data: {
      id: unitId,
      tenantId,
      code: "boundary-unit",
      name: "Boundary unit",
      normalizedName: "boundary unit",
    },
  });
  await client.product.create({
    data: {
      id: productId,
      tenantId,
      name: "Boundary operational product",
      normalizedName: "boundary operational product",
      sku: "BOUNDARY-OP",
      categoryId,
      unitOfMeasureId: unitId,
      minimumStock: 2,
      expiryAlertDays: 10,
      salePrice: 4.5,
      status: "ACTIVE",
    },
  });
  await client.lot.create({
    data: {
      id: lotId,
      tenantId,
      productId,
      receivedAt: new Date("2026-07-20T12:00:00.000Z"),
      expiresAt: new Date("2027-08-01T00:00:00.000Z"),
      initialQuantity: 7,
      availableQuantity: 7,
      unitCost: 2.25,
      status: "AVAILABLE",
      createdBy: ownerUserId,
    },
  });
  await client.inventoryBalance.create({
    data: { tenantId, productId, lotId, availableQuantity: 7 },
  });
}

async function seedAuthorizedContext(): Promise<void> {
  await client.tenant.upsert({
    where: { id: tenantId },
    update: { status: "ACTIVE" },
    create: {
      id: tenantId,
      name: "Bodega boundary local",
      status: "ACTIVE",
      createdByTechnicalAdminId: ownerUserId,
      operatingTimeZone: "America/Lima",
      currencyCode: "PEN",
    },
  });
  await client.user.upsert({
    where: { id: ownerUserId },
    update: { status: "ACTIVE" },
    create: {
      id: ownerUserId,
      displayName: "Propietario boundary",
      phoneE164: "+51900000001",
      status: "ACTIVE",
    },
  });
  await client.membership.upsert({
    where: { id: ownerMembershipId },
    update: { tenantId, userId: ownerUserId, status: "ACTIVE" },
    create: {
      id: ownerMembershipId,
      tenantId,
      userId: ownerUserId,
      status: "ACTIVE",
      joinedAt: new Date("2026-07-20T12:00:00.000Z"),
    },
  });
  await client.user.upsert({
    where: { id: sellerUserId },
    update: { status: "ACTIVE" },
    create: {
      id: sellerUserId,
      displayName: "Vendedor boundary",
      phoneE164: "+51900000003",
      status: "ACTIVE",
    },
  });
  await client.membership.upsert({
    where: { id: sellerMembershipId },
    update: { tenantId, userId: sellerUserId, status: "ACTIVE" },
    create: {
      id: sellerMembershipId,
      tenantId,
      userId: sellerUserId,
      status: "ACTIVE",
      joinedAt: new Date("2026-07-20T12:00:00.000Z"),
    },
  });
}

beforeAll(async () => {
  client = new PrismaClient({
    datasources: {
      db: { url: requireLocalInventoryDatabase() },
    },
  });
  await seedAuthorizedContext();
  await seedInventoryFixture();
  server = createApiServer();
  baseUrl = await listen(server);
});

afterAll(async () => {
  await cleanupInventoryFixture();
  await client.$disconnect();
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
});

const pagedReadRoutes = [
  ["operational products", "/tenants/current/products"],
  ["tenant lots", "/tenants/current/lots"],
  ["inventory balances", "/tenants/current/inventory/balances"],
  ["inventory movements", "/tenants/current/inventory/movements"],
  ["inventory alerts", "/tenants/current/inventory/alerts"],
] as const;

describe("web inventory HTTP boundary wiring", () => {
  it.each(pagedReadRoutes)(
    "mounts GET %s with the page shape consumed by InventoryWebApi",
    async (_name, path) => {
      const result = await request(path);
      const body = assertSafeJson(result);

      expect(result.status).toBe(200);
      expect(body["items"]).toEqual(expect.any(Array));
      expect(
        typeof body["nextCursor"] === "string" || body["nextCursor"] === null,
      ).toBe(true);
      if (path === "/tenants/current/products") {
        const item = (body["items"] as Record<string, unknown>[]).find(
          (candidate) => candidate["id"] === productId,
        );
        expect(item).toMatchObject({
          id: productId,
          name: "Boundary operational product",
          availableStock: 7,
          category: { id: categoryId, name: "Boundary inventory" },
        });
      }
    },
  );

  it("mounts GET FEFO with the direct result shape consumed by InventoryWebApi", async () => {
    const result = await request(
      `/tenants/current/inventory/fefo/suggestions?productId=${productId}&quantity=1`,
    );
    const body = assertSafeJson(result);

    expect(result.status).toBe(200);
    expect(body).toMatchObject({
      productId,
      requestedQuantity: 1,
      canFulfill: true,
      items: [
        expect.objectContaining({
          lotId,
          availableQuantity: 7,
          suggestedQuantity: 1,
        }),
      ],
    });
  });

  it("keeps seller lot and balance reads free of costs", async () => {
    const [lotsResult, balancesResult] = await Promise.all([
      request("/tenants/current/lots", "seller"),
      request("/tenants/current/inventory/balances", "seller"),
    ]);

    for (const result of [lotsResult, balancesResult]) {
      const body = assertSafeJson(result);
      expect(result.status).toBe(200);
      expect(JSON.stringify(body)).not.toMatch(/unitCost|valuation/iu);
    }
  });
});
