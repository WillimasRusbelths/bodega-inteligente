import { CatalogStatus, type Prisma, type UnitOfMeasure } from "@prisma/client";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

export interface UnitCreateInput {
  readonly code: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly quantityScale?: number;
  readonly status?: CatalogStatus;
}
export interface UnitUpdateInput {
  readonly code?: string;
  readonly name?: string;
  readonly normalizedName?: string;
  readonly quantityScale?: number;
  readonly status?: CatalogStatus;
  readonly version?: number;
}
function requireTenant(context: TenantContext): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
}

export class UnitRepository {
  public constructor(private readonly prisma: PrismaModule) {}
  public create(
    context: TenantContext,
    input: UnitCreateInput,
  ): Promise<UnitOfMeasure> {
    requireTenant(context);
    return this.prisma.execute((client) =>
      client.unitOfMeasure.create({
        data: {
          tenantId: context.tenantId,
          code: input.code,
          name: input.name,
          normalizedName: input.normalizedName,
          quantityScale: input.quantityScale ?? 0,
          status: input.status ?? CatalogStatus.ACTIVE,
        },
      }),
    );
  }
  public async findById(
    context: TenantContext,
    id: string,
  ): Promise<UnitOfMeasure> {
    requireTenant(context);
    const entity = await this.prisma.execute((client) =>
      client.unitOfMeasure.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
      }),
    );
    if (entity === null) throw new TenantResourceNotFoundError();
    return entity;
  }
  public list(
    context: TenantContext,
    options?: { readonly status?: CatalogStatus; readonly limit?: number },
  ): Promise<UnitOfMeasure[]> {
    requireTenant(context);
    const where: Prisma.UnitOfMeasureWhereInput = {
      tenantId: context.tenantId,
      ...(options?.status === undefined ? {} : { status: options.status }),
    };
    return this.prisma.execute((client) =>
      client.unitOfMeasure.findMany({
        where,
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        take: Math.min(Math.max(options?.limit ?? 50, 1), 100),
      }),
    );
  }
  public async updateById(
    context: TenantContext,
    id: string,
    input: UnitUpdateInput,
  ): Promise<void> {
    requireTenant(context);
    const result = await this.prisma.execute((client) =>
      client.unitOfMeasure.updateMany({
        where: {
          tenantId: context.tenantId,
          id,
          ...(input.version === undefined ? {} : { version: input.version }),
        },
        data: {
          ...(input.code === undefined ? {} : { code: input.code }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.normalizedName === undefined
            ? {}
            : { normalizedName: input.normalizedName }),
          ...(input.quantityScale === undefined
            ? {}
            : { quantityScale: input.quantityScale }),
          ...(input.status === undefined ? {} : { status: input.status }),
          version: { increment: 1 },
        },
      }),
    );
    if (result.count !== 1) throw new TenantResourceNotFoundError();
  }
}
