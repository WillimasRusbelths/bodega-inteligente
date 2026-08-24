import {
  operationalBalance,
  operationalLot,
  type InventoryAlert,
  type InventoryMovement,
  type InventoryWebRole,
  type Lot,
  type Product,
} from "../api/inventory-client.js";
import type {
  AlertSummaryRow,
  ExpirationRiskRow,
  InventorySummary,
  MovementSummaryRow,
  StockByCategoryRow,
} from "../features/bi/inventory-bi-client.js";

export interface DemoTenantSession {
  readonly id: string;
  readonly name: string;
  readonly locationText: string | null;
  readonly currencyCode: string;
  readonly referenceSchedule: string | null;
  readonly status: string;
}

export interface DemoUserSession {
  readonly id: string;
  readonly displayName: string;
  readonly phoneE164: string;
}

export interface DemoMembershipSession {
  readonly id: string;
  readonly status: string;
  readonly role: InventoryWebRole;
}

export interface DemoEmployee {
  readonly id: string;
  readonly displayName: string;
  readonly phoneE164: string;
  readonly role: string;
  readonly status: string;
  readonly tenantId: string;
}

export interface DemoWebSession {
  readonly sessionId: string;
  readonly user: DemoUserSession;
  readonly tenant: DemoTenantSession;
  readonly membership: DemoMembershipSession;
  readonly employees?: readonly DemoEmployee[];
}

export interface QuickSaleProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly status: string;
  readonly salePrice: number;
  readonly availableStock: number;
}

export interface QuickSaleHistoryItem {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly lotId: string | null;
  readonly expiresAt: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
}

export interface QuickSaleRecord {
  readonly id: string;
  readonly saleNumber: string;
  readonly status: string;
  readonly subtotal: number;
  readonly total: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly items: readonly QuickSaleHistoryItem[];
}

export interface QuickSalesDashboardData {
  readonly products: readonly QuickSaleProduct[];
  readonly sales: readonly QuickSaleRecord[];
}

/** Data received from existing tenant-scoped API reads, never from a fixture. */
export interface OperationalDashboardData {
  readonly role: InventoryWebRole;
  readonly products: readonly Product[];
  readonly lots: readonly Lot[];
  readonly balances: readonly import("../api/inventory-client.js").InventoryBalance[];
  readonly movements: readonly InventoryMovement[];
  readonly alerts: readonly InventoryAlert[];
  readonly fefo: import("../api/inventory-client.js").FefoResult;
  readonly bi: {
    readonly summary: InventorySummary;
    readonly stockByCategory: readonly StockByCategoryRow[];
    readonly expirationRisk: readonly ExpirationRiskRow[];
    readonly movementSummary: readonly MovementSummaryRow[];
    readonly alertsSummary: readonly AlertSummaryRow[];
  };
}

export const demoCredentials: Record<
  InventoryWebRole,
  { readonly username: string; readonly pin: string }
> = {
  owner_admin: { username: "propietario", pin: "100001" },
  inventory_manager: { username: "inventario", pin: "100002" },
  seller: { username: "vendedor", pin: "100003" },
};

const roleLabels: Record<InventoryWebRole, string> = {
  owner_admin: "Due&ntilde;o administrador",
  inventory_manager: "Encargado de inventario",
  seller: "Vendedor",
};

const roleDescriptions: Record<InventoryWebRole, string> = {
  owner_admin: "Gestion completa, costos, valorizacion, bodega y empleados.",
  inventory_manager: "Control operativo de lotes, stock, alertas y FEFO.",
  seller: "Consulta rapida de productos y stock sin costos.",
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

function canManageTenant(role: InventoryWebRole): boolean {
  return role === "owner_admin";
}

function canSell(role: InventoryWebRole): boolean {
  return (
    role === "owner_admin" || role === "inventory_manager" || role === "seller"
  );
}

function defaultSession(role: InventoryWebRole): DemoWebSession {
  const credentials = demoCredentials[role];
  return {
    sessionId: `demo-web-session-${role}`,
    user: {
      id: `demo-user-${role}`,
      displayName:
        role === "owner_admin"
          ? "Propietario demo"
          : role === "inventory_manager"
            ? "Encargado demo"
            : "Vendedor demo",
      phoneE164:
        role === "owner_admin"
          ? "+51900000001"
          : role === "inventory_manager"
            ? "+51900000002"
            : "+51900000003",
    },
    tenant: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Bodega San Cristobal",
      locationText: "Ayacucho, Peru",
      currencyCode: "PEN",
      referenceSchedule: "Lunes a domingo, 7:00 a 22:00",
      status: "ACTIVE",
    },
    membership: {
      id: `demo-membership-${credentials.username}`,
      status: "ACTIVE",
      role,
    },
    employees: [
      {
        id: "demo-employee-owner",
        displayName: "Propietario demo",
        phoneE164: "+51900000001",
        role: "owner_admin",
        status: "ACTIVE",
        tenantId: "00000000-0000-4000-8000-000000000001",
      },
      {
        id: "demo-employee-inventory",
        displayName: "Encargado demo",
        phoneE164: "+51900000002",
        role: "inventory_manager",
        status: "ACTIVE",
        tenantId: "00000000-0000-4000-8000-000000000001",
      },
      {
        id: "demo-employee-seller",
        displayName: "Vendedor demo",
        phoneE164: "+51900000003",
        role: "seller",
        status: "ACTIVE",
        tenantId: "00000000-0000-4000-8000-000000000001",
      },
    ],
  };
}

function emptyQuickSalesData(): QuickSalesDashboardData { return { products: [], sales: [] }; }

export function emptyOperationalDashboardData(role: InventoryWebRole): OperationalDashboardData {
  return {
    role, products: [], lots: [], balances: [], movements: [], alerts: [],
    fefo: { productId: "", requestedQuantity: 0, canFulfill: false, items: [] },
    bi: {
      summary: { totalProducts: 0, totalStockAvailable: 0, lowStockProducts: 0, productsExpiringSoon: 0, productsExpired: 0, activeAlerts: 0 },
      stockByCategory: [], expirationRisk: [], movementSummary: [], alertsSummary: [],
    },
  };
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

function roleLabel(role: string): string {
  return role === "owner_admin" ||
    role === "inventory_manager" ||
    role === "seller"
    ? roleLabels[role]
    : escapeHtml(role);
}

export function renderDemoLogin(
  role: InventoryWebRole = "owner_admin",
): string {
  const cards = (Object.keys(roleLabels) as InventoryWebRole[])
    .map((candidate) => {
      const credentials = demoCredentials[candidate];
      return `<label class="login-role-card${candidate === role ? " is-selected" : ""}">
        <input type="radio" name="demo-role-card" value="${candidate}"${candidate === role ? " checked" : ""} data-username="${credentials.username}" data-pin="${credentials.pin}" />
        <span>${roleLabels[candidate]}</span>
        <small>${escapeHtml(roleDescriptions[candidate])}</small>
      </label>`;
    })
    .join("");
  const credentials = demoCredentials[role];
  return `<main class="login-screen" data-testid="demo-login">
    <section class="login-panel" aria-labelledby="login-title">
      <span class="mode-label">Modo demo seguro</span>
      <h1 id="login-title">BodegIA</h1>
      <p class="login-subtitle">Plataforma inteligente para bodegas familiares</p>
      <p class="login-copy">MVP web con login funcional, bodega activa, roles e inventario.</p>
      <div class="login-roles" role="radiogroup" aria-label="Usuario demo">${cards}</div>
      <form id="demo-login-form" class="login-form">
        <label>Usuario demo<input id="demo-username" name="username" value="${credentials.username}" autocomplete="username" /></label>
        <label>PIN demo<input id="demo-pin" name="pin" value="${credentials.pin}" inputmode="numeric" maxlength="6" autocomplete="one-time-code" /></label>
        <button class="primary-action" id="enter-dashboard" type="submit">Iniciar sesi&oacute;n</button>
        <p id="login-error" class="form-error" role="alert"></p>
      </form>
      <p class="login-note">Credenciales sint&eacute;ticas para PostgreSQL local: propietario/100001, inventario/100002 y vendedor/100003. Deshabilitado en producci&oacute;n.</p>
    </section>
  </main>`;
}

function renderTopbar(role: InventoryWebRole, session: DemoWebSession): string {
  const sellerNotice =
    role === "seller"
      ? '<span class="privacy-chip">Vista operativa: costos protegidos</span>'
      : '<span class="privacy-chip">Costos visibles para rol autorizado</span>';
  return `<header class="app-topbar">
    <div>
      <span class="mode-label">Sesi&oacute;n MVP web</span>
      <h1>BodegIA MVP</h1>
      <p>${escapeHtml(session.tenant.name)} &middot; ${roleLabels[role]} &middot; ${escapeHtml(session.tenant.status)}</p>
    </div>
    <div class="topbar-actions">
      ${sellerNotice}
      <span class="session-chip">Usuario: ${escapeHtml(session.user.displayName)}</span>
      <button id="logout-demo-user" class="secondary-action" type="button">Cerrar sesi&oacute;n</button>
    </div>
  </header>`;
}

function renderSidebar(): string {
  const links = [
    ["#inicio", "Inicio"],
    ["#configuracion", "Configuracion de bodega"],
    ["#empleados", "Empleados y roles"],
    ["#ventas", "Ventas rapidas"],
    ["#oltp", "Operacion OLTP"],
    ["#warehouse", "Data Warehouse"],
    ["#bi", "BI/OLAP"],
    ["#roles", "Permisos"],
    ["#roadmap", "Roadmap"],
  ];
  return `<aside class="sidebar" aria-label="Navegacion principal">
    <div class="brand-block"><strong>BodegIA</strong><span>Inventario MVP</span></div>
    <nav>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</nav>
  </aside>`;
}

function renderExecutiveSummary(data: OperationalDashboardData): string {
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

function renderTenantSettings(session: DemoWebSession): string {
  const role = session.membership.role;
  if (!canManageTenant(role)) {
    return `<section id="configuracion" class="panel locked-panel" aria-labelledby="configuracion-title">
      <div class="section-heading"><span class="eyebrow">Configuracion</span><h2 id="configuracion-title">Configuraci&oacute;n de bodega</h2><p>Tu rol puede operar inventario, pero no administrar la configuraci&oacute;n de la bodega.</p></div>
      <p class="permission-note">Acceso reservado para due&ntilde;o administrador.</p>
    </section>`;
  }
  return `<section id="configuracion" class="panel" aria-labelledby="configuracion-title">
    <div class="section-heading"><span class="eyebrow">Configuracion</span><h2 id="configuracion-title">Configuraci&oacute;n de bodega</h2><p>Actualizaci&oacute;n MVP tenant-scoped de la bodega activa.</p></div>
    <form id="tenant-settings-form" class="settings-form">
      <label>Nombre de bodega<input name="name" value="${escapeHtml(session.tenant.name)}" maxlength="160" /></label>
      <label>Ubicaci&oacute;n textual<input name="locationText" value="${escapeHtml(session.tenant.locationText ?? "")}" maxlength="240" /></label>
      <label>Moneda<input name="currencyCode" value="${escapeHtml(session.tenant.currencyCode)}" maxlength="3" /></label>
      <label>Horario referencial<input name="referenceSchedule" value="${escapeHtml(session.tenant.referenceSchedule ?? "")}" maxlength="160" /></label>
      <label>Estado<select name="status"><option value="ACTIVE"${session.tenant.status === "ACTIVE" ? " selected" : ""}>Activo</option><option value="DISABLED"${session.tenant.status === "DISABLED" ? " selected" : ""}>Inactivo</option></select></label>
      <button class="primary-action" type="submit">Guardar configuraci&oacute;n</button>
      <p id="settings-result" class="form-status" role="status"></p>
    </form>
  </section>`;
}

function employeeRows(employees: readonly DemoEmployee[]): string {
  return employees
    .map(
      (employee) =>
        `<tr><td><strong>${escapeHtml(employee.displayName)}</strong><small>${escapeHtml(employee.phoneE164)}</small></td><td>${roleLabel(employee.role)}</td><td>${badge(employee.status)}</td><td>${escapeHtml(employee.tenantId.slice(-6))}</td></tr>`,
    )
    .join("");
}

function renderEmployees(session: DemoWebSession): string {
  if (!canManageTenant(session.membership.role)) {
    return `<section id="empleados" class="panel locked-panel" aria-labelledby="empleados-title">
      <div class="section-heading"><span class="eyebrow">Equipo</span><h2 id="empleados-title">Empleados y roles</h2><p>La administraci&oacute;n de empleados est&aacute; protegida por RBAC.</p></div>
      <p class="permission-note">Solo el due&ntilde;o administrador puede ver y administrar empleados.</p>
    </section>`;
  }
  const employees =
    session.employees ?? defaultSession("owner_admin").employees ?? [];
  return `<section id="empleados" class="panel" aria-labelledby="empleados-title">
    <div class="section-heading"><span class="eyebrow">Equipo</span><h2 id="empleados-title">Empleados y roles</h2><p>Empleados demo asociados a la bodega activa.</p></div>
    <div class="table-wrap"><table><thead><tr><th>Empleado</th><th>Rol</th><th>Estado</th><th>Bodega</th></tr></thead><tbody>${employeeRows(employees)}</tbody></table></div>
    <p class="permission-note">La creaci&oacute;n avanzada de empleados queda para el flujo administrativo completo; esta vista lista memberships reales del seed demo.</p>
  </section>`;
}

function quickSaleProductOptions(
  products: readonly QuickSaleProduct[],
): string {
  return products
    .map(
      (product) =>
        `<option value="${escapeHtml(product.id)}" data-price="${product.salePrice}" data-stock="${product.availableStock}">${escapeHtml(product.name)} &middot; stock ${product.availableStock} &middot; ${money(product.salePrice)}</option>`,
    )
    .join("");
}

function quickSaleHistoryRows(sales: readonly QuickSaleRecord[]): string {
  if (sales.length === 0) {
    return `<tr><td colspan="5">Aun no hay ventas registradas en esta sesion demo.</td></tr>`;
  }
  return sales
    .map((sale) => {
      const productNames = [
        ...new Set(sale.items.map((item) => item.productName)),
      ].join(", ");
      const quantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);
      return `<tr><td><strong>${escapeHtml(sale.saleNumber)}</strong><small>${escapeHtml(new Date(sale.createdAt).toLocaleString("es-PE"))}</small></td><td>${escapeHtml(productNames)}</td><td>${quantity}</td><td>${money(sale.total)}</td><td>${badge(sale.status)}</td></tr>`;
    })
    .join("");
}

function renderQuickSales(
  session: DemoWebSession,
  salesData: QuickSalesDashboardData,
): string {
  if (!canSell(session.membership.role)) {
    return `<section id="ventas" class="panel locked-panel" aria-labelledby="ventas-title">
      <div class="section-heading"><span class="eyebrow">Ventas</span><h2 id="ventas-title">Ventas r&aacute;pidas</h2><p>Tu rol actual no puede registrar ventas.</p></div>
    </section>`;
  }
  const firstProduct = salesData.products[0];
  return `<section id="ventas" class="panel" aria-labelledby="ventas-title">
    <div class="section-heading"><span class="eyebrow">Ventas</span><h2 id="ventas-title">Ventas r&aacute;pidas</h2><p>Flujo MVP: seleccionar producto, cantidad, precio, descontar stock por FEFO y guardar historial.</p></div>
    <div class="content-grid two-columns">
      <article class="card">
        <h3>Registrar venta</h3>
        <form id="quick-sale-form" class="settings-form">
          <label>Producto<select name="productId" id="quick-sale-product">${quickSaleProductOptions(salesData.products)}</select></label>
          <label>Stock disponible<input id="quick-sale-stock" value="${firstProduct?.availableStock ?? 0}" readonly /></label>
          <label>Cantidad<input name="quantity" id="quick-sale-quantity" type="number" min="1" step="1" value="1" /></label>
          <label>Precio de venta<input name="unitPrice" id="quick-sale-price" type="number" min="0" step="0.01" value="${firstProduct?.salePrice ?? 0}" /></label>
          <label>Total<input id="quick-sale-total" value="${money(firstProduct?.salePrice ?? 0)}" readonly /></label>
          <button class="primary-action" type="submit">Registrar venta</button>
          <p id="quick-sale-result" class="form-status" role="status"></p>
        </form>
      </article>
      <article class="card">
        <h3>Historial de ventas</h3>
        <div class="table-wrap"><table><thead><tr><th>Venta</th><th>Producto</th><th>Cantidad</th><th>Total</th><th>Estado</th></tr></thead><tbody>${quickSaleHistoryRows(salesData.sales)}</tbody></table></div>
      </article>
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

function renderOltp(data: OperationalDashboardData): string {
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

function renderBi(data: OperationalDashboardData): string {
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
      "Gestion completa; configuracion de bodega; empleados; costos; valorizacion; BI completo.",
    ],
    [
      "Encargado de inventario",
      "Control operativo; lotes; stock; alertas; FEFO; sin administracion de empleados.",
    ],
    [
      "Vendedor",
      "Consulta productos y stock; costos, valorizacion y configuracion protegidos.",
    ],
  ];
  return `<section id="roles" class="panel" aria-labelledby="roles-title">
    <div class="section-heading"><span class="eyebrow">Permisos</span><h2 id="roles-title">Acceso visible por rol demo</h2></div>
    <div class="role-grid">${roles.map(([title, copy]) => `<article class="card"><h3>${title}</h3><p>${copy}</p></article>`).join("")}</div>
  </section>`;
}

function renderRoadmap(): string {
  const items = [
    "APK Android",
    "Login productivo hardening",
    "Escaneo QR/codigo de barras",
    "OCR de vencimientos",
    "Ventas avanzadas y pagos complejos",
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
  session: DemoWebSession = defaultSession(role),
  salesData: QuickSalesDashboardData = emptyQuickSalesData(),
  operationalData: OperationalDashboardData = emptyOperationalDashboardData(role),
): string {
  return `<div class="app-shell" data-testid="demo-dashboard" data-role="${role}" data-session="${escapeHtml(session.sessionId)}">
    ${renderSidebar()}
    <main class="dashboard-main">
      ${renderTopbar(operationalData.role, session)}
      ${renderExecutiveSummary(operationalData)}
      ${renderTenantSettings(session)}
      ${renderEmployees(session)}
      ${renderQuickSales(session, salesData)}
      ${renderOltp(operationalData)}
      ${renderWarehouse()}
      ${renderBi(operationalData)}
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
