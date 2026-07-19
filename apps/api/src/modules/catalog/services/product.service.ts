import { createHash, randomUUID } from "node:crypto";
import type {
  Prisma,
  Product,
  ProductCategory,
  UnitOfMeasure,
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
import { AuditService } from "../../audit/services/audit.service.js";
import { AlertService } from "../../alerts/services/alert.service.js";
import { parseIfMatch } from "../../../common/http/if-match.js";
import type {
  CategoryCreateDto,
  CategoryUpdateDto,
  CatalogStatusDto,
} from "../dto/category.dto.js";
import type {
  ProductCreateDto,
  ProductListQuery,
  ProductUpdateDto,
} from "../dto/product.dto.js";
import type { UnitCreateDto, UnitUpdateDto } from "../dto/unit.dto.js";
import {
  serializeCategory,
  serializeProduct,
  serializeUnit,
} from "../dto/product-response.dto.js";

export type CatalogErrorCode =
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_PERMISSION"
  | "RESOURCE_NOT_FOUND"
  | "STALE_STATE"
  | "CONFLICT";

export class CatalogMutationError extends Error {
  public constructor(public readonly code: CatalogErrorCode) {
    super(code);
    this.name = "CatalogMutationError";
  }
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
}

function mapPersistenceError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (code === "P2002") throw new CatalogMutationError("CONFLICT");
    if (code === "P2003" || code === "P2025")
      throw new TenantResourceNotFoundError();
  }
  throw error;
}

function requireContext(context: TenantContext, permission: string): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
  if (!context.permissions.includes(permission))
    throw new CatalogMutationError("INSUFFICIENT_PERMISSION");
}

function requireVersion(value: string | undefined): number {
  try {
    return parseIfMatch(value);
  } catch {
    throw new CatalogMutationError("VALIDATION_ERROR");
  }
}

type CatalogRecord = ProductCategory | UnitOfMeasure | Product;

function digest(value: string): Uint8Array<ArrayBuffer> {
  return createHash("sha256")
    .update(value, "utf8")
    .digest() as Uint8Array<ArrayBuffer>;
}

export class ProductService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly audit = new AuditService(),
  ) {}

  private async assertMembership(
    context: TenantContext,
    permission: string,
  ): Promise<void> {
    requireContext(context, permission);
    const valid = await this.prisma.execute(async (client) => {
      const membership = await client.membership.findUnique({
        where: {
          tenantId_id: { tenantId: context.tenantId, id: context.membershipId },
        },
        select: { userId: true, tenantId: true, status: true },
      });
      const tenant = await client.tenant.findUnique({
        where: { id: context.tenantId },
        select: { status: true },
      });
      return (
        membership?.userId === context.userId &&
        membership.tenantId === context.tenantId &&
        membership.status === "ACTIVE" &&
        tenant?.status === "ACTIVE"
      );
    });
    if (!valid) throw new TenantSessionInvalidError();
  }

  private async auditMutation<TResult>(
    context: TenantContext,
    operation: (transaction: Prisma.TransactionClient) => Promise<{
      readonly result: TResult;
      readonly target: CatalogRecord;
      readonly before: unknown;
    }>,
    action: string,
    targetType: string,
    idempotency?: {
      readonly key: string;
      readonly operation: string;
      readonly request: unknown;
    },
  ): Promise<TResult> {
    return this.prisma
      .transaction(
        async (transaction) => {
          const keyHash =
            idempotency === undefined ? undefined : digest(idempotency.key);
          const requestHash =
            idempotency === undefined
              ? undefined
              : digest(JSON.stringify(idempotency.request));
          if (
            idempotency !== undefined &&
            keyHash !== undefined &&
            requestHash !== undefined
          ) {
            const previous = await transaction.idempotencyRecord.findUnique({
              where: {
                scopeActorId_tenantId_operation_idempotencyKeyHash: {
                  scopeActorId: context.userId,
                  tenantId: context.tenantId,
                  operation: idempotency.operation,
                  idempotencyKeyHash: keyHash,
                },
              },
            });
            if (previous !== null) {
              if (!Buffer.from(previous.requestHash).equals(requestHash))
                throw new CatalogMutationError("CONFLICT");
              if (previous.responseBodySanitized !== null)
                return previous.responseBodySanitized as TResult;
            }
          }
          const completed = await operation(transaction);
          await this.audit.append(transaction, {
            tenantId: context.tenantId,
            actorType: "USER",
            actorId: context.userId,
            effectiveMembershipId: context.membershipId,
            action,
            targetType,
            targetId: completed.target.id,
            result: "SUCCEEDED",
            correlationId: randomUUID(),
            before: completed.before,
            after: completed.target,
          });
          if (
            idempotency !== undefined &&
            keyHash !== undefined &&
            requestHash !== undefined
          ) {
            await transaction.idempotencyRecord.create({
              data: {
                scopeActorId: context.userId,
                tenantId: context.tenantId,
                operation: idempotency.operation,
                idempotencyKeyHash: keyHash,
                requestHash,
                responseStatus: 200,
                responseBodySanitized:
                  completed.result as Prisma.InputJsonValue,
                expiresAt: new Date(Date.now() + 86_400_000),
              },
            });
          }
          return completed.result;
        },
        { isolationLevel: "Serializable" },
      )
      .catch(mapPersistenceError);
  }

  public async listCategories(
    context: TenantContext,
    options: {
      readonly status?: "ACTIVE" | "INACTIVE";
      readonly cursorId?: string;
      readonly limit: number;
    },
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    await this.assertMembership(context, "inventory.products.read");
    const rows = await this.prisma.execute((client) =>
      client.productCategory.findMany({
        where: {
          tenantId: context.tenantId,
          ...(options.status === undefined ? {} : { status: options.status }),
        },
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        ...(options.cursorId === undefined
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
        take: options.limit + 1,
      }),
    );
    const page = rows.slice(0, options.limit).map(serializeCategory);
    return {
      items: page,
      nextCursor:
        rows.length > options.limit
          ? (rows[options.limit - 1]?.id ?? null)
          : null,
    };
  }

  public async createCategory(
    context: TenantContext,
    dto: CategoryCreateDto,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    const result = await this.auditMutation(
      context,
      async (transaction) => {
        const created = await transaction.productCategory.create({
          data: {
            tenantId: context.tenantId,
            name: dto.name,
            normalizedName: normalized(dto.name),
          },
        });
        return {
          result: serializeCategory(created),
          target: created,
          before: null,
        };
      },
      "CATEGORY_CREATED",
      "ProductCategory",
      { key: idempotencyKey, operation: "createCategory", request: dto },
    );
    return result;
  }

  public async updateCategory(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    dto: CategoryUpdateDto,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    const version = requireVersion(ifMatch);
    return this.auditMutation(
      context,
      async (transaction) => {
        const current = await transaction.productCategory.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        if (current === null) throw new TenantResourceNotFoundError();
        if (current.version !== version)
          throw new CatalogMutationError("STALE_STATE");
        const updated = await transaction.productCategory.updateMany({
          where: { tenantId: context.tenantId, id, version },
          data: {
            ...(dto.name === undefined
              ? {}
              : { name: dto.name, normalizedName: normalized(dto.name) }),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new CatalogMutationError("STALE_STATE");
        const result = await transaction.productCategory.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        return {
          result: serializeCategory(result),
          target: result,
          before: current,
        };
      },
      "CATEGORY_UPDATED",
      "ProductCategory",
    );
  }

  public updateCategoryStatus(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    dto: CatalogStatusDto,
  ): Promise<Readonly<Record<string, unknown>>> {
    return this.updateCategoryWithStatus(context, id, ifMatch, dto.status);
  }

  private async updateCategoryWithStatus(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    status: "ACTIVE" | "INACTIVE",
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    const version = requireVersion(ifMatch);
    return this.auditMutation(
      context,
      async (transaction) => {
        const current = await transaction.productCategory.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        if (current === null) throw new TenantResourceNotFoundError();
        if (current.version !== version)
          throw new CatalogMutationError("STALE_STATE");
        const updated = await transaction.productCategory.updateMany({
          where: { tenantId: context.tenantId, id, version },
          data: { status, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new CatalogMutationError("STALE_STATE");
        const result = await transaction.productCategory.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        return {
          result: serializeCategory(result),
          target: result,
          before: current,
        };
      },
      "CATEGORY_STATUS_CHANGED",
      "ProductCategory",
    );
  }

  public async listUnits(
    context: TenantContext,
    options: {
      readonly status?: "ACTIVE" | "INACTIVE";
      readonly limit: number;
    },
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: null;
  }> {
    await this.assertMembership(context, "inventory.products.read");
    const rows = await this.prisma.execute((client) =>
      client.unitOfMeasure.findMany({
        where: {
          tenantId: context.tenantId,
          ...(options.status === undefined ? {} : { status: options.status }),
        },
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        take: options.limit,
      }),
    );
    return { items: rows.map(serializeUnit), nextCursor: null };
  }

  public async createUnit(
    context: TenantContext,
    dto: UnitCreateDto,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    return this.auditMutation(
      context,
      async (transaction) => {
        const created = await transaction.unitOfMeasure.create({
          data: {
            tenantId: context.tenantId,
            code: dto.code,
            name: dto.name,
            normalizedName: normalized(dto.name),
            quantityScale: dto.quantityScale,
          },
        });
        return {
          result: serializeUnit(created),
          target: created,
          before: null,
        };
      },
      "UNIT_CREATED",
      "UnitOfMeasure",
      { key: idempotencyKey, operation: "createUnit", request: dto },
    );
  }

  public async updateUnit(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    dto: UnitUpdateDto,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    const version = requireVersion(ifMatch);
    return this.auditMutation(
      context,
      async (transaction) => {
        const current = await transaction.unitOfMeasure.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        if (current === null) throw new TenantResourceNotFoundError();
        if (current.version !== version)
          throw new CatalogMutationError("STALE_STATE");
        const updated = await transaction.unitOfMeasure.updateMany({
          where: { tenantId: context.tenantId, id, version },
          data: {
            ...(dto.code === undefined ? {} : { code: dto.code }),
            ...(dto.name === undefined
              ? {}
              : { name: dto.name, normalizedName: normalized(dto.name) }),
            ...(dto.quantityScale === undefined
              ? {}
              : { quantityScale: dto.quantityScale }),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new CatalogMutationError("STALE_STATE");
        const result = await transaction.unitOfMeasure.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        return {
          result: serializeUnit(result),
          target: result,
          before: current,
        };
      },
      "UNIT_UPDATED",
      "UnitOfMeasure",
    );
  }

  public updateUnitStatus(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    dto: CatalogStatusDto,
  ): Promise<Readonly<Record<string, unknown>>> {
    return this.updateUnitStatusValue(context, id, ifMatch, dto.status);
  }
  private async updateUnitStatusValue(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    status: "ACTIVE" | "INACTIVE",
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    const version = requireVersion(ifMatch);
    return this.auditMutation(
      context,
      async (transaction) => {
        const current = await transaction.unitOfMeasure.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        if (current === null) throw new TenantResourceNotFoundError();
        if (current.version !== version)
          throw new CatalogMutationError("STALE_STATE");
        const updated = await transaction.unitOfMeasure.updateMany({
          where: { tenantId: context.tenantId, id, version },
          data: { status, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new CatalogMutationError("STALE_STATE");
        const result = await transaction.unitOfMeasure.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
        });
        return {
          result: serializeUnit(result),
          target: result,
          before: current,
        };
      },
      "UNIT_STATUS_CHANGED",
      "UnitOfMeasure",
    );
  }

  private productInclude = { category: true, unitOfMeasure: true } as const;

  public async listProducts(
    context: TenantContext,
    query: ProductListQuery,
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    await this.assertMembership(context, "inventory.products.read");
    const rows = await this.prisma.execute((client) =>
      client.product.findMany({
        where: {
          tenantId: context.tenantId,
          ...(query.categoryId === undefined
            ? {}
            : { categoryId: query.categoryId }),
          ...(query.status === undefined ? {} : { status: query.status }),
          ...(query.q === undefined
            ? {}
            : {
                OR: [
                  { normalizedName: { contains: normalized(query.q) } },
                  { sku: { contains: query.q } },
                  { barcode: { contains: query.q } },
                ],
              }),
        },
        include: this.productInclude,
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        ...(query.cursor === undefined
          ? {}
          : {
              cursor: {
                tenantId_id: { tenantId: context.tenantId, id: query.cursor },
              },
              skip: 1,
            }),
        take: query.limit + 1,
      }),
    );
    const page = rows.slice(0, query.limit).map((row) => serializeProduct(row));
    return {
      items: page,
      nextCursor:
        rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
    };
  }

  public async getProduct(
    context: TenantContext,
    id: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.read");
    const product = await this.prisma.execute((client) =>
      client.product.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
        include: this.productInclude,
      }),
    );
    if (product === null) throw new TenantResourceNotFoundError();
    return serializeProduct(product);
  }

  public async createProduct(
    context: TenantContext,
    dto: ProductCreateDto,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    return this.auditMutation(
      context,
      async (transaction) => {
        try {
          const created = await transaction.product.create({
            data: {
              tenantId: context.tenantId,
              name: dto.name,
              normalizedName: normalized(dto.name),
              ...(dto.sku === undefined ? {} : { sku: dto.sku }),
              ...(dto.barcode === undefined ? {} : { barcode: dto.barcode }),
              ...(dto.categoryId === undefined
                ? {}
                : { categoryId: dto.categoryId }),
              unitOfMeasureId: dto.unitOfMeasureId,
              minimumStock: dto.minimumStock ?? 0,
              expiryAlertDays: dto.expiryAlertDays ?? 0,
            },
            include: this.productInclude,
          });
          return {
            result: serializeProduct(created),
            target: created,
            before: null,
          };
        } catch (error) {
          mapPersistenceError(error);
        }
      },
      "PRODUCT_CREATED",
      "Product",
      { key: idempotencyKey, operation: "createProduct", request: dto },
    );
  }

  public async updateProduct(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    dto: ProductUpdateDto,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.products.write");
    const version = requireVersion(ifMatch);
    return this.auditMutation(
      context,
      async (transaction) => {
        const current = await transaction.product.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
          include: this.productInclude,
        });
        if (current === null) throw new TenantResourceNotFoundError();
        if (current.version !== version)
          throw new CatalogMutationError("STALE_STATE");
        const updated = await transaction.product.updateMany({
          where: { tenantId: context.tenantId, id, version },
          data: {
            ...(dto.name === undefined
              ? {}
              : { name: dto.name, normalizedName: normalized(dto.name) }),
            ...(dto.sku === undefined ? {} : { sku: dto.sku }),
            ...(dto.barcode === undefined ? {} : { barcode: dto.barcode }),
            ...(dto.categoryId === undefined
              ? {}
              : { categoryId: dto.categoryId }),
            ...(dto.unitOfMeasureId === undefined
              ? {}
              : { unitOfMeasureId: dto.unitOfMeasureId }),
            ...(dto.minimumStock === undefined
              ? {}
              : { minimumStock: dto.minimumStock }),
            ...(dto.expiryAlertDays === undefined
              ? {}
              : { expiryAlertDays: dto.expiryAlertDays }),
            ...(dto.status === undefined ? {} : { status: dto.status }),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new CatalogMutationError("STALE_STATE");
        const result = await transaction.product.findUniqueOrThrow({
          where: { tenantId_id: { tenantId: context.tenantId, id } },
          include: this.productInclude,
        });
        if (
          dto.minimumStock !== undefined ||
          dto.expiryAlertDays !== undefined
        ) {
          await new AlertService(this.prisma).evaluateInTransaction(
            transaction,
            context,
            id,
            new Date(),
          );
        }
        return {
          result: serializeProduct(result),
          target: result,
          before: current,
        };
      },
      "PRODUCT_UPDATED",
      "Product",
      {
        key: idempotencyKey,
        operation: "updateProduct",
        request: { id, version, dto },
      },
    );
  }
}
