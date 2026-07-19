import type { Product, ProductCategory, UnitOfMeasure } from "@prisma/client";

export interface CategoryResponse {
  readonly data: Readonly<Record<string, unknown>>;
}
export interface UnitResponse {
  readonly data: Readonly<Record<string, unknown>>;
}
export interface ProductResponse {
  readonly data: Readonly<Record<string, unknown>>;
}

export function serializeCategory(
  category: ProductCategory,
): Readonly<Record<string, unknown>> {
  return {
    id: category.id,
    tenantId: category.tenantId,
    name: category.name,
    status: category.status,
    version: category.version,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function serializeUnit(
  unit: UnitOfMeasure,
): Readonly<Record<string, unknown>> {
  return {
    id: unit.id,
    tenantId: unit.tenantId,
    code: unit.code,
    name: unit.name,
    quantityScale: unit.quantityScale,
    status: unit.status,
    version: unit.version,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

export function serializeProduct(
  product: Product & {
    readonly category?: ProductCategory | null;
    readonly unitOfMeasure?: UnitOfMeasure;
    readonly availableStock?: number;
  },
): Readonly<Record<string, unknown>> {
  return {
    id: product.id,
    tenantId: product.tenantId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    category:
      product.category === undefined || product.category === null
        ? null
        : { id: product.category.id, name: product.category.name },
    unitOfMeasure:
      product.unitOfMeasure === undefined
        ? undefined
        : {
            id: product.unitOfMeasure.id,
            code: product.unitOfMeasure.code,
            name: product.unitOfMeasure.name,
            quantityScale: product.unitOfMeasure.quantityScale,
          },
    status: product.status,
    minimumStock: Number(product.minimumStock),
    expiryAlertDays: product.expiryAlertDays,
    ...(product.availableStock === undefined
      ? {}
      : { availableStock: product.availableStock }),
    version: product.version,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
