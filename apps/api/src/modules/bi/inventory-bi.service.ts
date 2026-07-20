import type { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../access/context/tenant-context.js";
import {
  TenantPermissionError,
  TenantSessionInvalidError,
} from "../access/guards/authorization-errors.js";

export type InventoryBiRole = "owner_admin" | "inventory_manager" | "seller";

export interface BiProductInput {
  readonly tenantId: string;
  readonly id: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly minimumStock: number;
  readonly expiryAlertDays: number;
}

export interface BiLotInput {
  readonly tenantId: string;
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly categoryName: string | null;
  readonly expiresAt: string;
  readonly availableQuantity: number;
  readonly unitCost: number;
  readonly status: string;
}

export interface BiMovementInput {
  readonly tenantId: string;
  readonly type: string;
  readonly quantity: number;
  readonly createdAt: string;
}

export interface BiAlertInput {
  readonly tenantId: string;
  readonly type: string;
  readonly status: string;
  readonly productId: string;
  readonly productName: string;
  readonly lotId: string | null;
  readonly triggeredAt: string;
}

export interface InventoryBiDataset {
  readonly products: readonly BiProductInput[];
  readonly lots: readonly BiLotInput[];
  readonly movements: readonly BiMovementInput[];
  readonly alerts: readonly BiAlertInput[];
}

export interface InventorySummary {
  readonly totalProducts: number;
  readonly totalStockAvailable: number;
  readonly lowStockProducts: number;
  readonly productsExpiringSoon: number;
  readonly productsExpired: number;
  readonly activeAlerts: number;
  readonly inventoryValuation?: number;
}

export interface StockByCategoryRow {
  readonly categoryId: string | null;
  readonly categoryName: string;
  readonly stockAvailable: number;
  readonly lowStockProducts: number;
  readonly inventoryValuation?: number;
}

export interface ExpirationRiskRow {
  readonly lotId: string;
  readonly productId: string;
  readonly productName: string;
  readonly categoryName: string | null;
  readonly expiresAt: string;
  readonly availableQuantity: number;
  readonly riskState: "EXPIRED" | "EXPIRING_SOON" | "OK";
  readonly estimatedLoss?: number;
}

export interface MovementSummaryRow {
  readonly type: string;
  readonly movementCount: number;
  readonly quantity: number;
}

export interface AlertSummaryRow {
  readonly type: string;
  readonly status: string;
  readonly alertCount: number;
}

export interface InventoryBiResult {
  readonly summary: InventorySummary;
  readonly stockByCategory: readonly StockByCategoryRow[];
  readonly expirationRisk: readonly ExpirationRiskRow[];
  readonly movementSummary: readonly MovementSummaryRow[];
  readonly alertsSummary: readonly AlertSummaryRow[];
}

function canViewValuation(role: InventoryBiRole): boolean {
  return role === "owner_admin" || role === "inventory_manager";
}

function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year") ?? "0000"}-${values.get("month") ?? "00"}-${values.get("day") ?? "00"}`;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function isRole(value: readonly string[]): InventoryBiRole {
  if (value.includes("owner_admin")) return "owner_admin";
  if (value.includes("inventory_manager")) return "inventory_manager";
  return "seller";
}

/**
 * DataMart-aligned OLAP projection. It deliberately filters every input by
 * tenantId so it can be reused by unit tests and future adapters over dw views.
 */
export function aggregateInventoryBi(
  dataset: InventoryBiDataset,
  tenantId: string,
  role: InventoryBiRole,
  today = "2026-01-01",
): InventoryBiResult {
  const products = dataset.products.filter((row) => row.tenantId === tenantId);
  const lots = dataset.lots.filter((row) => row.tenantId === tenantId);
  const movements = dataset.movements.filter(
    (row) => row.tenantId === tenantId,
  );
  const alerts = dataset.alerts.filter((row) => row.tenantId === tenantId);
  const valuationAllowed = canViewValuation(role);
  const stockByProduct = new Map<string, number>();
  const valueByProduct = new Map<string, number>();
  for (const lot of lots) {
    stockByProduct.set(
      lot.productId,
      (stockByProduct.get(lot.productId) ?? 0) + lot.availableQuantity,
    );
    valueByProduct.set(
      lot.productId,
      (valueByProduct.get(lot.productId) ?? 0) +
        lot.availableQuantity * lot.unitCost,
    );
  }
  const productById = new Map(products.map((product) => [product.id, product]));
  const expiringProducts = new Set<string>();
  const expiredProducts = new Set<string>();
  const expirationRisk = lots
    .filter((lot) => lot.availableQuantity > 0)
    .map((lot): ExpirationRiskRow => {
      const product = productById.get(lot.productId);
      const warningDays = product?.expiryAlertDays ?? 0;
      const riskState: ExpirationRiskRow["riskState"] =
        lot.expiresAt < today
          ? "EXPIRED"
          : warningDays > 0 && lot.expiresAt <= addDays(today, warningDays)
            ? "EXPIRING_SOON"
            : "OK";
      if (riskState === "EXPIRED") expiredProducts.add(lot.productId);
      if (riskState === "EXPIRING_SOON") expiringProducts.add(lot.productId);
      return {
        lotId: lot.id,
        productId: lot.productId,
        productName: lot.productName,
        categoryName: lot.categoryName,
        expiresAt: lot.expiresAt,
        availableQuantity: lot.availableQuantity,
        riskState,
        ...(valuationAllowed
          ? { estimatedLoss: lot.availableQuantity * lot.unitCost }
          : {}),
      };
    })
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt));
  const lowStockProducts = products.filter(
    (product) => (stockByProduct.get(product.id) ?? 0) < product.minimumStock,
  );
  const activeAlerts = alerts.filter((alert) => alert.status === "ACTIVE");
  const movementMap = new Map<string, MovementSummaryRow>();
  for (const movement of movements) {
    const previous = movementMap.get(movement.type);
    movementMap.set(movement.type, {
      type: movement.type,
      movementCount: (previous?.movementCount ?? 0) + 1,
      quantity: (previous?.quantity ?? 0) + movement.quantity,
    });
  }
  const categoryMap = new Map<string, StockByCategoryRow>();
  for (const product of products) {
    const key = product.categoryId ?? "uncategorized";
    const previous = categoryMap.get(key);
    const stock = stockByProduct.get(product.id) ?? 0;
    const row: StockByCategoryRow = {
      categoryId: product.categoryId,
      categoryName: product.categoryName ?? "Sin categoría",
      stockAvailable: (previous?.stockAvailable ?? 0) + stock,
      lowStockProducts:
        (previous?.lowStockProducts ?? 0) +
        (stock < product.minimumStock ? 1 : 0),
      ...(valuationAllowed
        ? {
            inventoryValuation:
              (previous?.inventoryValuation ?? 0) +
              (valueByProduct.get(product.id) ?? 0),
          }
        : {}),
    };
    categoryMap.set(key, row);
  }
  const alertMap = new Map<string, AlertSummaryRow>();
  for (const alert of activeAlerts) {
    const key = `${alert.type}:${alert.status}`;
    const previous = alertMap.get(key);
    alertMap.set(key, {
      type: alert.type,
      status: alert.status,
      alertCount: (previous?.alertCount ?? 0) + 1,
    });
  }
  const summary: InventorySummary = {
    totalProducts: products.length,
    totalStockAvailable: [...stockByProduct.values()].reduce(
      (sum, value) => sum + value,
      0,
    ),
    lowStockProducts: lowStockProducts.length,
    productsExpiringSoon: expiringProducts.size,
    productsExpired: expiredProducts.size,
    activeAlerts: activeAlerts.length,
    ...(valuationAllowed
      ? {
          inventoryValuation: [...valueByProduct.values()].reduce(
            (sum, value) => sum + value,
            0,
          ),
        }
      : {}),
  };
  return {
    summary,
    stockByCategory: [...categoryMap.values()].sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName),
    ),
    expirationRisk,
    movementSummary: [...movementMap.values()].sort((a, b) =>
      a.type.localeCompare(b.type),
    ),
    alertsSummary: [...alertMap.values()].sort((a, b) =>
      a.type.localeCompare(b.type),
    ),
  };
}

export class InventoryBiService {
  public constructor(private readonly prisma: PrismaModule) {}

  private async assertAccess(
    context: TenantContext,
    permission = "inventory.stock.read",
  ): Promise<InventoryBiRole> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    if (!context.permissions.includes(permission))
      throw new TenantPermissionError();
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
    return isRole(context.roles);
  }

  private async snapshot(
    context: TenantContext,
  ): Promise<{ readonly dataset: InventoryBiDataset; readonly today: string }> {
    return this.prisma.execute(async (client) => {
      const tenant = await client.tenant.findUnique({
        where: { id: context.tenantId },
        select: { operatingTimeZone: true },
      });
      const [products, lots, balances, movements, alerts] = await Promise.all([
        client.product.findMany({
          where: { tenantId: context.tenantId },
          select: {
            id: true,
            tenantId: true,
            name: true,
            categoryId: true,
            minimumStock: true,
            expiryAlertDays: true,
            category: { select: { name: true } },
          },
        }),
        client.lot.findMany({
          where: { tenantId: context.tenantId },
          select: {
            id: true,
            tenantId: true,
            productId: true,
            expiresAt: true,
            availableQuantity: true,
            unitCost: true,
            status: true,
            product: {
              select: { name: true, category: { select: { name: true } } },
            },
          },
        }),
        client.inventoryBalance.findMany({
          where: { tenantId: context.tenantId },
          select: { lotId: true, availableQuantity: true },
        }),
        client.inventoryMovement.findMany({
          where: { tenantId: context.tenantId },
          select: {
            tenantId: true,
            type: true,
            quantity: true,
            createdAt: true,
          },
        }),
        client.inventoryAlert.findMany({
          where: { tenantId: context.tenantId },
          select: {
            tenantId: true,
            type: true,
            status: true,
            productId: true,
            lotId: true,
            triggeredAt: true,
            product: { select: { name: true } },
          },
        }),
      ]);
      const balanceByLot = new Map(
        balances.map((balance) => [
          balance.lotId,
          Number(balance.availableQuantity),
        ]),
      );
      return {
        dataset: {
          products: products.map((product) => ({
            tenantId: product.tenantId,
            id: product.id,
            name: product.name,
            categoryId: product.categoryId,
            categoryName: product.category?.name ?? null,
            minimumStock: Number(product.minimumStock),
            expiryAlertDays: product.expiryAlertDays,
          })),
          lots: lots.map((lot) => ({
            tenantId: lot.tenantId,
            id: lot.id,
            productId: lot.productId,
            productName: lot.product.name,
            categoryName: lot.product.category?.name ?? null,
            expiresAt: lot.expiresAt.toISOString().slice(0, 10),
            availableQuantity:
              balanceByLot.get(lot.id) ?? Number(lot.availableQuantity),
            unitCost: Number(lot.unitCost),
            status: lot.status,
          })),
          movements: movements.map((movement) => ({
            tenantId: movement.tenantId,
            type: movement.type,
            quantity: Number(movement.quantity),
            createdAt: movement.createdAt.toISOString(),
          })),
          alerts: alerts.map((alert) => ({
            tenantId: alert.tenantId,
            type: alert.type,
            status: alert.status,
            productId: alert.productId,
            productName: alert.product.name,
            lotId: alert.lotId,
            triggeredAt: alert.triggeredAt.toISOString(),
          })),
        },
        today: localDate(
          new Date(),
          tenant?.operatingTimeZone ?? "America/Lima",
        ),
      };
    });
  }

  public async getInventorySummary(
    context: TenantContext,
  ): Promise<InventorySummary> {
    const role = await this.assertAccess(context);
    const snapshot = await this.snapshot(context);
    return aggregateInventoryBi(
      snapshot.dataset,
      context.tenantId,
      role,
      snapshot.today,
    ).summary;
  }

  public async getStockByCategory(
    context: TenantContext,
  ): Promise<readonly StockByCategoryRow[]> {
    const role = await this.assertAccess(context);
    const snapshot = await this.snapshot(context);
    return aggregateInventoryBi(
      snapshot.dataset,
      context.tenantId,
      role,
      snapshot.today,
    ).stockByCategory;
  }

  public async getExpirationRisk(
    context: TenantContext,
  ): Promise<readonly ExpirationRiskRow[]> {
    const role = await this.assertAccess(context);
    const snapshot = await this.snapshot(context);
    return aggregateInventoryBi(
      snapshot.dataset,
      context.tenantId,
      role,
      snapshot.today,
    ).expirationRisk;
  }

  public async getMovementSummary(
    context: TenantContext,
  ): Promise<readonly MovementSummaryRow[]> {
    const role = await this.assertAccess(context, "inventory.movements.read");
    const snapshot = await this.snapshot(context);
    return aggregateInventoryBi(
      snapshot.dataset,
      context.tenantId,
      role,
      snapshot.today,
    ).movementSummary;
  }

  public async getAlertsSummary(
    context: TenantContext,
  ): Promise<readonly AlertSummaryRow[]> {
    const role = await this.assertAccess(context, "inventory.alerts.read");
    const snapshot = await this.snapshot(context);
    return aggregateInventoryBi(
      snapshot.dataset,
      context.tenantId,
      role,
      snapshot.today,
    ).alertsSummary;
  }

  public async getDashboard(
    context: TenantContext,
  ): Promise<InventoryBiResult> {
    const role = await this.assertAccess(context);
    const snapshot = await this.snapshot(context);
    return aggregateInventoryBi(
      snapshot.dataset,
      context.tenantId,
      role,
      snapshot.today,
    );
  }
}
