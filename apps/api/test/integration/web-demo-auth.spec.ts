import { PrismaClient } from "@prisma/client";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer } from "../../src/http/main.js";

const databaseUrl = process.env["DATABASE_URL"];
const tenantId = "00000000-0000-4000-8000-000000000001";
const ownerUserId = "00000000-0000-4000-8000-000000000011";
const inventoryUserId = "00000000-0000-4000-8000-000000000012";
const sellerUserId = "00000000-0000-4000-8000-000000000013";
const ownerMembershipId = "00000000-0000-4000-8000-000000000101";
const inventoryMembershipId = "00000000-0000-4000-8000-000000000102";
const sellerMembershipId = "00000000-0000-4000-8000-000000000103";

let client: PrismaClient;
let server: Server;
let baseUrl: string;

interface HttpResult {
  readonly status: number;
  readonly body: unknown;
}

function assertLocalDatabase(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("web-demo-auth requires DATABASE_URL.");
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    database !== "bodegia_test"
  ) {
    throw new Error("web-demo-auth refuses non-local test databases.");
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

async function seedDemoAccess(): Promise<void> {
  await client.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: "Bodega San Cristobal",
      status: "ACTIVE",
      locationText: "Ayacucho, Peru",
      currencyCode: "PEN",
      referenceSchedule: "Lunes a domingo, 7:00 a 22:00",
    },
    create: {
      id: tenantId,
      name: "Bodega San Cristobal",
      status: "ACTIVE",
      createdByTechnicalAdminId: "00000000-0000-4000-8000-000000000901",
      operatingTimeZone: "America/Lima",
      locationText: "Ayacucho, Peru",
      currencyCode: "PEN",
      referenceSchedule: "Lunes a domingo, 7:00 a 22:00",
    },
  });
  for (const user of [
    {
      id: ownerUserId,
      displayName: "Propietario demo",
      phoneE164: "+51900000001",
    },
    {
      id: inventoryUserId,
      displayName: "Encargado demo",
      phoneE164: "+51900000002",
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
  for (const role of [
    ["owner_admin", "Dueño administrador"],
    ["inventory_manager", "Encargado de inventario"],
    ["seller", "Vendedor"],
  ] as const) {
    await client.role.upsert({
      where: { code: role[0] },
      update: { name: role[1], catalogVersion: 2 },
      create: { code: role[0], name: role[1], catalogVersion: 2 },
    });
  }
  for (const membership of [
    {
      id: ownerMembershipId,
      userId: ownerUserId,
      role: "owner_admin",
    },
    {
      id: inventoryMembershipId,
      userId: inventoryUserId,
      role: "inventory_manager",
    },
    {
      id: sellerMembershipId,
      userId: sellerUserId,
      role: "seller",
    },
  ] as const) {
    await client.membership.upsert({
      where: { id: membership.id },
      update: { status: "ACTIVE" },
      create: {
        id: membership.id,
        tenantId,
        userId: membership.userId,
        status: "ACTIVE",
        joinedAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    });
    const role = await client.role.findUniqueOrThrow({
      where: { code: membership.role },
      select: { id: true },
    });
    await client.membershipRole.upsert({
      where: {
        tenantId_membershipId_roleId: {
          tenantId,
          membershipId: membership.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        tenantId,
        membershipId: membership.id,
        roleId: role.id,
        assignedByMembershipId: ownerMembershipId,
      },
    });
  }
}

beforeAll(async () => {
  client = new PrismaClient({
    datasources: { db: { url: assertLocalDatabase(databaseUrl) } },
  });
  await seedDemoAccess();
  server = createApiServer();
  baseUrl = await listen(server);
});

afterAll(async () => {
  await client.tenant.update({
    where: { id: tenantId },
    data: {
      name: "Bodega San Cristobal",
      locationText: "Ayacucho, Peru",
      currencyCode: "PEN",
      referenceSchedule: "Lunes a domingo, 7:00 a 22:00",
      status: "ACTIVE",
    },
  });
  await client.$disconnect();
  await new Promise<void>((resolveClosed) =>
    server.close(() => resolveClosed()),
  );
});

describe("web MVP demo authentication and tenant administration", () => {
  it("logs in with deterministic demo users and returns active tenant, user and role", async () => {
    const result = await request("/demo/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "propietario", pin: "100001" }),
    });

    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).toContain(
      "demo-web-session-owner_admin",
    );
    expect(JSON.stringify(result.body)).toContain("Bodega San Cristobal");
    expect(JSON.stringify(result.body)).toContain("owner_admin");
    expect(JSON.stringify(result.body)).not.toContain("refreshToken");
    expect(JSON.stringify(result.body)).not.toContain("accessToken");
  });

  it("lets owner_admin update tenant settings but rejects seller configuration changes", async () => {
    const owner = await request("/tenants/current/settings", {
      method: "PATCH",
      headers: { "X-Demo-Session": "demo-web-session-owner_admin" },
      body: JSON.stringify({
        name: "Bodega San Cristobal Sprint 1",
        locationText: "Ayacucho centro",
        currencyCode: "PEN",
        referenceSchedule: "Lunes a sabado, 8:00 a 21:00",
        status: "ACTIVE",
      }),
    });
    const seller = await request("/tenants/current/settings", {
      method: "PATCH",
      headers: { "X-Demo-Session": "demo-web-session-seller" },
      body: JSON.stringify({ name: "No autorizado" }),
    });

    expect(owner.status).toBe(200);
    expect(JSON.stringify(owner.body)).toContain(
      "Bodega San Cristobal Sprint 1",
    );
    expect(seller.status).toBe(403);
    expect(JSON.stringify(seller.body)).toContain("INSUFFICIENT_PERMISSION");
  });

  it("lists tenant-scoped employees only for owner_admin", async () => {
    const owner = await request("/tenants/current/memberships", {
      headers: { "X-Demo-Session": "demo-web-session-owner_admin" },
    });
    const seller = await request("/tenants/current/memberships", {
      headers: { "X-Demo-Session": "demo-web-session-seller" },
    });

    expect(owner.status).toBe(200);
    expect(JSON.stringify(owner.body)).toContain("Propietario demo");
    expect(JSON.stringify(owner.body)).toContain("inventory_manager");
    expect(JSON.stringify(owner.body)).toContain(tenantId);
    expect(seller.status).toBe(403);
  });

  it("returns a safe error for invalid demo credentials", async () => {
    const result = await request("/demo/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "propietario", pin: "000000" }),
    });

    expect(result.status).toBe(401);
    expect(JSON.stringify(result.body)).toContain("SESSION_INVALID");
    expect(JSON.stringify(result.body)).not.toContain("100001");
    expect(JSON.stringify(result.body)).not.toContain("+51900000001");
  });
});
