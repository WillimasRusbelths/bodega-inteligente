import type { AuditResult, Prisma } from "@prisma/client";
import { decodeCursor, encodeCursor } from "../../../common/http/cursor.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import { sanitizeAuditPayload } from "../services/audit.service.js";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_MAX_PAGE_SIZE = 100;

export type AuditQueryErrorCode = "AUDIT_NOT_FOUND" | "AUDIT_INVALID_QUERY";

export class AuditQueryError extends Error {
  public readonly code: AuditQueryErrorCode;

  public constructor(code: AuditQueryErrorCode) {
    super("The audit resource could not be returned.");
    this.name = "AuditQueryError";
    this.code = code;
  }
}

export interface AuditEventQuery {
  readonly cursor?: string;
  readonly action?: string;
  readonly result?: AuditResult;
  readonly limit?: number;
}

function assertOwnerContext(context: TenantContext | undefined): TenantContext {
  if (
    !isTenantContext(context) ||
    !context.roles.includes("owner_admin") ||
    !context.permissions.includes("access.audit.read")
  ) {
    throw new AuditQueryError("AUDIT_NOT_FOUND");
  }
  return context;
}

function pageSize(limit: number | undefined): number {
  const value = limit ?? AUDIT_PAGE_SIZE;
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > AUDIT_MAX_PAGE_SIZE
  ) {
    throw new AuditQueryError("AUDIT_INVALID_QUERY");
  }
  return value;
}

function serializeEvent(event: {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: AuditResult;
  reasonCode: string | null;
  beforeSanitized: Prisma.JsonValue;
  afterSanitized: Prisma.JsonValue;
  correlationId: string;
  occurredAt: Date;
}): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: event.id,
    action: event.action,
    result: event.result,
    actorId: event.actorId,
    targetType: event.targetType,
    targetId: event.targetId,
    reason: event.reasonCode,
    occurredAt: event.occurredAt.toISOString(),
    correlationId: event.correlationId,
    before:
      event.beforeSanitized === null
        ? null
        : sanitizeAuditPayload(event.beforeSanitized),
    after:
      event.afterSanitized === null
        ? null
        : sanitizeAuditPayload(event.afterSanitized),
  });
}

/** Tenant-scoped read boundary; callers never provide a tenant identifier. */
export class AuditRepository {
  public constructor(private readonly prisma: PrismaModule) {}

  public list(
    candidateContext: TenantContext | undefined,
    query: AuditEventQuery = {},
  ): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly nextCursor: string | null;
  }> {
    const context = assertOwnerContext(candidateContext);
    const limit = pageSize(query.limit);
    let cursor: ReturnType<typeof decodeCursor> | undefined;
    try {
      cursor =
        query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    } catch {
      throw new AuditQueryError("AUDIT_INVALID_QUERY");
    }
    const occurredAt =
      cursor === undefined ? undefined : new Date(cursor.occurredAt);
    if (occurredAt !== undefined && Number.isNaN(occurredAt.getTime())) {
      throw new AuditQueryError("AUDIT_INVALID_QUERY");
    }

    return this.prisma.execute(async (client) => {
      const rows = await client.auditEvent.findMany({
        where: {
          tenantId: context.tenantId,
          ...(query.action === undefined ? {} : { action: query.action }),
          ...(query.result === undefined ? {} : { result: query.result }),
          ...(cursor === undefined || occurredAt === undefined
            ? {}
            : {
                OR: [
                  { occurredAt: { lt: occurredAt } },
                  { occurredAt, id: { lt: cursor.id } },
                ],
              }),
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const hasNext = rows.length > limit;
      const selected = rows.slice(0, limit);
      const last = selected.at(-1);
      return {
        items: selected.map(serializeEvent),
        nextCursor:
          hasNext && last !== undefined
            ? encodeCursor({
                id: last.id,
                occurredAt: last.occurredAt.toISOString(),
              })
            : null,
      };
    });
  }

  public find(
    candidateContext: TenantContext | undefined,
    eventId: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    const context = assertOwnerContext(candidateContext);
    return this.prisma.execute(async (client) => {
      const event = await client.auditEvent.findFirst({
        where: { id: eventId, tenantId: context.tenantId },
      });
      if (event === null) throw new AuditQueryError("AUDIT_NOT_FOUND");
      return serializeEvent(event);
    });
  }
}
