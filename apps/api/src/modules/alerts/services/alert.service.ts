import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { TenantContext } from "../../access/context/tenant-context.js";
import { isTenantContext } from "../../access/context/tenant-context.js";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../access/guards/authorization-errors.js";
import { AuditService } from "../../audit/services/audit.service.js";
import { serializeAlert } from "../dto/alert-response.dto.js";
import type { AlertListQuery } from "../repositories/alert.repository.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

export type AlertMutationCode =
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_PERMISSION"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "STALE_STATE";

export class AlertMutationError extends Error {
  public constructor(public readonly code: AlertMutationCode) {
    super(code);
    this.name = "AlertMutationError";
  }
}

function digest(value: string): Uint8Array<ArrayBuffer> {
  return createHash("sha256")
    .update(value, "utf8")
    .digest() as Uint8Array<ArrayBuffer>;
}

function requirePermission(context: TenantContext, permission: string): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
  if (!context.permissions.includes(permission))
    throw new AlertMutationError("INSUFFICIENT_PERMISSION");
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

function lotDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function plusDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Transaction = Prisma.TransactionClient;

export interface AlertConditionInput {
  readonly totalStock: number;
  readonly minimumStock: number;
  readonly expiryAlertDays: number;
  readonly today: string;
  readonly lots: readonly {
    readonly id: string;
    readonly expiresAt: Date;
    readonly availableQuantity: number;
  }[];
}

export interface AlertCondition {
  readonly type: "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED";
  readonly lotId: string | null;
  readonly observed: number;
  readonly threshold: number;
}

export function evaluateAlertConditions(
  input: AlertConditionInput,
): readonly AlertCondition[] {
  const conditions: AlertCondition[] = [];
  if (input.totalStock < input.minimumStock)
    conditions.push({
      type: "LOW_STOCK",
      lotId: null,
      observed: input.totalStock,
      threshold: input.minimumStock,
    });
  for (const lot of input.lots) {
    if (lot.availableQuantity <= 0) continue;
    const expires = lotDate(lot.expiresAt);
    if (expires < input.today)
      conditions.push({
        type: "EXPIRED",
        lotId: lot.id,
        observed: 0,
        threshold: 0,
      });
    else if (
      input.expiryAlertDays > 0 &&
      expires <= plusDays(input.today, input.expiryAlertDays)
    )
      conditions.push({
        type: "EXPIRING_SOON",
        lotId: lot.id,
        observed: 0,
        threshold: input.expiryAlertDays,
      });
  }
  return conditions;
}

export class AlertService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly audit = new AuditService(),
  ) {}

  private async assertMembership(
    context: TenantContext,
    permission: string,
  ): Promise<void> {
    requirePermission(context, permission);
    const valid = await this.prisma.execute(async (client) => {
      const membership = await client.membership.findUnique({
        where: {
          tenantId_id: { tenantId: context.tenantId, id: context.membershipId },
        },
        select: { userId: true, status: true },
      });
      const tenant = await client.tenant.findUnique({
        where: { id: context.tenantId },
        select: { status: true },
      });
      return (
        membership?.userId === context.userId &&
        membership.status === "ACTIVE" &&
        tenant?.status === "ACTIVE"
      );
    });
    if (!valid) throw new TenantSessionInvalidError();
  }

  public async list(
    context: TenantContext,
    query: AlertListQuery,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.alerts.read");
    const rows = await this.prisma.execute(async (client) => {
      const where: Prisma.InventoryAlertWhereInput = {
        tenantId: context.tenantId,
        ...(query.type === undefined ? {} : { type: query.type }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.categoryId === undefined
          ? {}
          : { product: { categoryId: query.categoryId } }),
      };
      const items = await client.inventoryAlert.findMany({
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
        items,
        nextCursor:
          items.length > query.limit
            ? (items[query.limit - 1]?.id ?? null)
            : null,
      };
    });
    return {
      items: rows.items.slice(0, query.limit).map(serializeAlert),
      nextCursor: rows.nextCursor,
    };
  }

  public async resolve(
    context: TenantContext,
    alertId: string,
    reason: string | undefined,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.alerts.write");
    if (reason !== undefined && reason.trim().length === 0)
      throw new AlertMutationError("VALIDATION_ERROR");
    const keyHash = digest(idempotencyKey);
    const requestHash = digest(JSON.stringify({ alertId, reason }));
    return this.prisma.transaction(
      async (transaction) => {
        const previous = await transaction.idempotencyRecord.findUnique({
          where: {
            scopeActorId_tenantId_operation_idempotencyKeyHash: {
              scopeActorId: context.userId,
              tenantId: context.tenantId,
              operation: "resolveInventoryAlert",
              idempotencyKeyHash: keyHash,
            },
          },
        });
        if (previous !== null) {
          if (!Buffer.from(previous.requestHash).equals(requestHash))
            throw new AlertMutationError("CONFLICT");
          if (previous.responseBodySanitized !== null)
            return previous.responseBodySanitized as Readonly<
              Record<string, unknown>
            >;
        }
        const alert = await transaction.inventoryAlert.findUnique({
          where: { tenantId_id: { tenantId: context.tenantId, id: alertId } },
        });
        if (alert === null) throw new TenantResourceNotFoundError();
        if (alert.status !== "ACTIVE")
          throw new AlertMutationError("STALE_STATE");
        const resolved = await transaction.inventoryAlert.update({
          where: { tenantId_id: { tenantId: context.tenantId, id: alertId } },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolvedBy: context.userId,
          },
        });
        await this.audit.append(transaction, {
          tenantId: context.tenantId,
          actorType: "USER",
          actorId: context.userId,
          effectiveMembershipId: context.membershipId,
          action: "INVENTORY_ALERT_RESOLVED",
          targetType: "InventoryAlert",
          targetId: alert.id,
          result: "SUCCEEDED",
          ...(reason === undefined ? {} : { reasonCode: reason }),
          correlationId: randomUUID(),
          before: { status: alert.status, type: alert.type },
          after: { status: resolved.status },
        });
        const response = serializeAlert(resolved);
        await transaction.idempotencyRecord.create({
          data: {
            scopeActorId: context.userId,
            tenantId: context.tenantId,
            operation: "resolveInventoryAlert",
            idempotencyKeyHash: keyHash,
            requestHash,
            responseStatus: 200,
            responseBodySanitized: response as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
        return response;
      },
      { isolationLevel: "Serializable" },
    );
  }

  public async evaluate(
    context: TenantContext,
    productId: string,
  ): Promise<void> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    await this.prisma.transaction((transaction) =>
      this.evaluateInTransaction(transaction, context, productId, new Date()),
    );
  }

  public async evaluateInTransaction(
    transaction: Transaction,
    context: TenantContext,
    productId: string,
    now: Date,
  ): Promise<void> {
    const product = await transaction.product.findUnique({
      where: { tenantId_id: { tenantId: context.tenantId, id: productId } },
      select: {
        id: true,
        minimumStock: true,
        expiryAlertDays: true,
        tenant: { select: { operatingTimeZone: true } },
        lots: {
          select: {
            id: true,
            expiresAt: true,
            availableQuantity: true,
            status: true,
          },
        },
        balances: { select: { availableQuantity: true } },
      },
    });
    if (product === null) throw new TenantResourceNotFoundError();
    await transaction.alertRule.upsert({
      where: {
        tenantId_productId: { tenantId: context.tenantId, productId },
      },
      update: {
        minimumStock: product.minimumStock,
        expiryAlertDays: product.expiryAlertDays,
        enabled: true,
      },
      create: {
        tenantId: context.tenantId,
        productId,
        minimumStock: product.minimumStock,
        expiryAlertDays: product.expiryAlertDays,
      },
    });
    const today = localDate(now, product.tenant.operatingTimeZone);
    const total = product.balances.reduce(
      (sum, row) => sum + Number(row.availableQuantity),
      0,
    );
    const desired = new Map<string, AlertCondition>();
    for (const condition of evaluateAlertConditions({
      totalStock: total,
      minimumStock: Number(product.minimumStock),
      expiryAlertDays: product.expiryAlertDays,
      today,
      lots: product.lots.map((lot) => ({
        id: lot.id,
        expiresAt: lot.expiresAt,
        availableQuantity: Number(lot.availableQuantity),
      })),
    }))
      desired.set(`${condition.type}:${condition.lotId ?? "null"}`, condition);
    const active = await transaction.inventoryAlert.findMany({
      where: { tenantId: context.tenantId, productId, status: "ACTIVE" },
    });
    for (const current of active) {
      const key = `${current.type}:${current.lotId ?? "null"}`;
      if (!desired.has(key))
        await transaction.inventoryAlert.update({
          where: {
            tenantId_id: { tenantId: context.tenantId, id: current.id },
          },
          data: { status: "RESOLVED", resolvedAt: now },
        });
    }
    for (const candidate of desired.values()) {
      const existing = await transaction.inventoryAlert.findFirst({
        where: {
          tenantId: context.tenantId,
          productId,
          lotId: candidate.lotId,
          type: candidate.type,
          status: "ACTIVE",
        },
      });
      if (existing !== null) continue;
      const created = await transaction.inventoryAlert.create({
        data: {
          tenantId: context.tenantId,
          productId,
          lotId: candidate.lotId,
          type: candidate.type,
          status: "ACTIVE",
          observedValue: candidate.observed,
          thresholdValue: candidate.threshold,
          triggeredAt: now,
        },
      });
      await this.audit.append(transaction, {
        tenantId: context.tenantId,
        actorType: "SYSTEM",
        action: "INVENTORY_ALERT_TRIGGERED",
        targetType: "InventoryAlert",
        targetId: created.id,
        result: "SUCCEEDED",
        correlationId: randomUUID(),
        after: { type: created.type, productId, lotId: created.lotId },
      });
    }
  }
}
