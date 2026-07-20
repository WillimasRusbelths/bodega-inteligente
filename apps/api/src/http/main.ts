import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { PrismaModule } from "../infrastructure/prisma/prisma.module.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../modules/access/context/tenant-context.js";
import { BiController } from "../modules/bi/bi.controller.js";
import { InventoryBiService } from "../modules/bi/inventory-bi.service.js";

const DEFAULT_PORT = 3000;

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  body: Readonly<Record<string, unknown>>,
): void {
  const payload = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(payload));
  response.end(payload);
}

function correlationId(request: IncomingMessage): string {
  const candidate = request.headers["x-correlation-id"];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : randomUUID();
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.length === 0) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_USERS = Object.freeze({
  owner_admin: "00000000-0000-4000-8000-000000000011",
  inventory_manager: "00000000-0000-4000-8000-000000000012",
  seller: "00000000-0000-4000-8000-000000000013",
});
const DEMO_MEMBERSHIPS = Object.freeze({
  owner_admin: "00000000-0000-4000-8000-000000000101",
  inventory_manager: "00000000-0000-4000-8000-000000000102",
  seller: "00000000-0000-4000-8000-000000000103",
});

const ROLE_PERMISSIONS = Object.freeze({
  owner_admin: [
    "inventory.products.read",
    "inventory.products.write",
    "inventory.lots.read",
    "inventory.lots.write",
    "inventory.stock.read",
    "inventory.stock.adjust",
    "inventory.movements.read",
    "inventory.movements.write",
    "inventory.alerts.read",
    "inventory.alerts.write",
  ],
  inventory_manager: [
    "inventory.products.read",
    "inventory.products.write",
    "inventory.lots.read",
    "inventory.lots.write",
    "inventory.stock.read",
    "inventory.stock.adjust",
    "inventory.movements.read",
    "inventory.movements.write",
    "inventory.alerts.read",
    "inventory.alerts.write",
  ],
  seller: [
    "inventory.products.read",
    "inventory.lots.read",
    "inventory.stock.read",
    "inventory.movements.read",
    "inventory.alerts.read",
  ],
});

type DemoRole = keyof typeof ROLE_PERMISSIONS;

function demoRole(request: IncomingMessage): DemoRole {
  const value = request.headers["x-demo-role"];
  return value === "seller" || value === "inventory_manager"
    ? value
    : "owner_admin";
}

function demoContext(request: IncomingMessage): TenantContext {
  const role = demoRole(request);
  const tenantId = process.env["DEMO_TENANT_ID"]?.trim() || DEMO_TENANT_ID;
  return createTenantContextHarness({
    sessionId: `demo-session-${role}`,
    userId: DEMO_USERS[role],
    tenantId,
    membershipId: DEMO_MEMBERSHIPS[role],
    contextVersion: 1,
    roles: [role],
    permissions: ROLE_PERMISSIONS[role],
  });
}

function biPath(pathname: string): string | null {
  const prefix = "/tenants/current/bi/";
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length);
  return suffix.length === 0 ? null : suffix;
}

async function handleBiRoute(
  request: IncomingMessage,
  response: ServerResponse,
  controller: BiController,
): Promise<boolean> {
  if (request.method !== "GET") return false;
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const route = biPath(pathname);
  if (route === null) return false;
  const context = demoContext(request);
  const result =
    route === "inventory-summary"
      ? await controller.inventorySummary(context)
      : route === "stock-by-category"
        ? await controller.stockByCategory(context)
        : route === "expiration-risk"
          ? await controller.expirationRisk(context)
          : route === "movement-summary"
            ? await controller.movementSummary(context)
            : route === "alerts-summary"
              ? await controller.alertsSummary(context)
              : null;
  if (result === null) return false;
  jsonResponse(response, 200, { data: result as unknown });
  return true;
}

/** Test/performance HTTP boundary plus the read-only inventory BI demo API. */
export function createApiServer() {
  const prisma = new PrismaModule();
  const controller = new BiController(new InventoryBiService(prisma));
  const server = createServer((request, response) => {
    request.resume();
    const id = correlationId(request);

    if (request.method === "GET" && request.url === "/health") {
      jsonResponse(response, 200, {
        status: "ok",
        service: "api",
        correlationId: id,
      });
      return;
    }

    void handleBiRoute(request, response, controller)
      .then((handled) => {
        if (handled || response.writableEnded) return;
        jsonResponse(response, 404, {
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found",
            correlationId: id,
          },
        });
      })
      .catch((error: unknown) => {
        const status =
          error instanceof Error && error.name === "TenantPermissionError"
            ? 403
            : error instanceof Error &&
                error.name === "TenantSessionInvalidError"
              ? 401
              : 500;
        jsonResponse(response, status, {
          error: {
            code:
              status === 403
                ? "INSUFFICIENT_PERMISSION"
                : status === 401
                  ? "SESSION_INVALID"
                  : "REQUEST_FAILED",
            message: "No se pudo completar la solicitud.",
            correlationId: id,
          },
        });
      });
  });
  server.once("close", () => {
    void prisma.disconnect();
  });
  return server;
}

function start(): void {
  const server = createApiServer();
  const port = parsePort(process.env["PORT"]);
  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`API test server listening on port ${port}\n`);
  });

  const shutdown = (signal: string): void => {
    server.close(() => {
      process.stdout.write(`API test server stopped (${signal})\n`);
      process.exit(0);
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) start();
