import {
  CatalogStatus,
  type Prisma,
  type ProductCategory,
} from "@prisma/client";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

export interface CategoryCreateInput {
  readonly name: string;
  readonly normalizedName: string;
  readonly status?: CatalogStatus;
}

export interface CategoryUpdateInput {
  readonly name?: string;
  readonly normalizedName?: string;
  readonly status?: CatalogStatus;
  readonly version?: number;
}

function requireTenant(context: TenantContext): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
}

export class CategoryRepository {
  public constructor(private readonly prisma: PrismaModule) {}

  public create(
    context: TenantContext,
    input: CategoryCreateInput,
  ): Promise<ProductCategory> {
    requireTenant(context);
    return this.prisma.execute((client) =>
      client.productCategory.create({
        data: {
          tenantId: context.tenantId,
          name: input.name,
          normalizedName: input.normalizedName,
          status: input.status ?? CatalogStatus.ACTIVE,
        },
      }),
    );
  }

  public async findById(
    context: TenantContext,
    id: string,
  ): Promise<ProductCategory> {
    requireTenant(context);
    const entity = await this.prisma.execute((client) =>
      client.productCategory.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
      }),
    );
    if (entity === null) throw new TenantResourceNotFoundError();
    return entity;
  }

  public list(
    context: TenantContext,
    options?: {
      readonly status?: CatalogStatus;
      readonly cursorId?: string;
      readonly limit?: number;
    },
  ): Promise<ProductCategory[]> {
    requireTenant(context);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const where: Prisma.ProductCategoryWhereInput = {
      tenantId: context.tenantId,
      ...(options?.status === undefined ? {} : { status: options.status }),
    };
    return this.prisma.execute((client) =>
      client.productCategory.findMany({
        where,
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        ...(options?.cursorId === undefined
          ? {}
          : {
              cursor: {
                tenantId_id: {
                  tenantId: context.tenantId,
                  id: options.cursorId,
                },
              },
              skip: 1,
            }),
        take: limit,
      }),
    );
  }

  public async updateById(
    context: TenantContext,
    id: string,
    input: CategoryUpdateInput,
  ): Promise<void> {
    requireTenant(context);
    const result = await this.prisma.execute((client) =>
      client.productCategory.updateMany({
        where: {
          tenantId: context.tenantId,
          id,
          ...(input.version === undefined ? {} : { version: input.version }),
        },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.normalizedName === undefined
            ? {}
            : { normalizedName: input.normalizedName }),
          ...(input.status === undefined ? {} : { status: input.status }),
          version: { increment: 1 },
        },
      }),
    );
    if (result.count !== 1) throw new TenantResourceNotFoundError();
  }
}
