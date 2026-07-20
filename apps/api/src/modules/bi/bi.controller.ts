import type { TenantContext } from "../access/context/tenant-context.js";
import type { InventoryBiService } from "./inventory-bi.service.js";

/** HTTP-neutral controller for the five inventory BI projections. */
export class BiController {
  public constructor(private readonly service: InventoryBiService) {}

  public inventorySummary(context: TenantContext): Promise<unknown> {
    return this.service.getInventorySummary(context);
  }

  public stockByCategory(context: TenantContext): Promise<unknown> {
    return this.service.getStockByCategory(context);
  }

  public expirationRisk(context: TenantContext): Promise<unknown> {
    return this.service.getExpirationRisk(context);
  }

  public movementSummary(context: TenantContext): Promise<unknown> {
    return this.service.getMovementSummary(context);
  }

  public alertsSummary(context: TenantContext): Promise<unknown> {
    return this.service.getAlertsSummary(context);
  }
}
