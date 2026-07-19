import { ProductStatus, type Prisma, type Product } from "@prisma/client";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

export interface ProductCreateInput {
  readonly name: string;
  readonly normalizedName: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly categoryId?: string;
  readonly unitOfMeasureId: string;
  readonly minimumStock?: number;
  readonly expiryAlertDays?: number;
  readonly status?: ProductStatus;
}
export interface ProductUpdateInput {
  readonly name?: string;
  readonly normalizedName?: string;
  readonly sku?: string | null;
  readonly barcode?: string | null;
  readonly categoryId?: string | null;
  readonly unitOfMeasureId?: string;
  readonly minimumStock?: number;
  readonly expiryAlertDays?: number;
  readonly status?: ProductStatus;
  readonly version?: number;
}
function requireTenant(context: TenantContext): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
}

export class ProductRepository {
  public constructor(private readonly prisma: PrismaModule) {}
  public create(
    context: TenantContext,
    input: ProductCreateInput,
  ): Promise<Product> {
    requireTenant(context);
    return this.prisma.execute((client) =>
      client.product.create({
        data: {
          tenantId: context.tenantId,
          name: input.name,
          normalizedName: input.normalizedName,
          unitOfMeasureId: input.unitOfMeasureId,
          minimumStock: input.minimumStock ?? 0,
          expiryAlertDays: input.expiryAlertDays ?? 0,
          status: input.status ?? ProductStatus.ACTIVE,
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          ...(input.barcode === undefined ? {} : { barcode: input.barcode }),
          ...(input.categoryId === undefined
            ? {}
            : { categoryId: input.categoryId }),
        },
      }),
    );
  }
  public async findById(context: TenantContext, id: string): Promise<Product> {
    requireTenant(context);
    const entity = await this.prisma.execute((client) =>
      client.product.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
      }),
    );
    if (entity === null) throw new TenantResourceNotFoundError();
    return entity;
  }
  public list(
    context: TenantContext,
    options?: {
      readonly query?: string;
      readonly categoryId?: string;
      readonly status?: ProductStatus;
      readonly limit?: number;
    },
  ): Promise<Product[]> {
    requireTenant(context);
    const where: Prisma.ProductWhereInput = {
      tenantId: context.tenantId,
      ...(options?.categoryId === undefined
        ? {}
        : { categoryId: options.categoryId }),
      ...(options?.status === undefined ? {} : { status: options.status }),
      ...(options?.query === undefined
        ? {}
        : {
            OR: [
              { normalizedName: { contains: options.query.toLowerCase() } },
              { sku: { contains: options.query } },
              { barcode: { contains: options.query } },
            ],
          }),
    };
    return this.prisma.execute((client) =>
      client.product.findMany({
        where,
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        take: Math.min(Math.max(options?.limit ?? 50, 1), 100),
      }),
    );
  }
  public async updateById(
    context: TenantContext,
    id: string,
    input: ProductUpdateInput,
  ): Promise<void> {
    requireTenant(context);
    const result = await this.prisma.execute((client) =>
      client.product.updateMany({
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
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          ...(input.barcode === undefined ? {} : { barcode: input.barcode }),
          ...(input.categoryId === undefined
            ? {}
            : { categoryId: input.categoryId }),
          ...(input.unitOfMeasureId === undefined
            ? {}
            : { unitOfMeasureId: input.unitOfMeasureId }),
          ...(input.minimumStock === undefined
            ? {}
            : { minimumStock: input.minimumStock }),
          ...(input.expiryAlertDays === undefined
            ? {}
            : { expiryAlertDays: input.expiryAlertDays }),
          ...(input.status === undefined ? {} : { status: input.status }),
          version: { increment: 1 },
        },
      }),
    );
    if (result.count !== 1) throw new TenantResourceNotFoundError();
  }
}
