import { PrismaClient } from "@prisma/client";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../../src/http/main.js";

const databaseUrl = process.env["DATABASE_URL"];
const tenantAId = "00000000-0000-4000-8000-000000000001";
const tenantBId = "00000000-0000-4000-8000-000000000941";
const ownerUserId = "00000000-0000-4000-8000-000000000011";
const sellerUserId = "00000000-0000-4000-8000-000000000013";
const sellerMembershipId = "00000000-0000-4000-8000-000000000103";
const categoryBId = "00000000-0000-4000-8000-000000000942";
const unitBId = "00000000-0000-4000-8000-000000000943";
const productBId = "00000000-0000-4000-8000-000000000944";
const productBName = "Producto privado Tenant B";

let client: PrismaClient;
let server: Server;
let baseUrl: string;

interface HttpResult {
  readonly status: number;
  readonly body: unknown;
}

function assertLocalDatabase(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("web-stabilization-authorization requires DATABASE_URL.");
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    database !== "bodegia_test"
  ) {
    throw new Error(
      "web-stabilization-authorization refuses non-local test databases.",
    );
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

async function cleanupTenantB(): Promise<void> {
  await client.product.deleteMany({ where: { id: productBId } });
  await client.unitOfMeasure.deleteMany({ where: { id: unitBId } });
  await client.productCategory.deleteMany({ where: { id: categoryBId } });
  await client.tenant.deleteMany({ where: { id: tenantBId } });
}

async function seedAuthorizationBoundary(): Promise<void> {
  await cleanupTenantB();
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
  await client.tenant.upsert({
    where: { id: tenantAId },
    update: { status: "ACTIVE" },
    create: {
      id: tenantAId,
      name: "Bodega San Cristobal",
      status: "ACTIVE",
      createdByTechnicalAdminId: ownerUserId,
      operatingTimeZone: "America/Lima",
      currencyCode: "PEN",
    },
  });
  await client.membership.upsert({
    where: { id: sellerMembershipId },
    update: {
      tenantId: tenantAId,
      userId: sellerUserId,
      status: "ACTIVE",
    },
    create: {
      id: sellerMembershipId,
      tenantId: tenantAId,
      userId: sellerUserId,
      status: "ACTIVE",
      joinedAt: new Date("2026-07-20T12:00:00.000Z"),
    },
  });
  await client.tenant.create({
    data: {
      id: tenantBId,
      name: "Tenant B privado",
      status: "ACTIVE",
      createdByTechnicalAdminId: ownerUserId,
      operatingTimeZone: "America/Lima",
      currencyCode: "PEN",
    },
  });
  await client.productCategory.create({
    data: {
      id: categoryBId,
      tenantId: tenantBId,
      name: "Categoria Tenant B",
      normalizedName: "categoria tenant b",
    },
  });
  await client.unitOfMeasure.create({
    data: {
      id: unitBId,
      tenantId: tenantBId,
      code: "unidad-tenant-b",
      name: "Unidad Tenant B",
      normalizedName: "unidad tenant b",
    },
  });
  await client.product.create({
    data: {
      id: productBId,
      tenantId: tenantBId,
      name: productBName,
      normalizedName: "producto privado tenant b",
      sku: "PRIVATE-B",
      categoryId: categoryBId,
      unitOfMeasureId: unitBId,
      minimumStock: 1,
      expiryAlertDays: 10,
      salePrice: 99,
      status: "ACTIVE",
    },
  });
}

beforeAll(async () => {
  client = new PrismaClient({
    datasources: { db: { url: assertLocalDatabase(databaseUrl) } },
  });
  await seedAuthorizationBoundary();
  server = createApiServer();
  baseUrl = await listen(server);
});

afterAll(async () => {
  await cleanupTenantB();
  await client.$disconnect();
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
});

describe("web stabilization backend authorization [T041]", () => {
  it("rejects a direct seller administration request without relying on hidden UI", async () => {
    const before = await client.tenant.findUniqueOrThrow({
      where: { id: tenantAId },
      select: { name: true },
    });

    const result = await request("/tenants/current/settings", {
      method: "PATCH",
      headers: { "X-Demo-Session": "demo-web-session-seller" },
      body: JSON.stringify({ name: "Cambio sin permiso" }),
    });

    expect(result.status).toBe(403);
    expect(JSON.stringify(result.body)).toContain("INSUFFICIENT_PERMISSION");
    await expect(
      client.tenant.findUniqueOrThrow({
        where: { id: tenantAId },
        select: { name: true },
      }),
    ).resolves.toEqual(before);
  });

  it("keeps Tenant B absent from Tenant A reads and rejects a direct cross-tenant sale", async () => {
    const list = await request("/tenants/current/products", {
      headers: { "X-Demo-Session": "demo-web-session-seller" },
    });
    const salesBefore = await client.sale.count({
      where: { tenantId: tenantAId },
    });

    const mutation = await request("/tenants/current/sales", {
      method: "POST",
      headers: { "X-Demo-Session": "demo-web-session-seller" },
      body: JSON.stringify({
        items: [{ productId: productBId, quantity: 1, unitPrice: 99 }],
      }),
    });

    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(productBId);
    expect(JSON.stringify(list.body)).not.toContain(productBName);
    expect(mutation.status).toBe(404);
    expect(JSON.stringify(mutation.body)).toContain("RESOURCE_NOT_FOUND");
    expect(JSON.stringify(mutation.body)).not.toContain(productBId);
    expect(JSON.stringify(mutation.body)).not.toContain(productBName);
    expect(await client.sale.count({ where: { tenantId: tenantAId } })).toBe(
      salesBefore,
    );
    expect(await client.sale.count({ where: { tenantId: tenantBId } })).toBe(0);
  });
});
