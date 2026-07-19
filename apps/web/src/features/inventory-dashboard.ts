import type {
  FefoResult,
  InventoryAlert,
  InventoryBalance,
  InventoryWebRole,
  LotOperational,
  Product,
} from "../api/inventory-client.js";

export interface InventoryDashboardModel {
  readonly role: InventoryWebRole;
  readonly loading?: boolean;
  readonly error?: string;
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
  const status = model.loading
    ? '<p role="status" data-testid="inventory-loading">Cargando inventario…</p>'
    : model.error !== undefined
      ? `<p role="alert" data-testid="inventory-error">${escapeHtml(model.error)}</p>`
      : "";
  const products =
    model.products.length === 0
      ? '<p data-testid="products-empty">No hay productos para este tenant.</p>'
      : `<ul data-testid="product-list">${model.products.map((product) => `<li data-testid="product-row"><span>${escapeHtml(product.name)}</span><span>${escapeHtml(product.sku ?? "Sin SKU")}</span><span>${product.availableStock ?? 0}</span></li>`).join("")}</ul>`;
  const lots =
    model.lots.length === 0
      ? '<p data-testid="lots-empty">No hay lotes para los filtros seleccionados.</p>'
      : `<ul data-testid="lot-list">${model.lots.map((lot) => `<li data-testid="lot-row"><span>${escapeHtml(lot.expiresAt)}</span><span>${lot.availableQuantity}</span></li>`).join("")}</ul>`;
  const balances =
    model.balances.length === 0
      ? '<p data-testid="stock-empty">No hay stock disponible.</p>'
      : `<ul data-testid="stock-list">${model.balances.map((balance) => `<li data-testid="stock-row">${balance.availableQuantity}</li>`).join("")}</ul>`;
  const alerts =
    model.alerts.length === 0
      ? '<p data-testid="alerts-empty">No hay alertas activas.</p>'
      : `<ul data-testid="alert-list">${model.alerts.map((alert) => `<li data-testid="alert-row">${escapeHtml(alert.type)} · ${escapeHtml(alert.status)}</li>`).join("")}</ul>`;
  const fefo =
    model.fefo === undefined
      ? '<p data-testid="fefo-empty">Selecciona un producto para sugerir el lote que vence primero.</p>'
      : model.fefo.items.length === 0
        ? '<p data-testid="fefo-unavailable">No hay lotes vigentes suficientes.</p>'
        : `<ol data-testid="fefo-list">${model.fefo.items.map((item) => `<li data-testid="fefo-row">${escapeHtml(item.expiresAt)} · ${item.suggestedQuantity}</li>`).join("")}</ol>`;
  return `<main data-testid="inventory-dashboard" data-role="${escapeHtml(model.role)}" aria-labelledby="inventory-title">
    <h1 id="inventory-title">Inventario de la bodega activa</h1>
    <nav aria-label="Secciones de inventario"><a href="#products">Productos</a><a href="#lots">Lotes</a><a href="#stock">Stock</a><a href="#alerts">Alertas</a></nav>
    ${status}
    <section id="products" aria-labelledby="products-title"><h2 id="products-title">Productos</h2><form data-testid="product-filters" aria-label="Buscar productos"><label>Buscar<input name="q" /></label><label>Categoría<select name="categoryId"><option value="">Todas</option></select></label><label>Estado<select name="status"><option value="">Todos</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select></label></form>${products}</section>
    <section id="lots" aria-labelledby="lots-title"><h2 id="lots-title">Lotes y vencimientos</h2>${lots}</section>
    <section id="stock" aria-labelledby="stock-title"><h2 id="stock-title">Stock disponible y kardex</h2>${balances}</section>
    <section id="fefo" aria-labelledby="fefo-title"><h2 id="fefo-title">Sugerencia FEFO</h2>${fefo}</section>
    <section id="alerts" aria-labelledby="alerts-title"><h2 id="alerts-title">Alertas</h2>${alerts}</section>
  </main>`;
}
