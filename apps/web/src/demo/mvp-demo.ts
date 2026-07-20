import {
  operationalBalance,
  operationalLot,
  type InventoryMovement,
  type InventoryWebRole,
} from "../api/inventory-client.js";
import { renderInventoryBiDashboard } from "../features/bi/inventory-bi-dashboard.js";
import { renderInventoryDashboard } from "../features/inventory-dashboard.js";
import {
  createDemoInventoryData,
  type DemoInventoryData,
} from "./demo-data.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function movementRows(movements: readonly InventoryMovement[]): string {
  return movements
    .map(
      (movement) =>
        `<tr><td>${escapeHtml(movement.type)}</td><td>${movement.quantity}</td><td>${movement.quantityDelta}</td><td>${escapeHtml(movement.reason)}</td></tr>`,
    )
    .join("");
}

function renderOltp(data: DemoInventoryData): string {
  const dashboard = renderInventoryDashboard({
    role: data.role,
    products: data.products,
    lots: data.lots.map((lot) => operationalLot(lot, data.role)),
    balances: data.balances.map((balance) =>
      operationalBalance(balance, data.role),
    ),
    alerts: data.alerts,
    fefo: data.fefo,
  });
  return `<section aria-labelledby="oltp-title">
    <p class="eyebrow">OLTP</p>
    <h2 id="oltp-title">Operacion diaria: productos, lotes, movimientos, stock, alertas y FEFO</h2>
    ${dashboard}
    <section aria-labelledby="movements-title">
      <h3 id="movements-title">Movimientos y kardex basico</h3>
      <table data-testid="demo-movements"><thead><tr><th>Tipo</th><th>Cantidad</th><th>Delta</th><th>Motivo</th></tr></thead><tbody>${movementRows(data.movements)}</tbody></table>
    </section>
  </section>`;
}

function renderBi(data: DemoInventoryData): string {
  const dashboard = renderInventoryBiDashboard({
    role: data.role,
    status: "READY",
    summary: data.bi.summary,
    stockByCategory: data.bi.stockByCategory,
    expirationRisk: data.bi.expirationRisk,
    movementSummary: data.bi.movementSummary,
    alertsSummary: data.bi.alertsSummary,
  });
  return `<section aria-labelledby="olap-title">
    <p class="eyebrow">OLAP / BI</p>
    <h2 id="olap-title">Analitica de inventario para la exposicion</h2>
    ${dashboard}
  </section>`;
}

function renderDimensionalModel(): string {
  return `<section aria-labelledby="datamart-title" data-testid="datamart-model">
    <p class="eyebrow">Modelo dimensional / DataMart</p>
    <h2 id="datamart-title">Modelo estrella de inventario</h2>
    <div class="grid" role="list" aria-label="Dimensiones">
      ${["dim_tenant", "dim_product", "dim_category", "dim_unit", "dim_date"].map((dimension) => `<article class="metric" role="listitem"><span>Dimension</span><strong>${dimension}</strong></article>`).join("")}
    </div>
    <div class="grid" role="list" aria-label="Hechos">
      ${["fact_inventory_movement", "fact_stock_snapshot", "fact_expiration_risk", "fact_inventory_alert"].map((fact) => `<article class="metric" role="listitem"><span>Hecho</span><strong>${fact}</strong></article>`).join("")}
    </div>
    <p class="pill">Las dimensiones rodean los hechos de inventario para consultas OLAP por tenant, producto, categoria, unidad y fecha.</p>
  </section>`;
}

export function renderBodegiaMvpDemo(
  role: InventoryWebRole = "owner_admin",
): string {
  const data = createDemoInventoryData(role);
  const costNotice =
    role === "seller"
      ? "Vista seller: costos, valorizacion y perdidas estimadas permanecen ocultos."
      : "Vista administrativa: costos y valorizacion visibles para roles autorizados.";
  return `<div class="topbar">
    <div>
      <p class="eyebrow">Demo mode</p>
      <h1>BodegIA MVP</h1>
      <p>Bodega San Cristobal · demo local de inventario y BI sobre datos sinteticos.</p>
    </div>
    <label>Rol
      <select id="demo-role" aria-label="Rol demo">
        <option value="owner_admin"${role === "owner_admin" ? " selected" : ""}>owner_admin</option>
        <option value="inventory_manager"${role === "inventory_manager" ? " selected" : ""}>inventory_manager</option>
        <option value="seller"${role === "seller" ? " selected" : ""}>seller</option>
      </select>
    </label>
  </div>
  <section class="notice"><strong>Demo mode</strong><p>${escapeHtml(costNotice)}</p></section>
  <nav aria-label="Demo">
    <a href="#products">Productos</a>
    <a href="#lots">Lotes</a>
    <a href="#stock">Stock</a>
    <a href="#fefo">FEFO</a>
    <a href="#alerts">Alertas</a>
    <a href="#olap-title">BI/OLAP</a>
    <a href="#datamart-title">DataMart</a>
  </nav>
  ${renderOltp(data)}
  ${renderBi(data)}
  ${renderDimensionalModel()}`;
}
