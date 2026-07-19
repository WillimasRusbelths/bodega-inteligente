import type { InventoryAlert } from "@prisma/client";

export function serializeAlert(
  alert: InventoryAlert,
): Readonly<Record<string, unknown>> {
  return {
    id: alert.id,
    tenantId: alert.tenantId,
    productId: alert.productId,
    lotId: alert.lotId,
    type: alert.type,
    status: alert.status,
    observedValue: Number(alert.observedValue),
    thresholdValue: Number(alert.thresholdValue),
    triggeredAt: alert.triggeredAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
  };
}
