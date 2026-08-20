import { PrismaClient } from "@prisma/client";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../../src/http/main.js";
import { requireLocalInventoryDatabase } from "../setup/inventory-test-environment.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
const ownerUserId = "00000000-0000-4000-8000-000000000011";
const ownerMembershipId = "00000000-0000-4000-8000-000000000101";
const missingSaleId = "00000000-0000-4000-8000-000000009902";

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
  options: RequestInit = {},
): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Session": "demo-web-session-owner_admin",
      ...options.headers,
    },
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.json(),
  };
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
}

beforeAll(async () => {
  client = new PrismaClient({
    datasources: {
      db: { url: requireLocalInventoryDatabase() },
    },
  });
  await seedAuthorizedContext();
  server = createApiServer();
  baseUrl = await listen(server);
});

afterAll(async () => {
  await client.$disconnect();
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
});

describe("web quick-sales HTTP boundary wiring", () => {
  it("mounts GET /products as the quick-sale summary", async () => {
    const result = await request("/tenants/current/products");
    const body = assertSafeJson(result);

    expect(result.status).toBe(200);
    expect(body["data"]).toEqual(expect.any(Array));
  });

  it("mounts GET /sales as a safe list", async () => {
    const result = await request("/tenants/current/sales");
    const body = assertSafeJson(result);

    expect(result.status).toBe(200);
    expect(body["data"]).toEqual(expect.any(Array));
  });

  it("mounts POST /sales and returns a safe validation error", async () => {
    const result = await request("/tenants/current/sales", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
    });
    const body = assertSafeJson(result);

    expect(result.status).toBe(400);
    expect(record(body["error"])["code"]).toBe("VALIDATION_ERROR");
  });

  it("mounts GET /sales/{saleId} and returns a safe missing-resource error", async () => {
    const result = await request(`/tenants/current/sales/${missingSaleId}`);
    const body = assertSafeJson(result);

    expect(result.status).toBe(404);
    expect(record(body["error"])["code"]).toBe("RESOURCE_NOT_FOUND");
  });

  it("requires a demo session for protected sales reads", async () => {
    const result = await request("/tenants/current/sales", {
      headers: { "X-Demo-Session": "invalid-session" },
    });
    const body = assertSafeJson(result);

    expect(result.status).toBe(401);
    expect(record(body["error"])["code"]).toBe("SESSION_INVALID");
  });
});

const biArrayRoutes = [
  "/tenants/current/bi/stock-by-category",
  "/tenants/current/bi/expiration-risk",
  "/tenants/current/bi/movement-summary",
  "/tenants/current/bi/alerts-summary",
] as const;

describe("web inventory BI HTTP boundary wiring", () => {
  it("mounts GET inventory-summary with the minimal summary shape", async () => {
    const result = await request(
      "/tenants/current/bi/inventory-summary",
    );
    const body = assertSafeJson(result);
    const data = record(body["data"]);

    expect(result.status).toBe(200);
    for (const field of [
      "totalProducts",
      "totalStockAvailable",
      "lowStockProducts",
      "productsExpiringSoon",
      "productsExpired",
      "activeAlerts",
    ]) {
      expect(typeof data[field]).toBe("number");
    }
  });

  it.each(biArrayRoutes)("mounts GET %s with an array payload", async (path) => {
    const result = await request(path);
    const body = assertSafeJson(result);

    expect(result.status).toBe(200);
    expect(body["data"]).toEqual(expect.any(Array));
  });

  it("rejects a non-GET BI method with a safe error", async () => {
    const result = await request("/tenants/current/bi/inventory-summary", {
      method: "POST",
      body: "{}",
    });
    const body = assertSafeJson(result);

    expect(result.status).toBe(404);
    expect(record(body["error"])["code"]).toBe("RESOURCE_NOT_FOUND");
  });
});
