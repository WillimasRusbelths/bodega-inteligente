import type {
  FefoResult,
  InventoryAlert,
  InventoryBalance,
  InventoryWebRole,
  LotOperational,
  Product,
} from "../api/inventory-client.js";
import {
  resourceState,
  type ResourceState,
} from "./dashboard/operational-dashboard-state.js";
import { renderSurfaceState } from "./dashboard/surface-state-view.js";

export interface InventoryDashboardModel {
  readonly role: InventoryWebRole;
  readonly loading?: boolean;
  readonly error?: string;
  readonly correlationId?: string;
  readonly resources?: Readonly<
    Partial<
      Record<
        "products" | "lots" | "balances" | "alerts" | "fefo",
        ResourceState<unknown>
      >
    >
  >;
  readonly products: readonly Product[];
  readonly lots: readonly LotOperational[];
  readonly balances: readonly InventoryBalance[];
  readonly alerts: readonly InventoryAlert[];
  readonly fefo?: FefoResult;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Accessible, framework-neutral markup used by the web shell and E2E fixtures. */
export function renderInventoryDashboard(
  model: InventoryDashboardModel,
): string {
  if (model.loading || model.error !== undefined) {
    const state = model.loading
      ? resourceState.loading(0)
      : resourceState.error(
          "No se pudo cargar el inventario.",
          model.correlationId ?? null,
          0,
        );
    return `<main data-testid="inventory-dashboard" aria-labelledby="inventory-title"><h1 id="inventory-title">Inventario de la bodega activa</h1><div data-testid="inventory-${model.loading ? "loading" : "error"}">${renderSurfaceState({ resource: "products", label: "Inventario", state, renderContent: () => "", canRetry: true })}</div></main>`;
  }
  const region = (
    key: "products" | "lots" | "balances" | "alerts" | "fefo",
    label: string,
    content: string,
  ): string => {
    const state = model.resources?.[key];
    return state === undefined
      ? content
      : renderSurfaceState({
          resource: key,
          label,
          state,
          renderContent: () => content,
          canRetry: true,
        });
  };
  const productsContent =
    model.products.length === 0
      ? '<p data-testid="products-empty">No hay productos para este tenant.</p>'
      : `<ul data-testid="product-list">${model.products.map((product) => `<li data-testid="product-row"><span>${escapeHtml(product.name)}</span><span>${escapeHtml(product.sku ?? "Sin SKU")}</span><span>Stock de producto: ${product.availableStock ?? 0}</span></li>`).join("")}</ul>`;
  const lotsContent =
    model.lots.length === 0
      ? '<p data-testid="lots-empty">No hay lotes para los filtros seleccionados.</p>'
      : `<ul data-testid="lot-list">${model.lots.map((lot) => `<li data-testid="lot-row"><span>${escapeHtml(lot.expiresAt)}</span><span>Stock por lote: ${lot.availableQuantity}</span></li>`).join("")}</ul>`;
  const balancesContent =
    model.balances.length === 0
      ? '<p data-testid="stock-empty">No hay balances de stock para la consulta actual.</p>'
      : `<ul data-testid="stock-list">${model.balances.map((balance) => `<li data-testid="stock-row">${balance.availableQuantity}</li>`).join("")}</ul>`;
  const alertsContent =
    model.alerts.length === 0
      ? '<p data-testid="alerts-empty">No hay alertas activas.</p>'
      : `<ul data-testid="alert-list">${model.alerts.map((alert) => `<li data-testid="alert-row">${escapeHtml(alert.type)} · ${escapeHtml(alert.status)}</li>`).join("")}</ul>`;
  const fefoContent =
    model.fefo === undefined
      ? '<p data-testid="fefo-empty">Selecciona un producto para sugerir el lote que vence primero.</p>'
      : model.fefo.items.length === 0
        ? '<p data-testid="fefo-unavailable">No hay lotes vigentes suficientes.</p>'
        : `<ol data-testid="fefo-list">${model.fefo.items.map((item) => `<li data-testid="fefo-row">${escapeHtml(item.expiresAt)} · ${item.suggestedQuantity}</li>`).join("")}</ol>`;
  const products = region("products", "Productos", productsContent);
  const lots = region("lots", "Lotes", lotsContent);
  const balances = region("balances", "Balances", balancesContent);
  const alerts = region("alerts", "Alertas", alertsContent);
  const fefo = region("fefo", "Sugerencias FEFO", fefoContent);
  return `<main data-testid="inventory-dashboard" data-role="${escapeHtml(model.role)}" aria-labelledby="inventory-title">
    <h1 id="inventory-title">Inventario de la bodega activa</h1>
    <nav aria-label="Secciones de inventario"><a href="#products">Productos</a><a href="#lots">Lotes</a><a href="#stock">Stock</a><a href="#alerts">Alertas</a></nav>
    <section id="products" aria-labelledby="products-title"><h2 id="products-title">Productos</h2><form data-testid="product-filters" aria-label="Buscar productos"><label>Buscar<input name="q" /></label><label>Categoría<select name="categoryId"><option value="">Todas</option></select></label><label>Estado<select name="status"><option value="">Todos</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select></label></form>${products}</section>
    <section id="lots" aria-labelledby="lots-title"><h2 id="lots-title">Lotes y vencimientos</h2>${lots}</section>
    <section id="stock" aria-labelledby="stock-title"><h2 id="stock-title">Stock por lote y kardex</h2>${balances}</section>
    <section id="fefo" aria-labelledby="fefo-title"><h2 id="fefo-title">Sugerencia FEFO</h2>${fefo}</section>
    <section id="alerts" aria-labelledby="alerts-title"><h2 id="alerts-title">Alertas</h2>${alerts}</section>
  </main>`;
}
