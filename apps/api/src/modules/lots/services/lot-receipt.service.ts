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
import { serializeLot } from "../dto/lot-response.dto.js";
import type { LotCreateDto, LotListQuery, LotStatus } from "../dto/lot.dto.js";

export type LotMutationCode =
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_PERMISSION"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "STALE_STATE";
export class LotMutationError extends Error {
  public constructor(public readonly code: LotMutationCode) {
    super(code);
    this.name = "LotMutationError";
  }
}

function digest(value: string): Uint8Array<ArrayBuffer> {
  return createHash("sha256")
    .update(value, "utf8")
    .digest() as Uint8Array<ArrayBuffer>;
}
function admin(context: TenantContext): boolean {
  return (
    context.roles.includes("owner_admin") ||
    context.roles.includes("inventory_manager")
  );
}
function requireContext(context: TenantContext, permission: string): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
  if (!context.permissions.includes(permission))
    throw new LotMutationError("INSUFFICIENT_PERMISSION");
}
function persistenceError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") throw new LotMutationError("CONFLICT");
    if (error.code === "P2003" || error.code === "P2025")
      throw new TenantResourceNotFoundError();
  }
  throw error;
}

export class LotReceiptService {
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

  public async createReceipt(
    context: TenantContext,
    productId: string,
    dto: LotCreateDto,
    idempotencyKey: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.lots.write");
    const includeCost = admin(context);
    return this.prisma.transaction(
      async (transaction) => {
        const keyHash = digest(idempotencyKey);
        const requestHash = digest(JSON.stringify({ productId, dto }));
        const previous = await transaction.idempotencyRecord.findUnique({
          where: {
            scopeActorId_tenantId_operation_idempotencyKeyHash: {
              scopeActorId: context.userId,
              tenantId: context.tenantId,
              operation: "createLotReceipt",
              idempotencyKeyHash: keyHash,
            },
          },
        });
        if (previous !== null) {
          if (!Buffer.from(previous.requestHash).equals(requestHash))
            throw new LotMutationError("CONFLICT");
          if (previous.responseBodySanitized !== null)
            return previous.responseBodySanitized as Readonly<
              Record<string, unknown>
            >;
        }
        try {
          const product = await transaction.product.findUnique({
            where: {
              tenantId_id: { tenantId: context.tenantId, id: productId },
            },
            select: { id: true },
          });
          if (product === null) throw new TenantResourceNotFoundError();
          const lot = await transaction.lot.create({
            data: {
              tenantId: context.tenantId,
              productId,
              receivedAt: dto.receivedAt,
              expiresAt: dto.expiresAt,
              initialQuantity: dto.initialQuantity,
              availableQuantity: dto.initialQuantity,
              unitCost: dto.unitCost,
              createdBy: context.userId,
            },
          });
          await transaction.inventoryMovement.create({
            data: {
              tenantId: context.tenantId,
              productId,
              lotId: lot.id,
              type: "RECEIPT",
              quantity: dto.initialQuantity,
              quantityDelta: dto.initialQuantity,
              balanceBefore: 0,
              balanceAfter: dto.initialQuantity,
              reason: dto.reason ?? "Initial lot receipt",
              actorId: context.userId,
            },
          });
          await transaction.inventoryBalance.create({
            data: {
              tenantId: context.tenantId,
              productId,
              lotId: lot.id,
              availableQuantity: dto.initialQuantity,
              reservedQuantity: 0,
            },
          });
          await this.alertHook.evaluate(
            transaction,
            context,
            productId,
            new Date(),
          );
          await this.audit.append(transaction, {
            tenantId: context.tenantId,
            actorType: "USER",
            actorId: context.userId,
            effectiveMembershipId: context.membershipId,
            action: "LOT_RECEIPT_CREATED",
            targetType: "Lot",
            targetId: lot.id,
            result: "SUCCEEDED",
            correlationId: randomUUID(),
            before: null,
            after: {
              productId,
              initialQuantity: dto.initialQuantity,
              expiresAt: dto.expiresAt,
              reason: dto.reason,
            },
          });
          const response = serializeLot(lot, includeCost);
          await transaction.idempotencyRecord.create({
            data: {
              scopeActorId: context.userId,
              tenantId: context.tenantId,
              operation: "createLotReceipt",
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

  public async listProductLots(
    context: TenantContext,
    productId: string,
    query: LotListQuery,
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    await this.assertMembership(context, "inventory.lots.read");
    return this.listLots(context, { ...query, productId });
  }

  public async listLots(
    context: TenantContext,
    query: LotListQuery,
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    await this.assertMembership(context, "inventory.lots.read");
    const now = new Date();
    const expiresAt: Prisma.DateTimeFilter = {};
    if (query.expiresBefore !== undefined) expiresAt.lt = query.expiresBefore;
    if (query.expiresAfter !== undefined) expiresAt.gte = query.expiresAfter;
    if (query.expirationState === "EXPIRED") expiresAt.lt = now;
    if (query.expirationState === "ACTIVE") expiresAt.gt = now;
    if (query.expirationState === "EXPIRING_SOON") {
      expiresAt.gte = now;
      expiresAt.lte = new Date(now.getTime() + 7 * 86_400_000);
    }
    if (
      query.includeExpired !== true &&
      query.expirationState !== "EXPIRED" &&
      query.status !== "EXPIRED"
    ) {
      expiresAt.gte = expiresAt.gte ?? now;
    }
    const where: Prisma.LotWhereInput = {
      tenantId: context.tenantId,
      ...(query.productId === undefined ? {} : { productId: query.productId }),
      ...(query.categoryId === undefined
        ? {}
        : { product: { categoryId: query.categoryId } }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(Object.keys(expiresAt).length === 0 ? {} : { expiresAt }),
    };
    const rows = await this.prisma.execute((client) =>
      client.lot.findMany({
        where,
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
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
    const page = rows
      .slice(0, query.limit)
      .map((lot) => serializeLot(lot, admin(context)));
    return {
      items: page,
      nextCursor:
        rows.length > query.limit ? (rows[query.limit - 1]?.id ?? null) : null,
    };
  }

  public async getLot(
    context: TenantContext,
    lotId: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.lots.read");
    const lot = await this.prisma.execute((client) =>
      client.lot.findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id: lotId } },
      }),
    );
    if (lot === null) throw new TenantResourceNotFoundError();
    return serializeLot(lot, admin(context));
  }

  public async changeStatus(
    context: TenantContext,
    lotId: string,
    status: LotStatus,
    expectedVersion: number,
  ): Promise<Readonly<Record<string, unknown>>> {
    await this.assertMembership(context, "inventory.lots.write");
    return this.prisma
      .transaction(
        async (transaction) => {
          const current = await transaction.lot.findUnique({
            where: { tenantId_id: { tenantId: context.tenantId, id: lotId } },
          });
          if (current === null) throw new TenantResourceNotFoundError();
          if (current.version !== expectedVersion)
            throw new LotMutationError("STALE_STATE");
          const updated = await transaction.lot.updateMany({
            where: {
              tenantId: context.tenantId,
              id: lotId,
              version: expectedVersion,
            },
            data: { status, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new LotMutationError("STALE_STATE");
          const result = await transaction.lot.findUniqueOrThrow({
            where: { tenantId_id: { tenantId: context.tenantId, id: lotId } },
          });
          await this.audit.append(transaction, {
            tenantId: context.tenantId,
            actorType: "USER",
            actorId: context.userId,
            effectiveMembershipId: context.membershipId,
            action: "LOT_STATUS_CHANGED",
            targetType: "Lot",
            targetId: lotId,
            result: "SUCCEEDED",
            correlationId: randomUUID(),
            before: { status: current.status },
            after: { status },
          });
          return serializeLot(result, admin(context));
        },
        { isolationLevel: "Serializable" },
      )
      .catch(persistenceError);
  }
}
