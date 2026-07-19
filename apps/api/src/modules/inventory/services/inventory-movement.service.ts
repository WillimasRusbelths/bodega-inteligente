import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
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
import { InventoryAlertHookService } from "../../alerts/services/inventory-alert-hook.service.js";
import { operationalDate } from "./fefo.service.js";
import { serializeMovement } from "../../lots/dto/lot-response.dto.js";
import type {
  MovementCreateDto,
  MovementListQuery,
} from "../dto/movement.dto.js";

export type InventoryMutationCode =
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_PERMISSION"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "STALE_STATE"
  | "STOCK_INSUFFICIENT";
export class InventoryMutationError extends Error {
  public constructor(public readonly code: InventoryMutationCode) {
    super(code);
    this.name = "InventoryMutationError";
  }
}
function digest(value: string): Uint8Array<ArrayBuffer> {
  return createHash("sha256")
    .update(value, "utf8")
    .digest() as Uint8Array<ArrayBuffer>;
}
function requireContext(context: TenantContext, permission: string): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
  if (!context.permissions.includes(permission))
    throw new InventoryMutationError("INSUFFICIENT_PERMISSION");
}
function persistenceError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") throw new InventoryMutationError("CONFLICT");
    if (error.code === "P2003" || error.code === "P2025")
      throw new TenantResourceNotFoundError();
  }
  throw error;
}

export class InventoryMovementService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly audit = new AuditService(),
    private readonly alertHook = new InventoryAlertHookService(
      new AlertService(prisma),
    ),
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

  public async create(
    context: TenantContext,
    dto: MovementCreateDto,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.movements.write");
    if (dto.quantity <= 0 || dto.type === "SALE_OUT")
      throw new InventoryMutationError("VALIDATION_ERROR");
    const keyHash = digest(idempotencyKey);
    const requestHash = digest(JSON.stringify(dto));
    return this.prisma.transaction(
      async (transaction) => {
        const previous = await transaction.idempotencyRecord.findUnique({
          where: {
            scopeActorId_tenantId_operation_idempotencyKeyHash: {
              scopeActorId: context.userId,
              tenantId: context.tenantId,
              operation: "createInventoryMovement",
              idempotencyKeyHash: keyHash,
            },
          },
        });
        if (previous !== null) {
          if (!Buffer.from(previous.requestHash).equals(requestHash))
            throw new InventoryMutationError("CONFLICT");
          if (previous.responseBodySanitized !== null)
            return previous.responseBodySanitized as Readonly<
              Record<string, unknown>
            >;
        }
        try {
          const lot = await transaction.lot.findUnique({
            where: {
              tenantId_id: { tenantId: context.tenantId, id: dto.lotId },
            },
          });
          if (lot === null || lot.productId !== dto.productId)
            throw new TenantResourceNotFoundError();
          if (
            (dto.type === "NEGATIVE_ADJUSTMENT" || dto.type === "WASTE") &&
            !dto.allowExpiredManualAdjustment
          ) {
            const tenant = await transaction.tenant.findUnique({
              where: { id: context.tenantId },
              select: { operatingTimeZone: true },
            });
            if (tenant === null) throw new TenantResourceNotFoundError();
            const today = operationalDate(new Date(), tenant.operatingTimeZone);
            if (lot.expiresAt.toISOString().slice(0, 10) < today)
              throw new InventoryMutationError("VALIDATION_ERROR");
          }
          if (
            dto.allowExpiredManualAdjustment &&
            (!context.permissions.includes("inventory.stock.adjust") ||
              dto.reason.trim().length === 0)
          )
            throw new InventoryMutationError("INSUFFICIENT_PERMISSION");
          const before = Number(lot.availableQuantity);
          const delta =
            dto.type === "POSITIVE_ADJUSTMENT" || dto.type === "RECEIPT"
              ? dto.quantity
              : -dto.quantity;
          const after = before + delta;
          if (after < 0) throw new InventoryMutationError("STOCK_INSUFFICIENT");
          const updated = await transaction.lot.updateMany({
            where: {
              tenantId: context.tenantId,
              id: lot.id,
              version: lot.version,
            },
            data: {
              availableQuantity: after,
              status: after === 0 ? "DEPLETED" : "AVAILABLE",
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new InventoryMutationError("STALE_STATE");
          const movement = await transaction.inventoryMovement.create({
            data: {
              tenantId: context.tenantId,
              productId: dto.productId,
              lotId: dto.lotId,
              type: dto.type,
              quantity: dto.quantity,
              quantityDelta: delta,
              balanceBefore: before,
              balanceAfter: after,
              reason: dto.reason,
              actorId: context.userId,
            },
          });
          await transaction.inventoryBalance.upsert({
            where: {
              tenantId_productId_lotId: {
                tenantId: context.tenantId,
                productId: dto.productId,
                lotId: dto.lotId,
              },
            },
            update: { availableQuantity: after, version: { increment: 1 } },
            create: {
              tenantId: context.tenantId,
              productId: dto.productId,
              lotId: dto.lotId,
              availableQuantity: after,
              reservedQuantity: 0,
            },
          });
          await this.alertHook.evaluate(
            transaction,
            context,
            dto.productId,
            new Date(),
          );
          await this.audit.append(transaction, {
            tenantId: context.tenantId,
            actorType: "USER",
            actorId: context.userId,
            effectiveMembershipId: context.membershipId,
            action: "INVENTORY_MOVEMENT_CREATED",
            targetType: "InventoryMovement",
            targetId: movement.id,
            result: "SUCCEEDED",
            correlationId: randomUUID(),
            before: { availableQuantity: before },
            after: {
              type: dto.type,
              quantity: dto.quantity,
              availableQuantity: after,
              reason: dto.reason,
            },
          });
          const response = serializeMovement(movement);
          await transaction.idempotencyRecord.create({
            data: {
              scopeActorId: context.userId,
              tenantId: context.tenantId,
              operation: "createInventoryMovement",
              idempotencyKeyHash: keyHash,
              requestHash,
              responseStatus: 201,
              responseBodySanitized: response as Prisma.InputJsonValue,
              expiresAt: new Date(Date.now() + 86_400_000),
            },
          });
          return response;
        } catch (error) {
          persistenceError(error);
        }
      },
      { isolationLevel: "Serializable" },
    );
  }

  public async list(
    context: TenantContext,
    query: MovementListQuery,
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    await this.assertMembership(context, "inventory.movements.read");
    const rows = await this.prisma.execute((client) =>
      client.inventoryMovement.findMany({
        where: {
          tenantId: context.tenantId,
          ...(query.productId === undefined
            ? {}
            : { productId: query.productId }),
          ...(query.lotId === undefined ? {} : { lotId: query.lotId }),
          ...(query.type === undefined ? {} : { type: query.type }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    return {
      items: rows.slice(0, query.limit).map(serializeMovement),
      nextCursor:
        rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
    };
  }
}
