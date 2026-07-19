import type {
  InventoryMovement,
  InventoryMovementType,
  Prisma,
} from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";

export class MovementRepository {
  public constructor(private readonly prisma: PrismaModule) {}
  public async findById(
    context: TenantContext,
    id: string,
  ): Promise<InventoryMovement> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    const row = await this.prisma.execute((client) =>
      client.inventoryMovement.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
      }),
    );
    if (row === null) throw new TenantResourceNotFoundError();
    return row;
  }
  public list(
    context: TenantContext,
    options: {
      readonly productId?: string;
      readonly lotId?: string;
      readonly type?: InventoryMovementType;
      readonly cursor?: string;
      readonly limit: number;
    },
  ): Promise<InventoryMovement[]> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    const where: Prisma.InventoryMovementWhereInput = {
      tenantId: context.tenantId,
      ...(options.productId === undefined
        ? {}
        : { productId: options.productId }),
      ...(options.lotId === undefined ? {} : { lotId: options.lotId }),
      ...(options.type === undefined ? {} : { type: options.type }),
    };
    return this.prisma.execute((client) =>
      client.inventoryMovement.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(options.cursor === undefined
          ? {}
          : {
              cursor: {
                tenantId_id: { tenantId: context.tenantId, id: options.cursor },
              },
              skip: 1,
            }),
        take: options.limit + 1,
      }),
    );
  }
}
