import type { InventoryWebRole } from "../../api/inventory-client.js";
import type {
  InventoryBiApi,
  AlertSummaryRow,
  ExpirationRiskRow,
  InventorySummary,
  MovementSummaryRow,
  StockByCategoryRow,
} from "./inventory-bi-client.js";

export interface InventoryBiDashboardModel {
  readonly role: InventoryWebRole;
  readonly status: "IDLE" | "LOADING" | "READY" | "EMPTY" | "ERROR";
  readonly summary?: InventorySummary;
  readonly stockByCategory: readonly StockByCategoryRow[];
  readonly expirationRisk: readonly ExpirationRiskRow[];
  readonly movementSummary: readonly MovementSummaryRow[];
  readonly alertsSummary: readonly AlertSummaryRow[];
  readonly error?: string;
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
    this.#state = { ...this.#state, status: "LOADING" };
    try {
      const [
        summary,
        stockByCategory,
        expirationRisk,
        movementSummary,
        alertsSummary,
      ] = await Promise.all([
        this.api.inventorySummary(),
        this.api.stockByCategory(),
        this.api.expirationRisk(),
        this.api.movementSummary(),
        this.api.alertsSummary(),
      ]);
      const isEmpty =
        summary.totalProducts === 0 &&
        stockByCategory.length === 0 &&
        expirationRisk.length === 0 &&
        alertsSummary.length === 0;
      this.#state = {
        ...this.#state,
        status: isEmpty ? "EMPTY" : "READY",
        summary,
        stockByCategory,
        expirationRisk,
        movementSummary,
        alertsSummary,
      };
    } catch {
      this.#state = {
        ...this.#state,
        status: "ERROR",
        error: "No se pudo cargar el resumen BI de inventario.",
      };
    }
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

/** Framework-neutral dashboard markup for the existing web shell. */
export function renderInventoryBiDashboard(
  model: InventoryBiDashboardModel,
): string {
  const canViewCosts = model.role !== "seller";
  if (model.status === "LOADING")
    return '<main data-testid="bi-dashboard"><p role="status">Cargando indicadores…</p></main>';
  if (model.status === "ERROR")
    return `<main data-testid="bi-dashboard"><p role="alert">${escapeHtml(model.error ?? "Error")}</p></main>`;
  if (model.status === "EMPTY")
    return '<main data-testid="bi-dashboard"><h1>BI de inventario</h1><p data-testid="bi-empty">No hay datos de inventario.</p></main>';
  const summary = model.summary;
  const valuation =
    canViewCosts && summary?.inventoryValuation !== undefined
      ? `<dd data-testid="bi-valuation">${summary.inventoryValuation}</dd>`
      : "";
  return `<main data-testid="bi-dashboard" data-role="${escapeHtml(model.role)}">
    <h1>BI de inventario</h1>
    <dl data-testid="bi-kpis"><dt>Productos</dt><dd>${summary?.totalProducts ?? 0}</dd><dt>Stock disponible</dt><dd>${summary?.totalStockAvailable ?? 0}</dd><dt>Stock bajo</dt><dd>${summary?.lowStockProducts ?? 0}</dd><dt>Próximos a vencer</dt><dd>${summary?.productsExpiringSoon ?? 0}</dd><dt>Vencidos</dt><dd>${summary?.productsExpired ?? 0}</dd><dt>Alertas activas</dt><dd>${summary?.activeAlerts ?? 0}</dd>${valuation}</dl>
    <section aria-labelledby="bi-category-title"><h2 id="bi-category-title">Stock por categoría</h2><table data-testid="bi-category-table"><tbody>${model.stockByCategory.map((row) => `<tr><td>${escapeHtml(row.categoryName)}</td><td>${row.stockAvailable}</td>${canViewCosts && row.inventoryValuation !== undefined ? `<td>${row.inventoryValuation}</td>` : ""}</tr>`).join("")}</tbody></table></section>
    <section aria-labelledby="bi-expiration-title"><h2 id="bi-expiration-title">Riesgo de vencimiento</h2><table data-testid="bi-expiration-table"><tbody>${model.expirationRisk.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.expiresAt)}</td><td>${escapeHtml(row.riskState)}</td>${canViewCosts && row.estimatedLoss !== undefined ? `<td>${row.estimatedLoss}</td>` : ""}</tr>`).join("")}</tbody></table></section>
    <section aria-labelledby="bi-movement-title"><h2 id="bi-movement-title">Movimientos</h2><table data-testid="bi-movement-table"><tbody>${model.movementSummary.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${row.movementCount}</td><td>${row.quantity}</td></tr>`).join("")}</tbody></table></section>
    <section aria-labelledby="bi-alert-title"><h2 id="bi-alert-title">Alertas activas</h2><table data-testid="bi-alert-table"><tbody>${model.alertsSummary.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${row.alertCount}</td></tr>`).join("")}</tbody></table></section>
  </main>`;
}
