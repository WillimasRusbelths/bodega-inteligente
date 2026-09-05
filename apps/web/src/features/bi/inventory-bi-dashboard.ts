import type { InventoryWebRole } from "../../api/inventory-client.js";
import { projectOperationalDataForContext } from "../../api/operational-data-adapter.js";
import type {
  InventoryBiApi,
  AlertSummaryRow,
  ExpirationRiskRow,
  InventorySummary,
  MovementSummaryRow,
  StockByCategoryRow,
} from "./inventory-bi-client.js";

export type BiResourceState<T> =
  | { readonly status: "IDLE" | "LOADING" }
  | { readonly status: "READY" | "EMPTY"; readonly data: T }
  | { readonly status: "ERROR"; readonly message: string };

export interface InventoryBiResourceStates {
  readonly summary: BiResourceState<InventorySummary>;
  readonly stockByCategory: BiResourceState<readonly StockByCategoryRow[]>;
  readonly expirationRisk: BiResourceState<readonly ExpirationRiskRow[]>;
  readonly movementSummary: BiResourceState<readonly MovementSummaryRow[]>;
  readonly alertsSummary: BiResourceState<readonly AlertSummaryRow[]>;
}

export interface InventoryBiDashboardModel {
  readonly role: InventoryWebRole;
  readonly capabilities?: readonly string[];
  readonly status: "IDLE" | "LOADING" | "READY" | "EMPTY" | "ERROR";
  readonly summary?: InventorySummary;
  readonly stockByCategory: readonly StockByCategoryRow[];
  readonly expirationRisk: readonly ExpirationRiskRow[];
  readonly movementSummary: readonly MovementSummaryRow[];
  readonly alertsSummary: readonly AlertSummaryRow[];
  readonly error?: string;
  readonly resources?: InventoryBiResourceStates;
}

function empty(role: InventoryWebRole): InventoryBiDashboardModel {
  return {
    role,
    status: "IDLE",
    stockByCategory: [],
    expirationRisk: [],
    movementSummary: [],
    alertsSummary: [],
  };
}

export class InventoryBiDashboardController {
  #state: InventoryBiDashboardModel;
  public constructor(
    private readonly api: InventoryBiApi,
    role: InventoryWebRole,
  ) {
    this.#state = empty(role);
  }
  public get state(): InventoryBiDashboardModel {
    return this.#state;
  }
  public async load(): Promise<void> {
    const loading: InventoryBiResourceStates = {
      summary: { status: "LOADING" },
      stockByCategory: { status: "LOADING" },
      expirationRisk: { status: "LOADING" },
      movementSummary: { status: "LOADING" },
      alertsSummary: { status: "LOADING" },
    };
    this.#state = { ...this.#state, status: "LOADING", resources: loading };
    const results = await Promise.allSettled([
      this.api.inventorySummary(),
      this.api.stockByCategory(),
      this.api.expirationRisk(),
      this.api.movementSummary(),
      this.api.alertsSummary(),
    ]);
    const safeError = "No se pudo cargar el resumen BI de inventario.";
    const asResource = <T>(
      result: PromiseSettledResult<T>,
    ): BiResourceState<T> =>
      result.status === "fulfilled"
        ? {
            status:
              Array.isArray(result.value) && result.value.length === 0
                ? "EMPTY"
                : "READY",
            data: result.value,
          }
        : { status: "ERROR", message: safeError };
    const resources: InventoryBiResourceStates = {
      summary: asResource(results[0]),
      stockByCategory: asResource(results[1]),
      expirationRisk: asResource(results[2]),
      movementSummary: asResource(results[3]),
      alertsSummary: asResource(results[4]),
    };
    const value = <T>(resource: BiResourceState<T>, fallback: T): T =>
      "data" in resource ? resource.data : fallback;
    const summary = value(resources.summary, undefined as never);
    const stockByCategory = value(resources.stockByCategory, []);
    const expirationRisk = value(resources.expirationRisk, []);
    const movementSummary = value(resources.movementSummary, []);
    const alertsSummary = value(resources.alertsSummary, []);
    const allFailed = [
      resources.summary,
      resources.stockByCategory,
      resources.expirationRisk,
      resources.movementSummary,
      resources.alertsSummary,
    ].every((resource) => resource.status === "ERROR");
    const isEmpty =
      summary !== undefined &&
      summary.totalProducts === 0 &&
      stockByCategory.length === 0 &&
      expirationRisk.length === 0 &&
      alertsSummary.length === 0;
    this.#state = projectInventoryBiDashboardModel({
      ...this.#state,
      status: allFailed ? "ERROR" : isEmpty ? "EMPTY" : "READY",
      summary,
      stockByCategory,
      expirationRisk,
      movementSummary,
      alertsSummary,
      resources,
      ...(allFailed ? { error: safeError } : {}),
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** BI state is structurally projected before any renderer can inspect it. */
export function projectInventoryBiDashboardModel(
  model: InventoryBiDashboardModel,
): InventoryBiDashboardModel {
  return projectOperationalDataForContext(model, {
    role: model.role,
    ...(model.capabilities === undefined
      ? {}
      : { capabilities: model.capabilities }),
  });
}

/** Framework-neutral dashboard markup for the existing web shell. */
export function renderInventoryBiDashboard(
  model: InventoryBiDashboardModel,
): string {
  const projectedModel = projectInventoryBiDashboardModel(model);
  const canViewCosts = projectedModel.role !== "seller";
  if (projectedModel.status === "LOADING")
    return '<main data-testid="bi-dashboard"><p role="status">Cargando indicadores…</p></main>';
  if (projectedModel.status === "ERROR")
    return `<main data-testid="bi-dashboard"><p role="alert">${escapeHtml(projectedModel.error ?? "Error")}</p></main>`;
  if (projectedModel.status === "EMPTY")
    return '<main data-testid="bi-dashboard"><h1>BI de inventario</h1><p data-testid="bi-empty">No hay datos de inventario.</p></main>';
  const summary = projectedModel.summary;
  const valuation =
    canViewCosts && summary?.inventoryValuation !== undefined
      ? `<dd data-testid="bi-valuation">${summary.inventoryValuation}</dd>`
      : "";
  return `<main data-testid="bi-dashboard" data-role="${escapeHtml(projectedModel.role)}">
    <h1>BI de inventario</h1>
    <dl data-testid="bi-kpis"><dt>Productos</dt><dd>${summary?.totalProducts ?? 0}</dd><dt>Stock disponible</dt><dd>${summary?.totalStockAvailable ?? 0}</dd><dt>Stock bajo</dt><dd>${summary?.lowStockProducts ?? 0}</dd><dt>Próximos a vencer</dt><dd>${summary?.productsExpiringSoon ?? 0}</dd><dt>Vencidos</dt><dd>${summary?.productsExpired ?? 0}</dd><dt>Alertas activas</dt><dd>${summary?.activeAlerts ?? 0}</dd>${valuation}</dl>
    <section aria-labelledby="bi-category-title"><h2 id="bi-category-title">Stock por categoría</h2><table data-testid="bi-category-table"><tbody>${projectedModel.stockByCategory.map((row) => `<tr><td>${escapeHtml(row.categoryName)}</td><td>${row.stockAvailable}</td>${canViewCosts && row.inventoryValuation !== undefined ? `<td>${row.inventoryValuation}</td>` : ""}</tr>`).join("")}</tbody></table></section>
    <section aria-labelledby="bi-expiration-title"><h2 id="bi-expiration-title">Riesgo de vencimiento</h2><table data-testid="bi-expiration-table"><tbody>${projectedModel.expirationRisk.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.expiresAt)}</td><td>${escapeHtml(row.riskState)}</td>${canViewCosts && row.estimatedLoss !== undefined ? `<td>${row.estimatedLoss}</td>` : ""}</tr>`).join("")}</tbody></table></section>
    <section aria-labelledby="bi-movement-title"><h2 id="bi-movement-title">Movimientos</h2><table data-testid="bi-movement-table"><tbody>${projectedModel.movementSummary.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${row.movementCount}</td><td>${row.quantity}</td></tr>`).join("")}</tbody></table></section>
    <section aria-labelledby="bi-alert-title"><h2 id="bi-alert-title">Alertas activas</h2><table data-testid="bi-alert-table"><tbody>${projectedModel.alertsSummary.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${row.alertCount}</td></tr>`).join("")}</tbody></table></section>
  </main>`;
}
