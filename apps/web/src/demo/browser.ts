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
import { unwrapApiData } from "../api/operational-data-adapter.js";
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

type ApiError = { readonly error: { readonly code: string; readonly message: string; readonly correlationId: string } };

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
  const error = isRecord(payload) && "error" in payload
    ? (payload as ApiError).error
    : undefined;
  if (!response.ok || error !== undefined) {
    const message =
      error !== undefined
        ? `${error.code} (${error.correlationId})`
        : "REQUEST_FAILED";
    throw new Error(message);
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
interface Page<T> { readonly items: readonly T[]; readonly nextCursor: string | null; }
interface LoadedDashboard { readonly salesData: QuickSalesDashboardData; readonly operationalData: OperationalDashboardData; }

/** Reads the active tenant aggregate; the API remains the sole stock authority. */
async function loadOperationalDashboard(session: DemoWebSession): Promise<LoadedDashboard> {
  const [products, lots, balances, movements, alerts, sales, summary, stockByCategory, expirationRisk, movementSummary, alertsSummary] = await Promise.all([
    readApi<OperationalProductResponse>("/tenants/current/products", session.sessionId),
    readApi<Page<Lot>>("/tenants/current/lots", session.sessionId),
    readApi<Page<InventoryBalance>>("/tenants/current/inventory/balances", session.sessionId),
    readApi<Page<InventoryMovement>>("/tenants/current/inventory/movements", session.sessionId),
    readApi<Page<InventoryAlert>>("/tenants/current/inventory/alerts", session.sessionId),
    readApi<readonly QuickSaleRecord[]>("/tenants/current/sales", session.sessionId),
    readApi<InventorySummary>("/tenants/current/bi/inventory-summary", session.sessionId),
    readApi<readonly StockByCategoryRow[]>("/tenants/current/bi/stock-by-category", session.sessionId),
    readApi<readonly ExpirationRiskRow[]>("/tenants/current/bi/expiration-risk", session.sessionId),
    readApi<readonly MovementSummaryRow[]>("/tenants/current/bi/movement-summary", session.sessionId),
    readApi<readonly AlertSummaryRow[]>("/tenants/current/bi/alerts-summary", session.sessionId),
  ]);
  return {
    salesData: { products: products.data, sales },
    operationalData: {
      role: session.membership.role, products: products.items, lots: lots.items,
      balances: balances.items, movements: movements.items, alerts: alerts.items,
      fefo: { productId: "", requestedQuantity: 0, canFulfill: false, items: [] },
      bi: { summary, stockByCategory, expirationRisk, movementSummary, alertsSummary },
    },
  };
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
    mountDashboard(sessionWithEmployees, await loadOperationalDashboard(session));
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

function bindDashboard(session: DemoWebSession): void {
  document
    .querySelector("#logout-demo-user")
    ?.addEventListener("click", () => void logout(session));
  bindSettings(session);
  bindQuickSale(session);
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

function bindQuickSale(session: DemoWebSession): void {
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
      const data = new FormData(form);
      void readApi<QuickSaleRecord>(
        "/tenants/current/sales",
        session.sessionId,
        {
          method: "POST",
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
      )
        .then((sale) => {
          if (result !== null) {
            result.textContent = `Venta ${sale.saleNumber} registrada.`;
          }
          void reloadDashboard(session);
        })
        .catch((error: unknown) => {
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

function mountDashboard(
  session: DemoWebSession,
  data: LoadedDashboard,
): void {
  root().innerHTML = renderBodegiaDashboard(
    session.membership.role,
    session,
    data.salesData,
    data.operationalData,
  );
  bindDashboard(session);
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
    mountDashboard(sessionWithEmployees, await loadOperationalDashboard(session));
  } catch {
    globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
    mountLogin(role);
  }
}

void restoreSession(selectedRole());
