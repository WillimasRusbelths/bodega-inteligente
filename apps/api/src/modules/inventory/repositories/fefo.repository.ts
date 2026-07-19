import type { Lot } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";

export class FefoRepository {
  public constructor(private readonly prisma: PrismaModule) {}

  public async candidates(
    context: TenantContext,
    productId: string,
  ): Promise<{
    readonly tenantTimeZone: string;
    readonly lots: readonly Lot[];
  }> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    return this.prisma.execute(async (client) => {
      const product = await client.product.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id: productId } },
        select: {
          id: true,
          status: true,
          tenant: { select: { operatingTimeZone: true } },
        },
      });
      if (product === null || product.status !== "ACTIVE")
        throw new TenantResourceNotFoundError();
      const lots = await client.lot.findMany({
        where: {
          tenantId: context.tenantId,
          productId,
          status: "AVAILABLE",
          availableQuantity: { gt: 0 },
        },
        orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
      });
      return { tenantTimeZone: product.tenant.operatingTimeZone, lots };
    });
  }

  public async productExists(
    context: TenantContext,
    productId: string,
  ): Promise<boolean> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    return this.prisma.execute(
      async (client) =>
        (await client.product.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id: productId } },
          select: { id: true },
        })) !== null,
    );
  }
}
