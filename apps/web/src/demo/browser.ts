import type {
  InventoryAlert,
  InventoryBalance,
  InventoryMovement,
  InventoryWebRole,
  Lot,
  Product,
} from "../api/inventory-client.js";
import type {
  AlertSummaryRow,
  ExpirationRiskRow,
  InventorySummary,
  MovementSummaryRow,
  StockByCategoryRow,
} from "../features/bi/inventory-bi-client.js";
import { SafeWebApiError } from "../api/client.js";
import { unwrapApiData } from "../api/operational-data-adapter.js";
import { OperationalDashboardController } from "../features/dashboard/operational-dashboard-controller.js";
import type {
  OperationalDashboardState,
  ResourceState,
  WebSessionContext,
} from "../features/dashboard/operational-dashboard-state.js";
import {
  renderBodegiaDashboard,
  renderDemoLogin,
  type DemoEmployee,
  type DemoTenantSession,
  type DemoWebSession,
  type QuickSaleProduct,
  type QuickSaleRecord,
  type QuickSalesDashboardData,
  type OperationalDashboardData,
} from "./mvp-demo.js";

const roles = new Set<InventoryWebRole>([
  "owner_admin",
  "inventory_manager",
  "seller",
]);

declare global {
  interface Window {
    readonly __BODEGIA_API_BASE_URL?: string;
  }
}

type ApiError = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlationId: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function selectedRole(): InventoryWebRole {
  const params = new URLSearchParams(globalThis.location.search);
  const candidate = params.get("role");
  return roles.has(candidate as InventoryWebRole)
    ? (candidate as InventoryWebRole)
    : "owner_admin";
}

function apiBaseUrl(): string {
  const configured = globalThis.sessionStorage.getItem("BODEGIA_API_BASE_URL");
  if (configured !== null && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/u, "");
  }
  const runtimeConfigured = globalThis.window.__BODEGIA_API_BASE_URL;
  if (runtimeConfigured !== undefined && runtimeConfigured.trim().length > 0) {
    return runtimeConfigured.trim().replace(/\/$/u, "");
  }
  return `${globalThis.location.protocol}//${globalThis.location.hostname}:3000`;
}

function root(): HTMLDivElement {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app === null) throw new Error("DEMO_ROOT_NOT_FOUND");
  return app;
}

function chosenRole(fallback: InventoryWebRole): InventoryWebRole {
  const selected = document.querySelector<HTMLInputElement>(
    'input[name="demo-role-card"]:checked',
  );
  const value = selected?.value;
  return roles.has(value as InventoryWebRole)
    ? (value as InventoryWebRole)
    : fallback;
}

async function readApi<T>(
  path: string,
  sessionId?: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionId === undefined ? {} : { "X-Demo-Session": sessionId }),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as unknown;
  const error =
    isRecord(payload) && "error" in payload
      ? (payload as ApiError).error
      : undefined;
  if (!response.ok || error !== undefined) {
    throw new SafeWebApiError({
      status: response.status,
      code: error?.code ?? "REQUEST_FAILED",
      correlationId:
        error?.correlationId ?? response.headers.get("x-correlation-id"),
    });
  }
  return unwrapApiData<T>(payload);
}

async function loadEmployees(session: DemoWebSession): Promise<DemoWebSession> {
  if (session.membership.role !== "owner_admin") return session;
  const employees = await readApi<readonly DemoEmployee[]>(
    "/tenants/current/memberships",
    session.sessionId,
  );
  return { ...session, employees };
}

interface OperationalProductResponse {
  readonly items: readonly Product[];
  readonly data: readonly QuickSaleProduct[];
}
interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
interface OperationalIndicators {
  readonly summary: InventorySummary;
  readonly stockByCategory: readonly StockByCategoryRow[];
  readonly expirationRisk: readonly ExpirationRiskRow[];
  readonly movementSummary: readonly MovementSummaryRow[];
  readonly alertsSummary: readonly AlertSummaryRow[];
}
type BrowserDashboardResources = {
  readonly products: OperationalProductResponse;
  readonly lots: readonly Lot[];
  readonly balances: readonly InventoryBalance[];
  readonly movements: readonly InventoryMovement[];
  readonly alerts: readonly InventoryAlert[];
  readonly sales: readonly QuickSaleRecord[];
  readonly indicators: OperationalIndicators;
};
type BrowserDashboardState =
  OperationalDashboardState<BrowserDashboardResources>;
type BrowserDashboardController =
  OperationalDashboardController<BrowserDashboardResources>;
interface LoadedDashboard {
  readonly controller: BrowserDashboardController;
  readonly state: BrowserDashboardState;
  readonly salesData: QuickSalesDashboardData;
  readonly operationalData: OperationalDashboardData;
}

const emptyIndicators: OperationalIndicators = {
  summary: {
    totalProducts: 0,
    totalStockAvailable: 0,
    lowStockProducts: 0,
    productsExpiringSoon: 0,
    productsExpired: 0,
    activeAlerts: 0,
  },
  stockByCategory: [],
  expirationRisk: [],
  movementSummary: [],
  alertsSummary: [],
};

function sessionContext(session: DemoWebSession): WebSessionContext {
  return {
    sessionId: session.sessionId,
    tenantId: session.tenant.id,
    membershipId: session.membership.id,
    capabilities: [],
  };
}

function resourceData<T>(state: ResourceState<T>, fallback: T): T {
  return state.status === "ready" || state.status === "stale"
    ? state.data
    : fallback;
}

function dashboardFromState(
  controller: BrowserDashboardController,
  state: BrowserDashboardState,
  role: InventoryWebRole,
): LoadedDashboard {
  const products = resourceData(state.resources.products, {
    items: [],
    data: [],
  });
  const indicators = resourceData(state.resources.indicators, emptyIndicators);
  return {
    controller,
    state,
    salesData: {
      products: products.data,
      sales: resourceData(state.resources.sales, []),
    },
    operationalData: {
      role,
      products: products.items,
      lots: resourceData(state.resources.lots, []),
      balances: resourceData(state.resources.balances, []),
      movements: resourceData(state.resources.movements, []),
      alerts: resourceData(state.resources.alerts, []),
      fefo: {
        productId: "",
        requestedQuantity: 0,
        canFulfill: false,
        items: [],
      },
      bi: indicators,
    },
  };
}

/** Reads the active tenant aggregate; the API remains the sole stock authority. */
async function loadOperationalDashboard(
  session: DemoWebSession,
): Promise<LoadedDashboard> {
  const controller =
    new OperationalDashboardController<BrowserDashboardResources>({
      products: ({ context, signal }) =>
        readApi<OperationalProductResponse>(
          "/tenants/current/products",
          context.sessionId,
          { signal },
        ),
      lots: ({ context, signal }) =>
        readApi<Page<Lot>>("/tenants/current/lots", context.sessionId, {
          signal,
        }).then((page) => page.items),
      balances: ({ context, signal }) =>
        readApi<Page<InventoryBalance>>(
          "/tenants/current/inventory/balances",
          context.sessionId,
          { signal },
        ).then((page) => page.items),
      movements: ({ context, signal }) =>
        readApi<Page<InventoryMovement>>(
          "/tenants/current/inventory/movements",
          context.sessionId,
          { signal },
        ).then((page) => page.items),
      alerts: ({ context, signal }) =>
        readApi<Page<InventoryAlert>>(
          "/tenants/current/inventory/alerts",
          context.sessionId,
          { signal },
        ).then((page) => page.items),
      sales: ({ context, signal }) =>
        readApi<readonly QuickSaleRecord[]>(
          "/tenants/current/sales",
          context.sessionId,
          { signal },
        ),
      indicators: async ({ context, signal }) => {
        const [
          summary,
          stockByCategory,
          expirationRisk,
          movementSummary,
          alertsSummary,
        ] = await Promise.all([
          readApi<InventorySummary>(
            "/tenants/current/bi/inventory-summary",
            context.sessionId,
            { signal },
          ),
          readApi<readonly StockByCategoryRow[]>(
            "/tenants/current/bi/stock-by-category",
            context.sessionId,
            { signal },
          ),
          readApi<readonly ExpirationRiskRow[]>(
            "/tenants/current/bi/expiration-risk",
            context.sessionId,
            { signal },
          ),
          readApi<readonly MovementSummaryRow[]>(
            "/tenants/current/bi/movement-summary",
            context.sessionId,
            { signal },
          ),
          readApi<readonly AlertSummaryRow[]>(
            "/tenants/current/bi/alerts-summary",
            context.sessionId,
            { signal },
          ),
        ]);
        return {
          summary,
          stockByCategory,
          expirationRisk,
          movementSummary,
          alertsSummary,
        };
      },
    });
  const state = await controller.load(sessionContext(session));
  if (state === null) throw new Error("DASHBOARD_CONTEXT_CHANGED");
  return dashboardFromState(controller, state, session.membership.role);
}

function setLoginError(message: string): void {
  const error = document.querySelector<HTMLElement>("#login-error");
  if (error !== null) error.textContent = message;
}

function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

async function login(role: InventoryWebRole): Promise<void> {
  const form = document.querySelector<HTMLFormElement>("#demo-login-form");
  if (form === null) return;
  const data = new FormData(form);
  const username = formText(data, "username");
  const pin = formText(data, "pin");
  try {
    setLoginError("");
    const session = await readApi<DemoWebSession>(
      "/demo/auth/login",
      undefined,
      {
        method: "POST",
        body: JSON.stringify({ username, pin }),
      },
    );
    globalThis.sessionStorage.setItem(
      "BODEGIA_DEMO_SESSION",
      session.sessionId,
    );
    const sessionWithEmployees = await loadEmployees(session);
    mountDashboard(
      sessionWithEmployees,
      await loadOperationalDashboard(session),
    );
  } catch (error) {
    const suffix = error instanceof Error ? ` ${error.message}` : "";
    setLoginError(
      `No se pudo iniciar sesion. Verifica que la API este levantada.${suffix}`,
    );
    mountLogin(role);
  }
}

function bindLogin(role: InventoryWebRole): void {
  document
    .querySelector("#demo-login-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      void login(chosenRole(role));
    });
  document
    .querySelectorAll<HTMLInputElement>('input[name="demo-role-card"]')
    .forEach((input) => {
      input.addEventListener("change", () => {
        mountLogin(chosenRole(role));
      });
    });
}

function mountLogin(role: InventoryWebRole): void {
  root().innerHTML = renderDemoLogin(role);
  bindLogin(role);
}

async function logout(session: DemoWebSession): Promise<void> {
  try {
    await readApi<{ readonly loggedOut: boolean }>(
      "/demo/auth/logout",
      session.sessionId,
      { method: "POST", body: "{}" },
    );
  } finally {
    globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
    mountLogin(session.membership.role);
  }
}

function tenantSettingsFromForm(
  form: HTMLFormElement,
): Partial<DemoTenantSession> {
  const data = new FormData(form);
  return {
    name: formText(data, "name"),
    locationText: formText(data, "locationText"),
    currencyCode: formText(data, "currencyCode"),
    referenceSchedule: formText(data, "referenceSchedule"),
    status: formText(data, "status") || "ACTIVE",
  };
}

function bindSettings(session: DemoWebSession): void {
  document
    .querySelector<HTMLFormElement>("#tenant-settings-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const result = document.querySelector<HTMLElement>("#settings-result");
      void readApi<DemoTenantSession>(
        "/tenants/current/settings",
        session.sessionId,
        {
          method: "PATCH",
          body: JSON.stringify(tenantSettingsFromForm(form)),
        },
      )
        .then((tenant) => {
          if (result !== null) {
            result.textContent = "Configuracion actualizada.";
          }
          void reloadDashboard({ ...session, tenant });
        })
        .catch((error: unknown) => {
          if (result !== null) {
            result.textContent =
              error instanceof Error
                ? `No se pudo guardar: ${error.message}`
                : "No se pudo guardar.";
          }
        });
    });
}

function bindDashboard(session: DemoWebSession, data: LoadedDashboard): void {
  document
    .querySelector("#logout-demo-user")
    ?.addEventListener("click", () => void logout(session));
  bindSettings(session);
  bindQuickSale(session, data);
  bindPostSaleRetry(session, data);
}

function bindPostSaleRetry(
  session: DemoWebSession,
  dashboard: LoadedDashboard,
): void {
  document
    .querySelector<HTMLButtonElement>("#retry-post-sale-refresh")
    ?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = true;
      void dashboard.controller.retryStale().then((state) => {
        if (state === null) return;
        mountDashboard(
          session,
          dashboardFromState(
            dashboard.controller,
            state,
            session.membership.role,
          ),
        );
      });
    });
}

function selectedQuickSaleOption(): HTMLOptionElement | null {
  const select = document.querySelector<HTMLSelectElement>(
    "#quick-sale-product",
  );
  return select?.selectedOptions.item(0) ?? null;
}

function updateQuickSaleTotal(): void {
  const option = selectedQuickSaleOption();
  const quantityInput = document.querySelector<HTMLInputElement>(
    "#quick-sale-quantity",
  );
  const priceInput =
    document.querySelector<HTMLInputElement>("#quick-sale-price");
  const stockInput =
    document.querySelector<HTMLInputElement>("#quick-sale-stock");
  const totalInput =
    document.querySelector<HTMLInputElement>("#quick-sale-total");
  const price =
    Number(priceInput?.value) || Number(option?.dataset["price"] ?? 0) || 0;
  const quantity = Number(quantityInput?.value) || 0;
  if (priceInput !== null && option !== null && priceInput.value.length === 0) {
    priceInput.value = option.dataset["price"] ?? "0";
  }
  if (stockInput !== null) {
    stockInput.value = option?.dataset["stock"] ?? "0";
  }
  if (totalInput !== null) {
    totalInput.value = `S/ ${(price * quantity).toFixed(2)}`;
  }
}

function bindQuickSale(
  session: DemoWebSession,
  dashboard: LoadedDashboard,
): void {
  const product = document.querySelector<HTMLSelectElement>(
    "#quick-sale-product",
  );
  const quantity = document.querySelector<HTMLInputElement>(
    "#quick-sale-quantity",
  );
  const price = document.querySelector<HTMLInputElement>("#quick-sale-price");
  product?.addEventListener("change", () => {
    const option = selectedQuickSaleOption();
    if (price !== null) price.value = option?.dataset["price"] ?? "0";
    updateQuickSaleTotal();
  });
  quantity?.addEventListener("input", updateQuickSaleTotal);
  price?.addEventListener("input", updateQuickSaleTotal);
  updateQuickSaleTotal();

  document
    .querySelector<HTMLFormElement>("#quick-sale-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const result = document.querySelector<HTMLElement>("#quick-sale-result");
      const submit = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      const data = new FormData(form);
      const idempotencyKey = globalThis.crypto.randomUUID();
      if (submit !== null) submit.disabled = true;
      void dashboard.controller
        .submitSale({
          idempotencyKey,
          create: () =>
            readApi<QuickSaleRecord>(
              "/tenants/current/sales",
              session.sessionId,
              {
                method: "POST",
                headers: { "Idempotency-Key": idempotencyKey },
                body: JSON.stringify({
                  items: [
                    {
                      productId: formText(data, "productId"),
                      quantity: Number(formText(data, "quantity")),
                      unitPrice: Number(formText(data, "unitPrice")),
                    },
                  ],
                }),
              },
            ),
        })
        .then((state) => {
          if (state === null) return;
          mountDashboard(
            session,
            dashboardFromState(
              dashboard.controller,
              state,
              session.membership.role,
            ),
          );
        })
        .catch((error: unknown) => {
          if (submit !== null) submit.disabled = false;
          if (result !== null) {
            result.textContent =
              error instanceof Error
                ? `No se pudo vender: ${error.message}`
                : "No se pudo vender.";
          }
        });
    });
}

async function reloadDashboard(session: DemoWebSession): Promise<void> {
  mountDashboard(session, await loadOperationalDashboard(session));
}

function mountDashboard(session: DemoWebSession, data: LoadedDashboard): void {
  root().innerHTML = renderBodegiaDashboard(
    session.membership.role,
    session,
    data.salesData,
    data.operationalData,
    { sale: data.state.sale, resources: data.state.resources },
  );
  bindDashboard(session, data);
}

async function restoreSession(role: InventoryWebRole): Promise<void> {
  const sessionId = globalThis.sessionStorage.getItem("BODEGIA_DEMO_SESSION");
  if (sessionId === null) {
    mountLogin(role);
    return;
  }
  try {
    const session = await readApi<DemoWebSession>(
      "/demo/auth/session",
      sessionId,
    );
    const sessionWithEmployees = await loadEmployees(session);
    mountDashboard(
      sessionWithEmployees,
      await loadOperationalDashboard(session),
    );
  } catch {
    globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
    mountLogin(role);
  }
}

void restoreSession(selectedRole());
