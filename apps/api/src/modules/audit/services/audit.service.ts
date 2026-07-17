import type { Prisma } from "@prisma/client";
import {
  isSensitiveLogKey,
  redactLogText,
  REDACTED_VALUE,
} from "../../../common/logging/redaction.js";

export type AuditActorType = "TECHNICAL_ADMIN" | "USER" | "SYSTEM";
export type AuditResult = "SUCCEEDED" | "DENIED" | "FAILED";

export interface AppendAuditEventInput {
  readonly tenantId: string | null;
  readonly actorType: AuditActorType;
  readonly actorId?: string | null;
  readonly effectiveMembershipId?: string | null;
  readonly sessionId?: string | null;
  /** DeviceProfile identifier resolved by the authenticated server context. */
  readonly deviceProfileId?: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string | null;
  readonly result: AuditResult;
  readonly reasonCode?: string | null;
  readonly correlationId: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly occurredAt?: Date;
  readonly allowGlobalTechnicalEvent?: boolean;
}

const omittedCommercialKeys = new Set([
  "sale",
  "sales",
  "venta",
  "ventas",
  "client",
  "clients",
  "cliente",
  "clientes",
  "cost",
  "costs",
  "costo",
  "costos",
  "margin",
  "margins",
  "margen",
  "margenes",
  "inventory",
  "inventario",
  "product",
  "products",
  "producto",
  "productos",
  "lot",
  "lots",
  "lote",
  "lotes",
  "price",
  "prices",
  "precio",
  "precios",
]);

function normalizedKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]/giu, "")
    .toLowerCase();
}

function isAuditSecretKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return (
    isSensitiveLogKey(key) ||
    normalized.includes("pin") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("pepper") ||
    normalized.includes("hmackey") ||
    normalized.includes("biometric") ||
    normalized === "phonee164" ||
    normalized.endsWith("hash")
  );
}

function sanitizeValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (typeof value === "string") return redactLogText(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return null;
  if (ancestors.has(value)) return "[CIRCULAR]";
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, ancestors));
    }
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const normalized = normalizedKey(key);
      if (omittedCommercialKeys.has(normalized)) continue;
      output[key] = isAuditSecretKey(key)
        ? REDACTED_VALUE
        : sanitizeValue(nested, ancestors);
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

/** Defense-in-depth sanitizer used both before persistence and before response. */
export function sanitizeAuditPayload(value: unknown): Prisma.InputJsonValue {
  return sanitizeValue(value, new WeakSet<object>()) as Prisma.InputJsonValue;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`Audit ${field} is required.`);
  return normalized;
}

/** The sole runtime write boundary. It deliberately exposes append only. */
export class AuditService {
  public async append(
    transaction: Prisma.TransactionClient,
    input: AppendAuditEventInput,
  ): Promise<Readonly<Record<string, unknown>>> {
    if (
      input.tenantId === null &&
      (!input.allowGlobalTechnicalEvent ||
        input.actorType !== "TECHNICAL_ADMIN")
    ) {
      throw new Error(
        "Global audit events require an authorized technical actor.",
      );
    }
    const event = await transaction.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        effectiveMembershipId: input.effectiveMembershipId ?? null,
        sessionId: input.sessionId ?? null,
        deviceId: input.deviceProfileId ?? null,
        action: required(input.action, "action"),
        targetType: required(input.targetType, "targetType"),
        targetId: input.targetId ?? null,
        result: input.result,
        reasonCode:
          input.reasonCode === undefined || input.reasonCode === null
            ? null
            : redactLogText(input.reasonCode),
        ...(input.before === undefined
          ? {}
          : { beforeSanitized: sanitizeAuditPayload(input.before) }),
        ...(input.after === undefined
          ? {}
          : { afterSanitized: sanitizeAuditPayload(input.after) }),
        correlationId: required(input.correlationId, "correlationId"),
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
    return Object.freeze(event);
  }
}

/** In-memory adapter proving the public service remains append-only. */
export function createAuditAppendOnlyHarness(): {
  append(input: {
    tenantId: string;
    action: string;
    targetId: string;
  }): Promise<Readonly<Record<string, unknown>>>;
  disableSubject(targetId: string): void;
  list(): readonly Readonly<Record<string, unknown>>[];
} {
  const events: Readonly<Record<string, unknown>>[] = [];
  const disabledSubjects = new Set<string>();
  return {
    async append(input) {
      await Promise.resolve();
      const event = Object.freeze({ ...input });
      events.push(event);
      return event;
    },
    disableSubject(targetId) {
      disabledSubjects.add(targetId);
    },
    list() {
      void disabledSubjects;
      return Object.freeze([...events]);
    },
  };
}
