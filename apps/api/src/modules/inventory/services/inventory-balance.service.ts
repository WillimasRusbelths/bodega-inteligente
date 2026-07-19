import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import { TenantSessionInvalidError } from "../../access/guards/authorization-errors.js";
import { serializeBalance } from "../../lots/dto/lot-response.dto.js";
import type { BalanceListQuery } from "../dto/movement.dto.js";
import { InventoryMutationError } from "./inventory-movement.service.js";

function admin(context: TenantContext): boolean {
  return (
    context.roles.includes("owner_admin") ||
    context.roles.includes("inventory_manager")
  );
}

export class InventoryBalanceService {
  public constructor(private readonly prisma: PrismaModule) {}
  public async list(
    context: TenantContext,
    query: BalanceListQuery,
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    if (!context.permissions.includes("inventory.stock.read"))
      throw new InventoryMutationError("INSUFFICIENT_PERMISSION");
    const rows = await this.prisma.execute((client) =>
      client.inventoryBalance.findMany({
        where: {
          tenantId: context.tenantId,
          ...(query.productId === undefined
            ? {}
            : { productId: query.productId }),
        },
        include: { lot: { select: { unitCost: true } } },
        orderBy: [{ productId: "asc" }, { lotId: "asc" }],
        take: query.limit + 1,
      }),
    );
    return {
      items: rows
        .slice(0, query.limit)
        .map((row) =>
          serializeBalance(row, admin(context) ? row.lot.unitCost : undefined),
        ),
      nextCursor:
        rows.length > query.limit
          ? (rows[query.limit - 1]?.lotId ?? null)
          : null,
    };
  }
}
