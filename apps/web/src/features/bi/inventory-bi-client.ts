import type { WebApiClient } from "../../api/client.js";

export interface InventorySummary {
  readonly totalProducts: number;
  readonly totalStockAvailable: number;
  readonly lowStockProducts: number;
  readonly productsExpiringSoon: number;
  readonly productsExpired: number;
  readonly activeAlerts: number;
  readonly inventoryValuation?: number;
}
export interface StockByCategoryRow {
  readonly categoryId: string | null;
  readonly categoryName: string;
  readonly stockAvailable: number;
  readonly lowStockProducts: number;
  readonly inventoryValuation?: number;
}
export interface ExpirationRiskRow {
  readonly lotId: string;
  readonly productId: string;
  readonly productName: string;
  readonly categoryName: string | null;
  readonly expiresAt: string;
  readonly availableQuantity: number;
  readonly riskState: "EXPIRED" | "EXPIRING_SOON" | "OK";
  readonly estimatedLoss?: number;
}
export interface MovementSummaryRow {
  readonly type: string;
  readonly movementCount: number;
  readonly quantity: number;
}
export interface AlertSummaryRow {
  readonly type: string;
  readonly status: string;
  readonly alertCount: number;
}

function data<T>(value: unknown): T {
  if (value === null || typeof value !== "object")
    throw new Error("INVALID_API_RESPONSE");
  const record = value as Record<string, unknown>;
  return ("data" in record ? record["data"] : value) as T;
}

/** REST-only BI client. Tenant scope comes from the active context in WebApiClient. */
export class InventoryBiApi {
  public constructor(private readonly client: WebApiClient) {}

  public inventorySummary(): Promise<InventorySummary> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: "/tenants/current/bi/inventory-summary",
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<InventorySummary>);
  }
  public stockByCategory(): Promise<readonly StockByCategoryRow[]> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: "/tenants/current/bi/stock-by-category",
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<readonly StockByCategoryRow[]>);
  }
  public expirationRisk(): Promise<readonly ExpirationRiskRow[]> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: "/tenants/current/bi/expiration-risk",
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<readonly ExpirationRiskRow[]>);
  }
  public movementSummary(): Promise<readonly MovementSummaryRow[]> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: "/tenants/current/bi/movement-summary",
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<readonly MovementSummaryRow[]>);
  }
  public alertsSummary(): Promise<readonly AlertSummaryRow[]> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: "/tenants/current/bi/alerts-summary",
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<readonly AlertSummaryRow[]>);
  }
}
