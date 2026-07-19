import type { Lot } from "@prisma/client";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";
import type { FefoRepository } from "../repositories/fefo.repository.js";

export interface FefoSuggestionItem {
  readonly lotId: string;
  readonly expiresAt: string;
  readonly availableQuantity: number;
  readonly suggestedQuantity: number;
}

export function operationalDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year") ?? "0000"}-${values.get("month") ?? "00"}-${values.get("day") ?? "00"}`;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function orderFefoCandidates(
  lots: readonly Lot[],
  today: string,
  allowExpired = false,
): readonly Lot[] {
  return lots
    .filter(
      (lot) =>
        Number(lot.availableQuantity) > 0 &&
        lot.status === "AVAILABLE" &&
        (allowExpired || dateOnly(lot.expiresAt) >= today),
    )
    .sort(
      (left, right) =>
        left.expiresAt.getTime() - right.expiresAt.getTime() ||
        left.receivedAt.getTime() - right.receivedAt.getTime() ||
        left.id.localeCompare(right.id),
    );
}

export class FefoService {
  public constructor(private readonly repository: FefoRepository) {}

  public async suggest(
    context: TenantContext,
    productId: string,
    quantity: number,
  ): Promise<Readonly<Record<string, unknown>>> {
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error("The request is invalid.");
    if (
      !isTenantContext(context) ||
      !context.permissions.includes("inventory.stock.read")
    )
      throw new TenantSessionInvalidError();
    const result = await this.repository.candidates(context, productId);
    const today = operationalDate(new Date(), result.tenantTimeZone);
    const lots = orderFefoCandidates(result.lots, today);
    let remaining = quantity;
    const items: FefoSuggestionItem[] = [];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = Number(lot.availableQuantity);
      const suggested = Math.min(available, remaining);
      items.push({
        lotId: lot.id,
        expiresAt: dateOnly(lot.expiresAt),
        availableQuantity: available,
        suggestedQuantity: suggested,
      });
      remaining -= suggested;
    }
    return {
      productId,
      requestedQuantity: quantity,
      canFulfill: remaining <= 0,
      items,
    };
  }

  public authorizeExpiredAdjustment(
    context: TenantContext,
    lot: Pick<Lot, "expiresAt">,
    reason: string,
  ): void {
    if (!context.permissions.includes("inventory.stock.adjust"))
      throw new TenantResourceNotFoundError();
    if (reason.trim().length === 0) throw new Error("The request is invalid.");
    const today = operationalDate(new Date(), "America/Lima");
    if (dateOnly(lot.expiresAt) >= today)
      throw new Error("The request is invalid.");
    return;
  }
}
