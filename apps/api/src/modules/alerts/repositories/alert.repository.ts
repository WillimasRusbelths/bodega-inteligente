import type { InventoryAlert, Prisma } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";

export interface AlertListQuery {
  readonly type?: "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED";
  readonly status?: "ACTIVE" | "RESOLVED";
  readonly categoryId?: string;
  readonly cursor?: string;
  readonly limit: number;
}

export class AlertRepository {
  public constructor(private readonly prisma: PrismaModule) {}

  public list(
    context: TenantContext,
    query: AlertListQuery,
  ): Promise<{
    readonly items: readonly InventoryAlert[];
    readonly nextCursor: string | null;
  }> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    const where: Prisma.InventoryAlertWhereInput = {
      tenantId: context.tenantId,
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.categoryId === undefined
        ? {}
        : { product: { categoryId: query.categoryId } }),
    };
    return this.prisma.execute(async (client) => {
      const rows = await client.inventoryAlert.findMany({
        where,
        orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
        ...(query.cursor === undefined
          ? {}
          : {
              cursor: {
                tenantId_id: { tenantId: context.tenantId, id: query.cursor },
              },
              skip: 1,
            }),
        take: query.limit + 1,
      });
      return {
        items: rows.slice(0, query.limit),
        nextCursor:
          rows.length > query.limit
            ? (rows[query.limit - 1]?.id ?? null)
            : null,
      };
    });
  }

  public async findById(
    context: TenantContext,
    alertId: string,
  ): Promise<InventoryAlert> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    const alert = await this.prisma.execute((client) =>
      client.inventoryAlert.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id: alertId } },
      }),
    );
    if (alert === null) throw new TenantResourceNotFoundError();
    return alert;
  }
}
