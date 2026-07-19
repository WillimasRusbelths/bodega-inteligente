import { LotStatus, type Prisma, type Lot } from "@prisma/client";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

export interface LotCreateInput {
  readonly productId: string;
  readonly receivedAt: Date;
  readonly expiresAt: Date;
  readonly initialQuantity: number;
  readonly availableQuantity?: number;
  readonly unitCost: number;
  readonly status?: LotStatus;
  readonly createdBy: string;
}
export interface LotUpdateInput {
  readonly availableQuantity?: number;
  readonly status?: LotStatus;
  readonly version?: number;
}
function requireTenant(context: TenantContext): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
}

export class LotRepository {
  public constructor(private readonly prisma: PrismaModule) {}
  public create(context: TenantContext, input: LotCreateInput): Promise<Lot> {
    requireTenant(context);
    return this.prisma.execute((client) =>
      client.lot.create({
        data: {
          tenantId: context.tenantId,
          productId: input.productId,
          receivedAt: input.receivedAt,
          expiresAt: input.expiresAt,
          initialQuantity: input.initialQuantity,
          availableQuantity: input.availableQuantity ?? input.initialQuantity,
          unitCost: input.unitCost,
          status: input.status ?? LotStatus.AVAILABLE,
          createdBy: input.createdBy,
        },
      }),
    );
  }
  public async findById(context: TenantContext, id: string): Promise<Lot> {
    requireTenant(context);
    const entity = await this.prisma.execute((client) =>
      client.lot.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
      }),
    );
    if (entity === null) throw new TenantResourceNotFoundError();
    return entity;
  }
  public list(
    context: TenantContext,
    options?: {
      readonly productId?: string;
      readonly status?: LotStatus;
      readonly limit?: number;
    },
  ): Promise<Lot[]> {
    requireTenant(context);
    const where: Prisma.LotWhereInput = {
      tenantId: context.tenantId,
      ...(options?.productId === undefined
        ? {}
        : { productId: options.productId }),
      ...(options?.status === undefined ? {} : { status: options.status }),
    };
    return this.prisma.execute((client) =>
      client.lot.findMany({
        where,
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
        take: Math.min(Math.max(options?.limit ?? 50, 1), 100),
      }),
    );
  }
  public async updateById(
    context: TenantContext,
    id: string,
    input: LotUpdateInput,
  ): Promise<void> {
    requireTenant(context);
    const result = await this.prisma.execute((client) =>
      client.lot.updateMany({
        where: {
          tenantId: context.tenantId,
          id,
          ...(input.version === undefined ? {} : { version: input.version }),
        },
        data: {
          ...(input.availableQuantity === undefined
            ? {}
            : { availableQuantity: input.availableQuantity }),
          ...(input.status === undefined ? {} : { status: input.status }),
          version: { increment: 1 },
        },
      }),
    );
    if (result.count !== 1) throw new TenantResourceNotFoundError();
  }
}
