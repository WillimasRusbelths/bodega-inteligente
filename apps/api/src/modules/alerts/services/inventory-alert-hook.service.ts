import type { Prisma } from "@prisma/client";
import type { TenantContext } from "../../access/context/tenant-context.js";
import type { AlertService } from "./alert.service.js";

export class InventoryAlertHookService {
  public constructor(private readonly alerts: AlertService) {}

  public evaluate(
    transaction: Prisma.TransactionClient,
    context: TenantContext,
    productId: string,
    now: Date,
  ): Promise<void> {
    return this.alerts.evaluateInTransaction(
      transaction,
      context,
      productId,
      now,
    );
  }
}
