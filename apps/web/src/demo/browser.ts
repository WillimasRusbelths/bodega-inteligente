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
import { SafeWebApiError, errorMetadata } from "../api/client.js";
import {
  projectOperationalDataForContext,
  unwrapApiData,
} from "../api/operational-data-adapter.js";
import { OperationalDashboardController } from "../features/dashboard/operational-dashboard-controller.js";
import type {
  OperationalDashboardState,
  ResourceState,
  WebSessionContext,
} from "../features/dashboard/operational-dashboard-state.js";
import { resolveCapabilityContext } from "../features/navigation/capability-context.js";
import { resolveCapabilityNavigation } from "../features/navigation/capability-navigation.js";
import {
  renderBodegiaDashboard,
  renderDemoLogin,
  readCapabilities,
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
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok || (isRecord(payload) && "error" in payload)) {
    const error = errorMetadata(payload);
    if (
      response.status === 401 &&
      sessionId !== undefined &&
      globalThis.sessionStorage.getItem("BODEGIA_DEMO_SESSION") === sessionId &&
      !init?.signal?.aborted
    ) {
      globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
      mountLogin(selectedRole());
    }
    throw new SafeWebApiError({
      status: response.status,
      code: error.code,
      correlationId:
        error.correlationId ?? response.headers.get("x-correlation-id"),
    });
  }
  return unwrapApiData<T>(payload);
}

async function loadEmployees(
  session: CapabilityAwareDemoWebSession,
): Promise<DemoWebSession> {
  const capabilities = effectiveCapabilities(session);
  if (!capabilities.includes("access.memberships.read")) {
    const { employees: _employees, ...safeSession } = session;
    void _employees;
    return safeSession;
  }
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
interface CapabilityAwareDemoWebSession extends DemoWebSession {
  readonly activeTenant?: {
    readonly capabilities: readonly string[];
  } | null;
  readonly effectivePermissions?: readonly string[];
}
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

let mountedController: BrowserDashboardController | null = null;
let draftContext: string | null = null;
let safeDrafts: Record<string, string> = {};
let lastSaleStatus: BrowserDashboardState["sale"]["status"] = "idle";
let settingsPending: string | null = null;
let confirmedSettings: {
  readonly sessionId: string;
  readonly tenant: DemoTenantSession;
} | null = null;

const draftFields = {
  "quick-sale-form": ["productId", "quantity", "unitPrice"],
  "tenant-settings-form": [
    "name",
    "locationText",
    "currencyCode",
    "referenceSchedule",
    "status",
  ],
} as const;

/** In-memory allowlist only: never preserve credentials or cross-context input. */
export function captureSafeFormInputs(
  container: ParentNode,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [id, names] of Object.entries(draftFields)) {
    for (const name of names) {
      const field = container.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`#${id} [name="${name}"]`);
      if (field !== null) values[`${id}:${name}`] = field.value;
    }
  }
  return values;
}

function restoreSafeFormInputs(): void {
  for (const [id, names] of Object.entries(draftFields)) {
    for (const name of names) {
      const field = document.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`#${id} [name="${name}"]`);
      const value = safeDrafts[`${id}:${name}`];
      if (field !== null && value !== undefined) field.value = value;
    }
  }
}

function effectiveCapabilities(
  session: CapabilityAwareDemoWebSession,
): readonly string[] {
  return resolveCapabilityContext({
    ...(session.activeTenant === undefined
      ? {}
      : { activeTenant: session.activeTenant }),
    ...(session.effectivePermissions === undefined
      ? {}
      : { effectivePermissions: session.effectivePermissions }),
    demoRole: session.membership.role,
  }).capabilities;
}

function sessionContext(
  session: CapabilityAwareDemoWebSession,
): WebSessionContext {
  const capabilities = effectiveCapabilities(session);
  return {
    sessionId: session.sessionId,
    tenantId: session.tenant.id,
    membershipId: session.membership.id,
    capabilities,
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
  const projectionContext = {
    role,
    capabilities: state.context?.capabilities ?? [],
  };
  const products = resourceData(state.resources.products, {
    items: [],
    data: [],
  });
  const indicators = projectOperationalDataForContext(
    resourceData(state.resources.indicators, emptyIndicators),
    projectionContext,
  );
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
      lots: projectOperationalDataForContext(
        resourceData(state.resources.lots, []),
        projectionContext,
      ),
      balances: projectOperationalDataForContext(
        resourceData(state.resources.balances, []),
        projectionContext,
      ),
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
  session: CapabilityAwareDemoWebSession,
): Promise<LoadedDashboard> {
  const context = sessionContext(session);
  const projectionContext = {
    role: session.membership.role,
    capabilities: context.capabilities,
  };
  const controller =
    new OperationalDashboardController<BrowserDashboardResources>({
      products: ({ context, signal }) =>
        readApi<OperationalProductResponse>(
          "/tenants/current/products",
          context.sessionId,
          { signal },
        ).then((value) =>
          projectOperationalDataForContext(value, projectionContext),
        ),
      lots: ({ context, signal }) =>
        readApi<Page<Lot>>("/tenants/current/lots", context.sessionId, {
          signal,
        }).then((page) =>
          projectOperationalDataForContext(page.items, projectionContext),
        ),
      balances: ({ context, signal }) =>
        readApi<Page<InventoryBalance>>(
          "/tenants/current/inventory/balances",
          context.sessionId,
          { signal },
        ).then((page) =>
          projectOperationalDataForContext(page.items, projectionContext),
        ),
      movements: ({ context, signal }) =>
        readApi<Page<InventoryMovement>>(
          "/tenants/current/inventory/movements",
          context.sessionId,
          { signal },
        ).then((page) =>
          projectOperationalDataForContext(page.items, projectionContext),
        ),
      alerts: ({ context, signal }) =>
        readApi<Page<InventoryAlert>>(
          "/tenants/current/inventory/alerts",
          context.sessionId,
          { signal },
        ).then((page) =>
          projectOperationalDataForContext(page.items, projectionContext),
        ),
      sales: ({ context, signal }) =>
        readApi<readonly QuickSaleRecord[]>(
          "/tenants/current/sales",
          context.sessionId,
          { signal },
        ).then((value) =>
          projectOperationalDataForContext(value, projectionContext),
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
        return projectOperationalDataForContext(
          {
            summary,
            stockByCategory,
            expirationRisk,
            movementSummary,
            alertsSummary,
          },
          projectionContext,
        );
      },
    });
  const previous = mountedController;
  mountedController = controller;
  previous?.clear();
  controller.subscribe((next) => {
    if (mountedController !== controller) return;
    if (next === null) {
      mountLogin(session.membership.role);
      return;
    }
    mountDashboard(
      session,
      dashboardFromState(controller, next, session.membership.role),
    );
  });
  const state = await controller.load(context);
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
      await loadOperationalDashboard(sessionWithEmployees),
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
  const previous = mountedController;
  mountedController = null;
  draftContext = null;
  safeDrafts = {};
  lastSaleStatus = "idle";
  settingsPending = null;
  confirmedSettings = null;
  previous?.clear();
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

export function bindFormSubmission(
  form: HTMLFormElement,
  resultTarget: HTMLElement | null | (() => HTMLElement | null),
  action: () => Promise<string | null>,
): (event: Pick<Event, "preventDefault">) => Promise<void> {
  let pending = false;
  const currentResult = (): HTMLElement | null =>
    typeof resultTarget === "function" ? resultTarget() : resultTarget;
  const handle = async (
    event: Pick<Event, "preventDefault">,
  ): Promise<void> => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    const submit = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (submit?.disabled === true) {
      pending = false;
      return;
    }
    if (submit !== null) submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    const initialResult = currentResult();
    if (initialResult !== null) {
      initialResult.setAttribute("role", "status");
      initialResult.textContent = "Guardando…";
    }
    try {
      const message = await action();
      const result = currentResult();
      if (result !== null && message !== null) result.textContent = message;
    } catch (error) {
      const result = currentResult();
      if (result !== null) {
        result.textContent = `No se pudo guardar. Conservamos los datos para reintentar.${error instanceof SafeWebApiError && error.correlationId !== null ? ` correlationId: ${error.correlationId}` : ""}`;
        result.setAttribute("role", "alert");
        result.setAttribute("tabindex", "-1");
        result.focus();
      }
    } finally {
      pending = false;
      form.removeAttribute("aria-busy");
      if (submit !== null) submit.disabled = false;
    }
  };
  form.addEventListener("submit", (event) => {
    void handle(event);
  });
  return handle;
}

function bindSettings(session: DemoWebSession): void {
  const form = document.querySelector<HTMLFormElement>("#tenant-settings-form");
  if (form === null) return;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit !== null) submit.disabled = settingsPending === session.sessionId;
  if (settingsPending === session.sessionId) {
    const result = document.querySelector("#settings-result");
    if (result !== null) result.textContent = "Guardando…";
  }
  bindFormSubmission(
    form,
    () =>
      mountedController?.snapshot()?.context?.sessionId === session.sessionId
        ? document.querySelector("#settings-result")
        : null,
    async () => {
      if (settingsPending === session.sessionId) return null;
      settingsPending = session.sessionId;
      try {
        const tenant = await readApi<DemoTenantSession>(
          "/tenants/current/settings",
          session.sessionId,
          {
            method: "PATCH",
            body: JSON.stringify(tenantSettingsFromForm(form)),
          },
        );
        const title = document.querySelector(".app-topbar h1 + p");
        if (
          title !== null &&
          mountedController?.snapshot()?.context?.sessionId ===
            session.sessionId
        ) {
          confirmedSettings = { sessionId: session.sessionId, tenant };
          title.textContent = tenant.name;
        }
        return "Configuracion actualizada.";
      } finally {
        if (settingsPending === session.sessionId) settingsPending = null;
        if (
          mountedController?.snapshot()?.context?.sessionId ===
          session.sessionId
        ) {
          const currentSubmit = document.querySelector<HTMLButtonElement>(
            '#tenant-settings-form button[type="submit"]',
          );
          if (currentSubmit !== null) currentSubmit.disabled = false;
        }
      }
    },
  );
}

function bindDashboard(session: DemoWebSession, data: LoadedDashboard): void {
  document
    .querySelector("#logout-demo-user")
    ?.addEventListener("click", () => void logout(session));
  bindSettings(session);
  bindQuickSale(session, data);
  bindPostSaleRetry(session, data);
  bindNavigation();
  document
    .querySelectorAll<HTMLButtonElement>("[data-retry-resource]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset["retryResource"];
        if (
          key === undefined ||
          !(key in data.state.resources) ||
          !effectiveCapabilities(session).includes(
            readCapabilities[key as keyof BrowserDashboardResources],
          )
        )
          return;
        button.disabled = true;
        void data.controller.retryResources([
          key as keyof BrowserDashboardResources,
        ]);
      });
    });
}

function bindNavigation(): void {
  const renderedCurrent = document.querySelector<HTMLElement>(
    '.navigation-item[aria-current="page"]',
  );
  const renderedCurrentLink =
    renderedCurrent?.querySelector<HTMLAnchorElement>("a");
  renderedCurrent?.removeAttribute("aria-current");
  renderedCurrentLink?.setAttribute("aria-current", "page");
  document
    .querySelectorAll<HTMLAnchorElement>(".navigation-item > a")
    .forEach((link) => {
      link.addEventListener("click", () => {
        document
          .querySelectorAll<HTMLAnchorElement>(".navigation-item > a")
          .forEach((item) => item.removeAttribute("aria-current"));
        link.setAttribute("aria-current", "page");
      });
    });
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
      const capabilities = effectiveCapabilities(session);
      const authorized = (
        Object.keys(readCapabilities) as (keyof BrowserDashboardResources)[]
      ).filter((key) => capabilities.includes(readCapabilities[key]));
      void dashboard.controller.retryResources(authorized);
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

  const form = document.querySelector<HTMLFormElement>("#quick-sale-form");
  if (form === null) return;
  bindFormSubmission(
    form,
    document.querySelector<HTMLElement>("#quick-sale-result"),
    async () => {
      const data = new FormData(form);
      const idempotencyKey = globalThis.crypto.randomUUID();
      await dashboard.controller.submitSale({
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
      });
      return null;
    },
  );
}

function mountDashboard(session: DemoWebSession, data: LoadedDashboard): void {
  if (confirmedSettings?.sessionId === session.sessionId) {
    session = { ...session, tenant: confirmedSettings.tenant };
  }
  if (draftContext === data.state.contextKey) {
    safeDrafts = { ...safeDrafts, ...captureSafeFormInputs(document) };
  } else {
    safeDrafts = {};
    lastSaleStatus = "idle";
  }
  draftContext = data.state.contextKey;
  if (
    data.state.sale.status === "succeeded" &&
    lastSaleStatus !== "succeeded"
  ) {
    for (const key of Object.keys(safeDrafts)) {
      if (key.startsWith("quick-sale-form:")) delete safeDrafts[key];
    }
  }
  lastSaleStatus = data.state.sale.status;
  if (mountedController !== null && mountedController !== data.controller) {
    mountedController.clear();
  }
  mountedController = data.controller;
  const capabilities =
    data.state.context?.capabilities ?? effectiveCapabilities(session);
  const navigation = resolveCapabilityNavigation({
    capabilities,
    requestedHref: globalThis.location.hash,
  });
  if (globalThis.location.hash !== navigation.currentHref) {
    globalThis.history.replaceState(
      null,
      "",
      `${globalThis.location.pathname}${globalThis.location.search}${navigation.currentHref}`,
    );
  }
  root().innerHTML = renderBodegiaDashboard(
    session.membership.role,
    session,
    data.salesData,
    data.operationalData,
    { sale: data.state.sale, resources: data.state.resources },
    { capabilities, requestedHref: navigation.currentHref },
  );
  restoreSafeFormInputs();
  bindDashboard(session, data);
  if (data.state.sale.status === "error") {
    const summary = document.querySelector<HTMLElement>(
      '.sale-synchronization[role="alert"]',
    );
    summary?.setAttribute("tabindex", "-1");
    summary?.focus();
  }
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
      await loadOperationalDashboard(sessionWithEmployees),
    );
  } catch {
    globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
    mountLogin(role);
  }
}

if (typeof document !== "undefined") void restoreSession(selectedRole());
