import type { InventoryWebRole } from "../../api/inventory-client.js";
import { projectOperationalDataForContext } from "../../api/operational-data-adapter.js";
import { SafeWebApiError } from "../../api/client.js";
import {
  resourceState,
  type ResourceState,
} from "../dashboard/operational-dashboard-state.js";
import { renderSurfaceState } from "../dashboard/surface-state-view.js";
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
  | {
      readonly status: "ERROR";
      readonly message: string;
      readonly correlationId?: string;
    };

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
  readonly correlationId?: string;
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
        : {
            status: "ERROR",
            message: safeError,
            ...(result.reason instanceof SafeWebApiError &&
            result.reason.correlationId !== null
              ? { correlationId: result.reason.correlationId }
              : {}),
          };
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
      Object.values(resources).every(
        (resource: BiResourceState<unknown>) => resource.status !== "ERROR",
      ) &&
      summary !== undefined &&
      summary.totalProducts === 0 &&
      stockByCategory.length === 0 &&
      expirationRisk.length === 0 &&
      movementSummary.length === 0 &&
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
  if (
    projectedModel.status === "LOADING" ||
    projectedModel.status === "IDLE" ||
    (projectedModel.status === "ERROR" &&
      projectedModel.resources === undefined)
  ) {
    const state =
      projectedModel.status === "LOADING"
        ? resourceState.loading(0)
        : projectedModel.status === "IDLE"
          ? resourceState.idle()
          : resourceState.error(
              "No se pudieron cargar los indicadores.",
              projectedModel.correlationId ?? null,
              0,
            );
    return `<main data-testid="bi-dashboard">${renderSurfaceState({ resource: "indicators", label: "Indicadores", state, renderContent: () => "" })}</main>`;
  }
  if (projectedModel.status === "EMPTY")
    return '<main data-testid="bi-dashboard"><h1>BI de inventario</h1><p data-testid="bi-empty">No hay datos de inventario.</p></main>';
  const summary = projectedModel.summary;
  const region = (
    key: keyof InventoryBiResourceStates,
    label: string,
    content: () => string,
  ): string => {
    const source = projectedModel.resources?.[key];
    let state: ResourceState<unknown>;
    if (source === undefined)
      state =
        key === "summary" && summary === undefined
          ? resourceState.idle()
          : resourceState.ready(null, "", 0);
    else
      switch (source.status) {
        case "LOADING":
          state = resourceState.loading(0);
          break;
        case "IDLE":
          state = resourceState.idle();
          break;
        case "ERROR":
          state = resourceState.error(
            "No se pudo cargar la región BI.",
            source.correlationId ?? null,
            0,
          );
          break;
        case "EMPTY":
          state = resourceState.empty("", 0);
          break;
        case "READY":
          state = resourceState.ready(source.data, "", 0);
          break;
      }
    return renderSurfaceState({
      resource: key,
      label,
      state,
      renderContent: content,
    });
  };
  const valuation =
    canViewCosts && summary?.inventoryValuation !== undefined
      ? `<dt>Valorizacion</dt><dd data-testid="bi-valuation">${summary.inventoryValuation}</dd>`
      : "";
  return `<main data-testid="bi-dashboard" data-role="${escapeHtml(projectedModel.role)}">
    <h1>BI de inventario</h1>
    ${region("summary", "Indicadores", () => `<dl data-testid="bi-kpis"><dt>Productos</dt><dd>${summary?.totalProducts}</dd><dt>Stock disponible</dt><dd>${summary?.totalStockAvailable}</dd><dt>Stock bajo</dt><dd>${summary?.lowStockProducts}</dd><dt>Próximos a vencer</dt><dd>${summary?.productsExpiringSoon}</dd><dt>Vencidos</dt><dd>${summary?.productsExpired}</dd><dt>Alertas activas</dt><dd>${summary?.activeAlerts}</dd>${valuation}</dl>`)}
    <section aria-labelledby="bi-category-title"><h2 id="bi-category-title">Stock por categoría</h2>${region("stockByCategory", "Categorías", () => `<table data-testid="bi-category-table"><tbody>${projectedModel.stockByCategory.map((row) => `<tr><td>${escapeHtml(row.categoryName)}</td><td>${row.stockAvailable}</td>${canViewCosts && row.inventoryValuation !== undefined ? `<td>${row.inventoryValuation}</td>` : ""}</tr>`).join("")}</tbody></table>`)}</section>
    <section aria-labelledby="bi-expiration-title"><h2 id="bi-expiration-title">Riesgo de vencimiento</h2>${region("expirationRisk", "Lotes en riesgo", () => `<table data-testid="bi-expiration-table"><tbody>${projectedModel.expirationRisk.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.expiresAt)}</td><td>${escapeHtml(row.riskState)}</td>${canViewCosts && row.estimatedLoss !== undefined ? `<td>${row.estimatedLoss}</td>` : ""}</tr>`).join("")}</tbody></table>`)}</section>
    <section aria-labelledby="bi-movement-title"><h2 id="bi-movement-title">Movimientos</h2>${region("movementSummary", "Movimientos", () => `<table data-testid="bi-movement-table"><tbody>${projectedModel.movementSummary.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${row.movementCount}</td><td>${row.quantity}</td></tr>`).join("")}</tbody></table>`)}</section>
    <section aria-labelledby="bi-alert-title"><h2 id="bi-alert-title">Alertas activas</h2>${region("alertsSummary", "Alertas", () => `<table data-testid="bi-alert-table"><tbody>${projectedModel.alertsSummary.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${row.alertCount}</td></tr>`).join("")}</tbody></table>`)}</section>
  </main>`;
}
