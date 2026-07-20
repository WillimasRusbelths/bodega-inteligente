import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../access/context/tenant-context.js";
import {
  TenantPermissionError,
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../access/guards/authorization-errors.js";

export interface QuickSaleItemInput {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice?: number;
}

export interface QuickSaleInput {
  readonly items: readonly QuickSaleItemInput[];
}

export interface SaleItemResponse {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly lotId: string | null;
  readonly expiresAt: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
}

export interface SaleResponse {
  readonly id: string;
  readonly saleNumber: string;
  readonly status: string;
  readonly subtotal: number;
  readonly total: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly sellerUserId: string;
  readonly membershipId: string;
  readonly items: readonly SaleItemResponse[];
}

export interface SaleProductResponse {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly status: string;
  readonly salePrice: number;
  readonly availableStock: number;
}

export class QuickSaleError extends Error {
  public constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "QuickSaleError";
  }
}

function assertContext(context: TenantContext, permission: string): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
  if (!context.permissions.includes(permission))
    throw new TenantPermissionError();
}

function positiveQuantity(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new QuickSaleError("VALIDATION_ERROR", 400);
  }
  return value;
}

function nonNegativePrice(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new QuickSaleError("VALIDATION_ERROR", 400);
  }
  return value;
}

function toNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function saleNumber(): string {
  return `V-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function serializeSale(row: {
  readonly id: string;
  readonly saleNumber: string;
  readonly status: string;
  readonly subtotal: Prisma.Decimal | number;
  readonly total: Prisma.Decimal | number;
  readonly currency: string;
  readonly createdAt: Date;
  readonly sellerUserId: string;
  readonly membershipId: string;
  readonly items: readonly {
    readonly id: string;
    readonly productId: string;
    readonly lotId: string | null;
    readonly quantity: Prisma.Decimal | number;
    readonly unitPrice: Prisma.Decimal | number;
    readonly lineTotal: Prisma.Decimal | number;
    readonly product: { readonly name: string };
    readonly lot: { readonly expiresAt: Date } | null;
  }[];
}): SaleResponse {
  return {
    id: row.id,
    saleNumber: row.saleNumber,
    status: row.status,
    subtotal: toNumber(row.subtotal),
    total: toNumber(row.total),
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    sellerUserId: row.sellerUserId,
    membershipId: row.membershipId,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      lotId: item.lotId,
      expiresAt: item.lot?.expiresAt.toISOString().slice(0, 10) ?? null,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
    })),
  };
}

export class QuickSaleService {
  public constructor(private readonly prisma: PrismaModule) {}

  private async assertMembership(
    context: TenantContext,
    permission: string,
  ): Promise<void> {
    assertContext(context, permission);
    const valid = await this.prisma.execute(async (client) => {
      const [membership, tenant] = await Promise.all([
        client.membership.findUnique({
          where: {
            tenantId_id: {
              tenantId: context.tenantId,
              id: context.membershipId,
            },
          },
          select: { userId: true, status: true },
        }),
        client.tenant.findUnique({
          where: { id: context.tenantId },
          select: { status: true },
        }),
      ]);
      return (
        membership?.userId === context.userId &&
        membership.status === "ACTIVE" &&
        tenant?.status === "ACTIVE"
      );
    });
    if (!valid) throw new TenantSessionInvalidError();
  }

  public async listProducts(
    context: TenantContext,
  ): Promise<readonly SaleProductResponse[]> {
    await this.assertMembership(context, "inventory.products.read");
    return this.prisma.execute(async (client) => {
      const products = await client.product.findMany({
        where: { tenantId: context.tenantId, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          status: true,
          salePrice: true,
          balances: {
            select: { availableQuantity: true },
          },
        },
      });
      return products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        status: product.status,
        salePrice: toNumber(product.salePrice),
        availableStock: product.balances.reduce(
          (sum, balance) => sum + toNumber(balance.availableQuantity),
          0,
        ),
      }));
    });
  }

  public async create(
    context: TenantContext,
    input: QuickSaleInput,
  ): Promise<SaleResponse> {
    await this.assertMembership(context, "sales.write");
    if (input.items.length === 0) {
      throw new QuickSaleError("VALIDATION_ERROR", 400);
    }
    const items = input.items.map((item) => ({
      productId: item.productId,
      quantity: positiveQuantity(item.quantity),
      unitPrice:
        item.unitPrice === undefined
          ? undefined
          : nonNegativePrice(item.unitPrice),
    }));
    return this.prisma.transaction(
      async (transaction) => {
        const tenant = await transaction.tenant.findUnique({
          where: { id: context.tenantId },
          select: { currencyCode: true },
        });
        if (tenant === null) throw new TenantResourceNotFoundError();
        let subtotal = 0;
        const sale = await transaction.sale.create({
          data: {
            tenantId: context.tenantId,
            membershipId: context.membershipId,
            sellerUserId: context.userId,
            saleNumber: saleNumber(),
            subtotal: 0,
            total: 0,
            currency: tenant.currencyCode,
          },
        });
        for (const item of items) {
          const product = await transaction.product.findUnique({
            where: {
              tenantId_id: {
                tenantId: context.tenantId,
                id: item.productId,
              },
            },
            select: {
              id: true,
              name: true,
              status: true,
              salePrice: true,
            },
          });
          if (product === null || product.status !== "ACTIVE") {
            throw new TenantResourceNotFoundError();
          }
          const unitPrice = nonNegativePrice(
            item.unitPrice ?? toNumber(product.salePrice),
          );
          let remaining = item.quantity;
          const lots = await transaction.lot.findMany({
            where: {
              tenantId: context.tenantId,
              productId: item.productId,
              status: "AVAILABLE",
              availableQuantity: { gt: 0 },
            },
            orderBy: [
              { expiresAt: "asc" },
              { receivedAt: "asc" },
              { id: "asc" },
            ],
          });
          const available = lots.reduce(
            (sum, lot) => sum + toNumber(lot.availableQuantity),
            0,
          );
          if (available < item.quantity) {
            throw new QuickSaleError("STOCK_INSUFFICIENT", 409);
          }
          for (const lot of lots) {
            if (remaining <= 0) break;
            const before = toNumber(lot.availableQuantity);
            const take = Math.min(before, remaining);
            const after = before - take;
            const updated = await transaction.lot.updateMany({
              where: {
                tenantId: context.tenantId,
                id: lot.id,
                version: lot.version,
                availableQuantity: { gte: take },
              },
              data: {
                availableQuantity: after,
                status: after === 0 ? "DEPLETED" : "AVAILABLE",
                version: { increment: 1 },
              },
            });
            if (updated.count !== 1) {
              throw new QuickSaleError("STALE_STATE", 409);
            }
            await transaction.inventoryBalance.upsert({
              where: {
                tenantId_productId_lotId: {
                  tenantId: context.tenantId,
                  productId: item.productId,
                  lotId: lot.id,
                },
              },
              update: {
                availableQuantity: after,
                version: { increment: 1 },
              },
              create: {
                tenantId: context.tenantId,
                productId: item.productId,
                lotId: lot.id,
                availableQuantity: after,
                reservedQuantity: 0,
              },
            });
            await transaction.inventoryMovement.create({
              data: {
                tenantId: context.tenantId,
                productId: item.productId,
                lotId: lot.id,
                type: "SALE_OUT",
                quantity: take,
                quantityDelta: -take,
                balanceBefore: before,
                balanceAfter: after,
                reason: `Venta rapida ${sale.saleNumber}`,
                actorId: context.userId,
              },
            });
            const lineTotal = take * unitPrice;
            subtotal += lineTotal;
            await transaction.saleItem.create({
              data: {
                tenantId: context.tenantId,
                saleId: sale.id,
                productId: item.productId,
                lotId: lot.id,
                quantity: take,
                unitPrice,
                lineTotal,
              },
            });
            remaining -= take;
          }
          if (remaining > 0) {
            throw new QuickSaleError("STOCK_INSUFFICIENT", 409);
          }
        }
        const updatedSale = await transaction.sale.update({
          where: { id: sale.id },
          data: { subtotal, total: subtotal },
          include: {
            items: {
              orderBy: { id: "asc" },
              include: {
                product: { select: { name: true } },
                lot: { select: { expiresAt: true } },
              },
            },
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: context.tenantId,
            actorType: "USER",
            actorId: context.userId,
            effectiveMembershipId: context.membershipId,
            action: "SALE_COMPLETED",
            targetType: "Sale",
            targetId: sale.id,
            result: "SUCCEEDED",
            correlationId: randomUUID(),
            afterSanitized: {
              saleNumber: updatedSale.saleNumber,
              total: subtotal,
              itemCount: updatedSale.items.length,
            },
          },
        });
        return serializeSale(updatedSale);
      },
      { isolationLevel: "Serializable" },
    );
  }

  public async list(context: TenantContext): Promise<readonly SaleResponse[]> {
    await this.assertMembership(context, "sales.read");
    const rows = await this.prisma.execute((client) =>
      client.sale.findMany({
        where: { tenantId: context.tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30,
        include: {
          items: {
            orderBy: { id: "asc" },
            include: {
              product: { select: { name: true } },
              lot: { select: { expiresAt: true } },
            },
          },
        },
      }),
    );
    return rows.map(serializeSale);
  }

  public async get(
    context: TenantContext,
    saleId: string,
  ): Promise<SaleResponse> {
    await this.assertMembership(context, "sales.read");
    const row = await this.prisma.execute((client) =>
      client.sale.findUnique({
        where: {
          tenantId_id: { tenantId: context.tenantId, id: saleId },
        },
        include: {
          items: {
            orderBy: { id: "asc" },
            include: {
              product: { select: { name: true } },
              lot: { select: { expiresAt: true } },
            },
          },
        },
      }),
    );
    if (row === null) throw new TenantResourceNotFoundError();
    return serializeSale(row);
  }
}
