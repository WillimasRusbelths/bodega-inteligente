import type { Lot } from "@prisma/client";

export function serializeLot(
  lot: Lot,
  includeCost: boolean,
): Readonly<Record<string, unknown>> {
  return {
    id: lot.id,
    tenantId: lot.tenantId,
    productId: lot.productId,
    receivedAt: lot.receivedAt.toISOString(),
    expiresAt: lot.expiresAt.toISOString().slice(0, 10),
    initialQuantity: Number(lot.initialQuantity),
    availableQuantity: Number(lot.availableQuantity),
    status: lot.status,
    version: lot.version,
    createdAt: lot.createdAt.toISOString(),
    ...(includeCost ? { unitCost: Number(lot.unitCost) } : {}),
  };
}

export function serializeMovement(movement: {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly lotId: string;
  readonly type: string;
  readonly quantity: { toString(): string };
  readonly quantityDelta: { toString(): string };
  readonly balanceBefore: { toString(): string };
  readonly balanceAfter: { toString(): string };
  readonly reason: string;
  readonly actorId: string;
  readonly createdAt: Date;
}): Readonly<Record<string, unknown>> {
  return {
    id: movement.id,
    tenantId: movement.tenantId,
    productId: movement.productId,
    lotId: movement.lotId,
    type: movement.type,
    quantity: Number(movement.quantity.toString()),
    quantityDelta: Number(movement.quantityDelta.toString()),
    balanceBefore: Number(movement.balanceBefore.toString()),
    balanceAfter: Number(movement.balanceAfter.toString()),
    reason: movement.reason,
    actorId: movement.actorId,
    createdAt: movement.createdAt.toISOString(),
  };
}

export function serializeBalance(
  balance: {
    readonly tenantId: string;
    readonly productId: string;
    readonly lotId: string;
    readonly availableQuantity: { toString(): string };
  },
  unitCost?: { toString(): string },
): Readonly<Record<string, unknown>> {
  return {
    tenantId: balance.tenantId,
    productId: balance.productId,
    lotId: balance.lotId,
    availableQuantity: Number(balance.availableQuantity.toString()),
    ...(unitCost === undefined
      ? {}
      : { unitCost: Number(unitCost.toString()) }),
  };
}
