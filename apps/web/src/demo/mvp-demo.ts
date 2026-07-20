import {
  operationalBalance,
  operationalLot,
  type InventoryAlert,
  type InventoryMovement,
  type InventoryWebRole,
  type Lot,
  type Product,
} from "../api/inventory-client.js";
import {
  createDemoInventoryData,
  type DemoInventoryData,
} from "./demo-data.js";

const roleLabels: Record<InventoryWebRole, string> = {
  owner_admin: "Due&ntilde;o administrador",
  inventory_manager: "Encargado de inventario",
  seller: "Vendedor",
};

const roleDescriptions: Record<InventoryWebRole, string> = {
  owner_admin: "Gestion completa, costos, valorizacion y BI completo.",
  inventory_manager: "Control operativo de lotes, stock, alertas y FEFO.",
  seller: "Consulta rapida de productos, stock y alertas basicas.",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: number): string {
  return `S/ ${value.toFixed(2)}`;
}

function canSeeValuation(role: InventoryWebRole): boolean {
  return role !== "seller";
}

function badge(value: string): string {
  return `<span class="status-badge status-${escapeHtml(value.toLowerCase())}">${escapeHtml(value)}</span>`;
}

function metricCard(
  label: string,
  value: string | number,
  tone = "neutral",
): string {
  return `<article class="kpi-card kpi-${tone}"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`;
}

function progressBar(label: string, value: number, max: number): string {
  const width = max <= 0 ? 0 : Math.round((value / max) * 100);
  return `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><strong>${value}</strong></div>`;
}

export function renderDemoLogin(
  role: InventoryWebRole = "owner_admin",
): string {
  const cards = (Object.keys(roleLabels) as InventoryWebRole[])
    .map(
      (
        candidate,
      ) => `<label class="login-role-card${candidate === role ? " is-selected" : ""}">
        <input type="radio" name="demo-role-card" value="${candidate}"${candidate === role ? " checked" : ""} />
        <span>${roleLabels[candidate]}</span>
        <small>${escapeHtml(roleDescriptions[candidate])}</small>
      </label>`,
    )
    .join("");
  return `<main class="login-screen" data-testid="demo-login">
    <section class="login-panel" aria-labelledby="login-title">
      <span class="mode-label">Modo demo</span>
      <h1 id="login-title">BodegIA</h1>
      <p class="login-subtitle">Plataforma inteligente para bodegas familiares</p>
      <p class="login-copy">MVP web administrativo y anal&iacute;tico</p>
      <div class="login-roles" role="radiogroup" aria-label="Usuario demo">${cards}</div>
      <button class="primary-action" id="enter-dashboard" type="button">Entrar al dashboard</button>
      <p class="login-note">El acceso por rol es simulado para la presentaci&oacute;n del MVP.</p>
    </section>
  </main>`;
}

function renderTopbar(data: DemoInventoryData): string {
  const sellerNotice =
    data.role === "seller"
      ? '<span class="privacy-chip">Vista operativa: costos protegidos</span>'
      : '<span class="privacy-chip">Costos visibles para rol autorizado</span>';
  return `<header class="app-topbar">
    <div>
      <span class="mode-label">Modo demo</span>
      <h1>BodegIA MVP</h1>
      <p>Bodega San Crist&oacute;bal &middot; ${roleLabels[data.role]} &middot; Sistema operativo</p>
    </div>
    <div class="topbar-actions">
      ${sellerNotice}
      <button id="change-demo-user" class="secondary-action" type="button">Cambiar usuario demo</button>
    </div>
  </header>`;
}

function renderSidebar(): string {
  const links = [
    ["#inicio", "Inicio"],
    ["#oltp", "Operacion OLTP"],
    ["#warehouse", "Data Warehouse"],
    ["#bi", "BI/OLAP"],
    ["#roles", "Roles"],
    ["#roadmap", "Roadmap"],
  ];
  return `<aside class="sidebar" aria-label="Navegacion principal">
    <div class="brand-block"><strong>BodegIA</strong><span>Inventario MVP</span></div>
    <nav>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</nav>
  </aside>`;
}

function renderExecutiveSummary(data: DemoInventoryData): string {
  const summary = data.bi.summary;
  const valuation = canSeeValuation(data.role)
    ? metricCard(
        "Valorizacion",
        money(summary.inventoryValuation ?? 0),
        "money",
      )
    : "";
  return `<section id="inicio" class="panel" aria-labelledby="inicio-title">
    <div class="section-heading"><span class="eyebrow">Inicio</span><h2 id="inicio-title">Resumen ejecutivo</h2><p>Indicadores principales para decidir que revisar primero.</p></div>
    <div class="kpi-grid">
      ${metricCard("Total de productos", summary.totalProducts)}
      ${metricCard("Stock disponible", summary.totalStockAvailable)}
      ${metricCard("Stock bajo", summary.lowStockProducts, "warning")}
      ${metricCard("Proximos a vencer", summary.productsExpiringSoon, "warning")}
      ${metricCard("Vencidos", summary.productsExpired, "danger")}
      ${metricCard("Alertas activas", summary.activeAlerts, "danger")}
      ${valuation}
    </div>
  </section>`;
}

function productRows(products: readonly Product[]): string {
  return products
    .map(
      (product) =>
        `<tr><td><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku ?? "Sin SKU")}</small></td><td>${escapeHtml(product.category?.name ?? "Sin categoria")}</td><td>${product.availableStock ?? 0}</td><td>${badge(product.status)}</td></tr>`,
    )
    .join("");
}

function lotRows(lots: readonly Lot[], role: InventoryWebRole): string {
  return lots
    .map((lot) => {
      const cost = canSeeValuation(role)
        ? `<td>${money(lot.unitCost ?? 0)}</td>`
        : "";
      return `<tr><td>${lot.id.slice(-6)}</td><td>${escapeHtml(lot.expiresAt)}</td><td>${lot.availableQuantity}</td><td>${badge(lot.status)}</td>${cost}</tr>`;
    })
    .join("");
}

function movementRows(movements: readonly InventoryMovement[]): string {
  return movements
    .map(
      (movement) =>
        `<tr><td>${badge(movement.type)}</td><td>${movement.quantity}</td><td>${movement.quantityDelta}</td><td>${escapeHtml(movement.reason)}</td></tr>`,
    )
    .join("");
}

function alertRows(alerts: readonly InventoryAlert[]): string {
  return alerts
    .map(
      (alert) =>
        `<tr><td>${badge(alert.type)}</td><td>${badge(alert.status)}</td><td>${alert.observedValue}</td><td>${alert.thresholdValue}</td></tr>`,
    )
    .join("");
}

function renderOltp(data: DemoInventoryData): string {
  const lots = data.lots.map((lot) => operationalLot(lot, data.role));
  const balances = data.balances.map((balance) =>
    operationalBalance(balance, data.role),
  );
  const categories = new Set(
    data.products.map((product) => product.category?.name ?? "Sin categoria"),
  );
  const costHeader = canSeeValuation(data.role) ? "<th>Costo</th>" : "";
  return `<section id="oltp" class="panel" aria-labelledby="oltp-title">
    <div class="section-heading"><span class="eyebrow">Operacion OLTP</span><h2 id="oltp-title">Operacion diaria de inventario</h2><p>OLTP registra las operaciones diarias de la bodega.</p></div>
    <div class="summary-strip">
      <span>${data.products.length} productos</span>
      <span>${categories.size} categorias</span>
      <span>${lots.length} lotes</span>
      <span>${balances.length} registros de stock</span>
      <span>${data.alerts.length} alertas</span>
      <span>FEFO activo</span>
    </div>
    <div class="content-grid two-columns">
      <article class="card"><h3>Productos</h3><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Categoria</th><th>Stock</th><th>Estado</th></tr></thead><tbody>${productRows(data.products)}</tbody></table></div></article>
      <article class="card"><h3>Lotes y vencimientos</h3><div class="table-wrap"><table><thead><tr><th>Lote</th><th>Vence</th><th>Stock</th><th>Estado</th>${costHeader}</tr></thead><tbody>${lotRows(data.lots, data.role)}</tbody></table></div></article>
      <article class="card"><h3>Movimientos / Kardex</h3><div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Cantidad</th><th>Delta</th><th>Motivo</th></tr></thead><tbody>${movementRows(data.movements)}</tbody></table></div></article>
      <article class="card"><h3>Alertas y FEFO</h3><div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Estado</th><th>Valor</th><th>Umbral</th></tr></thead><tbody>${alertRows(data.alerts)}</tbody></table></div><div class="fefo-box"><span>Sugerencia FEFO</span><strong>${data.fefo.items[0]?.suggestedQuantity ?? 0} unidades</strong><small>Lote ${escapeHtml(data.fefo.items[0]?.lotId.slice(-6) ?? "N/D")} vence ${escapeHtml(data.fefo.items[0]?.expiresAt ?? "N/D")}</small></div></article>
    </div>
  </section>`;
}

function renderWarehouse(): string {
  const dimensions = [
    "dw.dim_tenant",
    "dw.dim_product",
    "dw.dim_category",
    "dw.dim_unit",
    "dw.dim_date",
  ];
  const facts = [
    "dw.fact_inventory_movement",
    "dw.fact_stock_snapshot",
    "dw.fact_expiration_risk",
    "dw.fact_inventory_alert",
  ];
  const sources = [
    "public.products",
    "public.inventory_lots",
    "public.inventory_movements",
    "public.inventory_balances",
    "public.inventory_alerts",
  ];
  return `<section id="warehouse" class="panel" aria-labelledby="warehouse-title">
    <div class="section-heading"><span class="eyebrow">Data Warehouse</span><h2 id="warehouse-title">Data Warehouse / DataMart de Inventario</h2><p>El MVP implementa el DataMart de Inventario. Los DataMarts de ventas, clientes, compras y rentabilidad quedan como roadmap del sistema final.</p></div>
    <div class="flow"><span>OLTP</span><strong>DataMart dw</strong><span>OLAP/BI</span><strong>Dashboard</strong></div>
    <div class="star-model" data-testid="datamart-model">
      <div class="source-list"><h3>Fuente OLTP</h3>${sources.map((source) => `<span>${source}</span>`).join("")}</div>
      <div class="dimension-ring" aria-label="Dimensiones">${dimensions.map((dimension) => `<span>${dimension}</span>`).join("")}</div>
      <div class="fact-core" aria-label="Hechos">${facts.map((fact) => `<strong>${fact}</strong>`).join("")}</div>
    </div>
  </section>`;
}

function renderBi(data: DemoInventoryData): string {
  const maxStock = Math.max(
    ...data.bi.stockByCategory.map((row) => row.stockAvailable),
    1,
  );
  const maxMovement = Math.max(
    ...data.bi.movementSummary.map((row) => row.quantity),
    1,
  );
  const valuation = canSeeValuation(data.role)
    ? metricCard(
        "Valorizacion BI",
        money(data.bi.summary.inventoryValuation ?? 0),
        "money",
      )
    : "";
  const riskRows = data.bi.expirationRisk
    .map((row) => {
      const loss = canSeeValuation(data.role)
        ? `<td>${money(row.estimatedLoss ?? 0)}</td>`
        : "";
      return `<tr><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.expiresAt)}</td><td>${row.availableQuantity}</td><td>${badge(row.riskState)}</td>${loss}</tr>`;
    })
    .join("");
  const lossHeader = canSeeValuation(data.role)
    ? "<th>Perdida estimada</th>"
    : "";
  return `<section id="bi" class="panel" aria-labelledby="bi-title">
    <div class="section-heading"><span class="eyebrow">BI/OLAP</span><h2 id="bi-title">Dashboard analitico de inventario</h2><p>OLAP permite analizar datos agregados para tomar decisiones.</p></div>
    <div class="kpi-grid compact">
      ${metricCard("Productos", data.bi.summary.totalProducts)}
      ${metricCard("Stock disponible", data.bi.summary.totalStockAvailable)}
      ${metricCard("Stock bajo", data.bi.summary.lowStockProducts, "warning")}
      ${metricCard("Vencidos", data.bi.summary.productsExpired, "danger")}
      ${valuation}
    </div>
    <div class="content-grid two-columns">
      <article class="card"><h3>Stock por categoria</h3>${data.bi.stockByCategory.map((row) => progressBar(row.categoryName, row.stockAvailable, maxStock)).join("")}</article>
      <article class="card"><h3>Movimientos por tipo</h3>${data.bi.movementSummary.map((row) => progressBar(row.type, row.quantity, maxMovement)).join("")}</article>
      <article class="card"><h3>Riesgo de vencimiento</h3><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Vence</th><th>Stock</th><th>Estado</th>${lossHeader}</tr></thead><tbody>${riskRows}</tbody></table></div></article>
      <article class="card"><h3>Alertas por tipo y estado</h3>${data.bi.alertsSummary.map((row) => `<div class="alert-summary"><span>${badge(row.type)} ${badge(row.status)}</span><strong>${row.alertCount}</strong></div>`).join("")}</article>
    </div>
  </section>`;
}

function renderRoles(): string {
  const roles = [
    [
      "Due&ntilde;o administrador",
      "Gestion completa; costos; valorizacion; BI completo.",
    ],
    [
      "Encargado de inventario",
      "Control operativo; lotes; stock; alertas; FEFO.",
    ],
    ["Vendedor", "Consulta operativa; atencion rapida; costos protegidos."],
  ];
  return `<section id="roles" class="panel" aria-labelledby="roles-title">
    <div class="section-heading"><span class="eyebrow">Roles</span><h2 id="roles-title">Acceso visible por rol demo</h2></div>
    <div class="role-grid">${roles.map(([title, copy]) => `<article class="card"><h3>${title}</h3><p>${copy}</p></article>`).join("")}</div>
  </section>`;
}

function renderRoadmap(): string {
  const items = [
    "APK Android",
    "Login real",
    "Escaneo QR/codigo de barras",
    "OCR de vencimientos",
    "Ventas rapidas",
    "Clientes",
    "Proveedores",
    "Compras/reabastecimiento",
    "Promociones",
    "Recomendacion de precios",
    "DataMart de Ventas",
    "DataMart de Clientes",
    "DataMart de Compras",
    "DataMart Financiero/Rentabilidad",
  ];
  return `<section id="roadmap" class="panel" aria-labelledby="roadmap-title">
    <div class="section-heading"><span class="eyebrow">Roadmap</span><h2 id="roadmap-title">Sistema final planificado</h2><p>Estos elementos son futuros, no funcionalidades implementadas en la demo actual.</p></div>
    <div class="roadmap-grid">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
  </section>`;
}

export function renderBodegiaDashboard(
  role: InventoryWebRole = "owner_admin",
): string {
  const data = createDemoInventoryData(role);
  return `<div class="app-shell" data-testid="demo-dashboard" data-role="${role}">
    ${renderSidebar()}
    <main class="dashboard-main">
      ${renderTopbar(data)}
      ${renderExecutiveSummary(data)}
      ${renderOltp(data)}
      ${renderWarehouse()}
      ${renderBi(data)}
      ${renderRoles()}
      ${renderRoadmap()}
    </main>
  </div>`;
}

export function renderBodegiaMvpDemo(
  role: InventoryWebRole = "owner_admin",
): string {
  return renderBodegiaDashboard(role);
}
