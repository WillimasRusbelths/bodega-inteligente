import type { InventoryBalance, Prisma } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import { TenantSessionInvalidError } from "../../access/guards/authorization-errors.js";

export class BalanceRepository {
  public constructor(private readonly prisma: PrismaModule) {}
  public list(
    context: TenantContext,
    options: { readonly productId?: string; readonly limit: number },
  ): Promise<InventoryBalance[]> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    const where: Prisma.InventoryBalanceWhereInput = {
      tenantId: context.tenantId,
      ...(options.productId === undefined
        ? {}
        : { productId: options.productId }),
    };
    return this.prisma.execute((client) =>
      client.inventoryBalance.findMany({
        where,
        orderBy: [{ productId: "asc" }, { lotId: "asc" }],
        take: options.limit + 1,
      }),
    );
  }
}
