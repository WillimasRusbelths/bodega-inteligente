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
import { AlertsController } from "../modules/alerts/alerts.controller.js";
import { AlertService } from "../modules/alerts/services/alert.service.js";
import { BiController } from "../modules/bi/bi.controller.js";
import { InventoryBiService } from "../modules/bi/inventory-bi.service.js";
import { CatalogController } from "../modules/catalog/catalog.controller.js";
import { InventoryController } from "../modules/inventory/inventory.controller.js";
import { FefoRepository } from "../modules/inventory/repositories/fefo.repository.js";
import { FefoService } from "../modules/inventory/services/fefo.service.js";
import { InventoryBalanceService } from "../modules/inventory/services/inventory-balance.service.js";
import { InventoryMovementService } from "../modules/inventory/services/inventory-movement.service.js";
import { LotsController } from "../modules/lots/lots.controller.js";
import { LotReceiptService } from "../modules/lots/services/lot-receipt.service.js";
import {
  QuickSaleService,
  type QuickSaleInput,
  type SaleProductResponse,
} from "../modules/sales/quick-sale.service.js";

const DEFAULT_PORT = 3000;
const LOCAL_WEB_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function configuredCorsOrigins(): readonly string[] {
  const configured = process.env["CORS_ORIGIN"]?.trim();
  const configuredOrigins =
    configured === undefined || configured.length === 0
      ? []
      : configured
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0);
  return process.env["NODE_ENV"] === "production"
    ? configuredOrigins
    : [...LOCAL_WEB_ORIGINS, ...configuredOrigins];
}

function applyCorsHeaders(response: ServerResponse): void {
  const origins = configuredCorsOrigins();
  const origin = origins.at(0);
  if (origin !== undefined) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Demo-Session, X-Correlation-Id",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, OPTIONS",
  );
}

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  body: Readonly<Record<string, unknown>>,
): void {
  const payload = JSON.stringify(body);
  response.statusCode = statusCode;
  applyCorsHeaders(response);
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

function redactSensitiveText(value: string): string {
  const databaseUrl = process.env["DATABASE_URL"];
  const withoutDatabaseUrl =
    databaseUrl === undefined || databaseUrl.length === 0
      ? value
      : value.split(databaseUrl).join("[DATABASE_URL]");
  return withoutDatabaseUrl
    .replace(
      /\bpostgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@/giu,
      "postgresql://[REDACTED]@",
    )
    .replace(
      /\b(password|token|secret|authorization)=([^&\s]+)/giu,
      "$1=[REDACTED]",
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gu, "$1 [REDACTED]");
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return redactSensitiveText(error.message);
  if (typeof error === "string") return redactSensitiveText(error);
  return "Unknown non-error throw";
}

function errorStackFirstLine(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.stack === undefined) return undefined;
  const firstLine = error.stack.split(/\r?\n/u).at(0);
  return firstLine === undefined ? undefined : redactSensitiveText(firstLine);
}

function prismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

function requestPath(request: IncomingMessage): string {
  try {
    return new URL(request.url ?? "/", "http://localhost").pathname;
  } catch {
    return "[INVALID_URL]";
  }
}

function maskDatabaseHost(hostname: string): string {
  const labels = hostname.split(".").filter((label) => label.length > 0);
  if (labels.length === 0) return "[unknown-host]";
  const first = labels[0] ?? "";
  const maskedFirst =
    first.length <= 3 ? `${first.at(0) ?? ""}***` : `${first.slice(0, 3)}***`;
  return labels.length >= 3
    ? [maskedFirst, ...labels.slice(-2)].join(".")
    : maskedFirst;
}

function databaseHostMasked(): string | undefined {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.length === 0) return undefined;
  try {
    return maskDatabaseHost(new URL(databaseUrl).hostname);
  } catch {
    return "[invalid-database-url]";
  }
}

function logInternalServerError(
  request: IncomingMessage,
  correlationId: string,
  status: number,
  error: unknown,
): void {
  if (status < 500) return;
  globalThis.console.error(
    JSON.stringify({
      event: "api_internal_error",
      correlationId,
      method: request.method ?? "[UNKNOWN_METHOD]",
      url: requestPath(request),
      status,
      errorName: errorName(error),
      errorMessage: errorMessage(error),
      prismaCode: prismaErrorCode(error),
      stackFirstLine: errorStackFirstLine(error),
    }),
  );
}

function logStartup(port: number): void {
  globalThis.console.info(
    JSON.stringify({
      event: "api_startup",
      nodeEnv: process.env["NODE_ENV"] ?? "development",
      appEnv: process.env["APP_ENV"] ?? null,
      demoAuthEnabled: process.env["DEMO_AUTH_ENABLED"] === "true",
      databaseUrlConfigured: process.env["DATABASE_URL"] !== undefined,
      databaseHostMasked: databaseHostMasked() ?? null,
      port,
    }),
  );
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

const DEMO_LOGIN = {
  propietario: { pin: "100001", role: "owner_admin" },
  inventario: { pin: "100002", role: "inventory_manager" },
  vendedor: { pin: "100003", role: "seller" },
} as const;

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
    "sales.read",
    "sales.write",
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
    "sales.read",
    "sales.write",
  ],
  seller: [
    "inventory.products.read",
    "inventory.lots.read",
    "inventory.stock.read",
    "inventory.movements.read",
    "inventory.alerts.read",
    "sales.read",
    "sales.write",
  ],
});

type DemoRole = keyof typeof ROLE_PERMISSIONS;
type DemoLoginUser = keyof typeof DEMO_LOGIN;

interface DemoSessionPayload {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
    readonly phoneE164: string;
  };
  readonly tenant: {
    readonly id: string;
    readonly name: string;
    readonly locationText: string | null;
    readonly currencyCode: string;
    readonly referenceSchedule: string | null;
    readonly status: string;
  };
  readonly membership: {
    readonly id: string;
    readonly status: string;
    readonly role: DemoRole;
  };
}

function statusFromError(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  if (error instanceof SyntaxError) return 400;
  if (error instanceof Error && error.name === "TenantPermissionError") {
    return 403;
  }
  if (error instanceof Error && error.name === "TenantSessionInvalidError") {
    return 401;
  }
  if (
    error instanceof Error &&
    (error.name === "NotFoundError" ||
      ("code" in error && error.code === "RESOURCE_NOT_FOUND"))
  ) {
    return 404;
  }
  return 500;
}

function codeFromError(error: unknown, status: number): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    status < 500
  ) {
    return error.code;
  }
  if (status === 403) return "INSUFFICIENT_PERMISSION";
  if (status === 401) return "SESSION_INVALID";
  if (status === 404) return "RESOURCE_NOT_FOUND";
  return "REQUEST_FAILED";
}

interface TenantSettingsInput {
  readonly name?: string;
  readonly locationText?: string | null;
  readonly currencyCode?: string;
  readonly referenceSchedule?: string | null;
  readonly status?: "ACTIVE" | "DISABLED";
}

function demoRole(request: IncomingMessage): DemoRole {
  const sessionRole = roleFromSessionHeader(request);
  if (sessionRole !== null) return sessionRole;
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

function demoSessionId(role: DemoRole): string {
  return `demo-web-session-${role}`;
}

function roleFromSessionHeader(request: IncomingMessage): DemoRole | null {
  const value = request.headers["x-demo-session"];
  if (typeof value !== "string") return null;
  for (const role of Object.keys(ROLE_PERMISSIONS) as DemoRole[]) {
    if (value === demoSessionId(role)) return role;
  }
  return null;
}

function requireDemoSession(request: IncomingMessage): DemoRole {
  assertDemoAllowed();
  const role = roleFromSessionHeader(request);
  if (role === null)
    throw Object.assign(new Error("SESSION_REQUIRED"), { status: 401 });
  return role;
}

function assertDemoAllowed(): void {
  const production = process.env["NODE_ENV"] === "production";
  const demoAuthEnabled = process.env["DEMO_AUTH_ENABLED"] === "true";
  if (production && !demoAuthEnabled) {
    throw Object.assign(new Error("DEMO_DISABLED"), { status: 403 });
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk, "utf8"));
    } else if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
    } else {
      throw Object.assign(new Error("INVALID_BODY"), { status: 400 });
    }
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw) as unknown;
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("INVALID_BODY"), { status: 400 });
  }
  return value as Record<string, unknown>;
}

function optionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw Object.assign(new Error("INVALID_FIELD"), { status: 400 });
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw Object.assign(new Error("INVALID_FIELD"), { status: 400 });
  }
  return trimmed.length === 0 ? null : trimmed;
}

function requiredText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    throw Object.assign(new Error("INVALID_FIELD"), { status: 400 });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw Object.assign(new Error("INVALID_FIELD"), { status: 400 });
  }
  return trimmed;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw Object.assign(new Error("INVALID_FIELD"), {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }
  return value;
}

function requiredNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw Object.assign(new Error("INVALID_FIELD"), {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }
  return value;
}

function quickSaleInput(value: unknown): QuickSaleInput {
  const body = record(value);
  const rawItems = body["items"];
  if (!Array.isArray(rawItems)) {
    throw Object.assign(new Error("INVALID_FIELD"), {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }
  return {
    items: rawItems.map((rawItem) => {
      const item = record(rawItem);
      const unitPrice = optionalNumber(item["unitPrice"]);
      return {
        productId: requiredText(item["productId"], 64),
        quantity: requiredNumber(item["quantity"]),
        ...(unitPrice === undefined ? {} : { unitPrice }),
      };
    }),
  };
}

function tenantSettingsInput(value: unknown): TenantSettingsInput {
  const body = record(value);
  const input: TenantSettingsInput = {};
  const name = optionalText(body["name"], 160);
  const locationText = optionalText(body["locationText"], 240);
  const currencyCode = optionalText(body["currencyCode"], 3);
  const referenceSchedule = optionalText(body["referenceSchedule"], 160);
  const status = body["status"];
  if (name !== undefined) Object.assign(input, { name });
  if (locationText !== undefined) Object.assign(input, { locationText });
  if (currencyCode !== undefined) {
    Object.assign(input, {
      currencyCode: currencyCode?.toUpperCase() ?? "PEN",
    });
  }
  if (referenceSchedule !== undefined) {
    Object.assign(input, { referenceSchedule });
  }
  if (status !== undefined) {
    if (status !== "ACTIVE" && status !== "DISABLED") {
      throw Object.assign(new Error("INVALID_FIELD"), { status: 400 });
    }
    Object.assign(input, { status });
  }
  return input;
}

async function demoSessionPayload(
  prisma: PrismaModule,
  role: DemoRole,
): Promise<DemoSessionPayload> {
  const tenantId = process.env["DEMO_TENANT_ID"]?.trim() || DEMO_TENANT_ID;
  const [tenant, user] = await prisma.execute((db) =>
    Promise.all([
      db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          locationText: true,
          currencyCode: true,
          referenceSchedule: true,
          status: true,
        },
      }),
      db.user.findUnique({
        where: { id: DEMO_USERS[role] },
        select: { id: true, displayName: true, phoneE164: true },
      }),
    ]),
  );
  if (tenant === null || user === null) {
    throw Object.assign(new Error("DEMO_SEED_REQUIRED"), { status: 404 });
  }
  return {
    sessionId: demoSessionId(role),
    user,
    tenant: { ...tenant, status: tenant.status },
    membership: {
      id: DEMO_MEMBERSHIPS[role],
      status: "ACTIVE",
      role,
    },
  };
}

function biPath(pathname: string): string | null {
  const prefix = "/tenants/current/bi/";
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length);
  return suffix.length === 0 ? null : suffix;
}

interface InventoryReadControllers {
  readonly catalog: CatalogController;
  readonly lots: LotsController;
  readonly inventory: InventoryController;
  readonly alerts: AlertsController;
}

function queryRecordFromUrl(url: URL): Record<string, unknown> {
  return Object.fromEntries(
    [...url.searchParams.entries()].map(([key, value]) => [
      key,
      key === "quantity" ? Number(value) : value,
    ]),
  );
}

function operationalProductResponse(
  catalogResult: unknown,
  salesProducts: readonly SaleProductResponse[],
): Readonly<Record<string, unknown>> {
  const page = record(catalogResult);
  const rawItems = page["items"];
  if (!Array.isArray(rawItems)) {
    throw new Error("INVALID_OPERATIONAL_PRODUCT_RESPONSE");
  }
  const salesById = new Map(
    salesProducts.map((product) => [product.id, product] as const),
  );
  const items = rawItems.map((value) => {
    const product = record(value);
    const id = product["id"];
    const summary = typeof id === "string" ? salesById.get(id) : undefined;
    return summary === undefined
      ? product
      : { ...product, availableStock: summary.availableStock };
  });
  return { ...page, items, data: salesProducts };
}

async function handleInventoryReadRoute(
  request: IncomingMessage,
  response: ServerResponse,
  controllers: InventoryReadControllers,
  sales: QuickSaleService,
): Promise<boolean> {
  if (request.method !== "GET") return false;
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  const supported = new Set([
    "/tenants/current/products",
    "/tenants/current/lots",
    "/tenants/current/inventory/balances",
    "/tenants/current/inventory/movements",
    "/tenants/current/inventory/alerts",
    "/tenants/current/inventory/fefo/suggestions",
  ]);
  if (!supported.has(pathname)) return false;

  requireDemoSession(request);
  const context = demoContext(request);
  const query = queryRecordFromUrl(url);
  const result =
    pathname === "/tenants/current/products"
      ? operationalProductResponse(
          await controllers.catalog.listProducts(context, query),
          await sales.listProducts(context),
        )
      : pathname === "/tenants/current/lots"
        ? await controllers.lots.listTenantLots(context, query)
        : pathname === "/tenants/current/inventory/balances"
          ? await controllers.inventory.listBalances(context, query)
          : pathname === "/tenants/current/inventory/movements"
            ? await controllers.inventory.listMovements(context, query)
            : pathname === "/tenants/current/inventory/alerts"
              ? await controllers.alerts.list(context, query)
              : await controllers.inventory.suggestFefo(context, query);
  jsonResponse(response, 200, record(result));
  return true;
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

async function handleDemoAuthRoute(
  request: IncomingMessage,
  response: ServerResponse,
  prisma: PrismaModule,
): Promise<boolean> {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (pathname === "/demo/auth/login" && request.method === "POST") {
    assertDemoAllowed();
    const body = record(await readJsonBody(request));
    const username = requiredText(body["username"], 32) as DemoLoginUser;
    const pin = requiredText(body["pin"], 16);
    if (!(username in DEMO_LOGIN) || DEMO_LOGIN[username].pin !== pin) {
      throw Object.assign(new Error("INVALID_DEMO_CREDENTIALS"), {
        status: 401,
      });
    }
    const payload = await demoSessionPayload(prisma, DEMO_LOGIN[username].role);
    jsonResponse(response, 200, { data: payload });
    return true;
  }
  if (pathname === "/demo/auth/session" && request.method === "GET") {
    assertDemoAllowed();
    const role = requireDemoSession(request);
    jsonResponse(response, 200, {
      data: await demoSessionPayload(prisma, role),
    });
    return true;
  }
  if (pathname === "/demo/auth/logout" && request.method === "POST") {
    assertDemoAllowed();
    requireDemoSession(request);
    jsonResponse(response, 200, { data: { loggedOut: true } });
    return true;
  }
  return false;
}

async function tenantSettings(
  prisma: PrismaModule,
  tenantId: string,
): Promise<DemoSessionPayload["tenant"]> {
  const tenant = await prisma.execute((db) =>
    db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        locationText: true,
        currencyCode: true,
        referenceSchedule: true,
        status: true,
      },
    }),
  );
  if (tenant === null) {
    throw Object.assign(new Error("TENANT_NOT_FOUND"), { status: 404 });
  }
  return { ...tenant, status: tenant.status };
}

async function handleTenantAdminRoute(
  request: IncomingMessage,
  response: ServerResponse,
  prisma: PrismaModule,
): Promise<boolean> {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const tenantId = process.env["DEMO_TENANT_ID"]?.trim() || DEMO_TENANT_ID;
  if (pathname === "/tenants/current/settings" && request.method === "GET") {
    requireDemoSession(request);
    jsonResponse(response, 200, {
      data: await tenantSettings(prisma, tenantId),
    });
    return true;
  }
  if (pathname === "/tenants/current/settings" && request.method === "PATCH") {
    const role = requireDemoSession(request);
    if (role !== "owner_admin") {
      throw Object.assign(new Error("INSUFFICIENT_PERMISSION"), {
        status: 403,
      });
    }
    const input = tenantSettingsInput(await readJsonBody(request));
    const tenant = await prisma.execute((db) =>
      db.tenant.update({
        where: { id: tenantId },
        data: input,
        select: {
          id: true,
          name: true,
          locationText: true,
          currencyCode: true,
          referenceSchedule: true,
          status: true,
        },
      }),
    );
    jsonResponse(response, 200, { data: { ...tenant, status: tenant.status } });
    return true;
  }
  if (pathname === "/tenants/current/memberships" && request.method === "GET") {
    const role = requireDemoSession(request);
    if (role !== "owner_admin") {
      throw Object.assign(new Error("INSUFFICIENT_PERMISSION"), {
        status: 403,
      });
    }
    const memberships = await prisma.execute((db) =>
      db.membership.findMany({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          tenantId: true,
          user: { select: { displayName: true, phoneE164: true } },
          membershipRoles: {
            select: { role: { select: { code: true } } },
            take: 1,
          },
        },
      }),
    );
    jsonResponse(response, 200, {
      data: memberships.map((membership) => ({
        id: membership.id,
        tenantId: membership.tenantId,
        displayName: membership.user.displayName,
        phoneE164: membership.user.phoneE164,
        role: membership.membershipRoles[0]?.role.code ?? "seller",
        status: membership.status,
      })),
    });
    return true;
  }
  return false;
}

async function handleSalesRoute(
  request: IncomingMessage,
  response: ServerResponse,
  service: QuickSaleService,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  const context = demoContext(request);

  if (pathname === "/tenants/current/products" && request.method === "GET") {
    requireDemoSession(request);
    jsonResponse(response, 200, {
      data: await service.listProducts(context),
    });
    return true;
  }

  if (pathname === "/tenants/current/sales" && request.method === "POST") {
    requireDemoSession(request);
    const input = quickSaleInput(await readJsonBody(request));
    jsonResponse(response, 201, {
      data: await service.create(context, input),
    });
    return true;
  }

  if (pathname === "/tenants/current/sales" && request.method === "GET") {
    requireDemoSession(request);
    jsonResponse(response, 200, {
      data: await service.list(context),
    });
    return true;
  }

  const saleDetail = /^\/tenants\/current\/sales\/(?<saleId>[^/]+)$/u.exec(
    pathname,
  );
  if (saleDetail !== null && request.method === "GET") {
    requireDemoSession(request);
    const saleId = saleDetail.groups?.["saleId"];
    if (saleId === undefined) return false;
    jsonResponse(response, 200, {
      data: await service.get(context, saleId),
    });
    return true;
  }

  return false;
}

/** Test/performance HTTP boundary plus the read-only inventory BI demo API. */
export function createApiServer() {
  const prisma = new PrismaModule();
  const controller = new BiController(new InventoryBiService(prisma));
  const sales = new QuickSaleService(prisma);
  const inventoryReads: InventoryReadControllers = {
    catalog: new CatalogController(prisma),
    lots: new LotsController(new LotReceiptService(prisma)),
    inventory: new InventoryController(
      new InventoryMovementService(prisma),
      new InventoryBalanceService(prisma),
      new FefoService(new FefoRepository(prisma)),
    ),
    alerts: new AlertsController(new AlertService(prisma)),
  };
  const server = createServer((request, response) => {
    const id = correlationId(request);

    if (request.method === "OPTIONS") {
      jsonResponse(response, 204, {});
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      jsonResponse(response, 200, {
        status: "ok",
        service: "api",
        correlationId: id,
      });
      return;
    }

    void handleDemoAuthRoute(request, response, prisma)
      .then((handled) =>
        handled ? true : handleTenantAdminRoute(request, response, prisma),
      )
      .then((handled) =>
        handled
          ? true
          : handleInventoryReadRoute(
              request,
              response,
              inventoryReads,
              sales,
            ),
      )
      .then((handled) =>
        handled ? true : handleSalesRoute(request, response, sales),
      )
      .then((handled) =>
        handled ? true : handleBiRoute(request, response, controller),
      )
      .then((handled) => {
        if (handled || response.writableEnded) return;
        request.resume();
        jsonResponse(response, 404, {
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found",
            correlationId: id,
          },
        });
      })
      .catch((error: unknown) => {
        const status = statusFromError(error);
        logInternalServerError(request, id, status, error);
        jsonResponse(response, status, {
          error: {
            code: codeFromError(error, status),
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
    logStartup(port);
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
