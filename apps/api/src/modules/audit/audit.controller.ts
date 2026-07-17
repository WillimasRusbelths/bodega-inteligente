import type { TenantContext } from "../access/context/tenant-context.js";
import {
  AuditQueryError,
  type AuditEventQuery,
  type AuditRepository,
} from "./repositories/audit.repository.js";
import { sanitizeAuditPayload } from "./services/audit.service.js";

const contractQueryKeys = new Set(["cursor", "action", "result"]);

function parseQuery(
  value: unknown,
  allowInternalLimit = false,
): AuditEventQuery {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AuditQueryError("AUDIT_INVALID_QUERY");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) =>
        !contractQueryKeys.has(key) && !(allowInternalLimit && key === "limit"),
    )
  ) {
    throw new AuditQueryError("AUDIT_INVALID_QUERY");
  }
  const cursor = input["cursor"];
  const action = input["action"];
  const result = input["result"];
  const limit = input["limit"];
  if (
    (cursor !== undefined && typeof cursor !== "string") ||
    (action !== undefined && typeof action !== "string") ||
    (result !== undefined &&
      result !== "SUCCEEDED" &&
      result !== "DENIED" &&
      result !== "FAILED") ||
    (limit !== undefined && typeof limit !== "number")
  ) {
    throw new AuditQueryError("AUDIT_INVALID_QUERY");
  }
  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(action === undefined ? {} : { action }),
    ...(result === undefined ? {} : { result }),
    ...(limit === undefined ? {} : { limit }),
  };
}

/** OpenAPI boundary for GET /tenants/current/audit-events. */
export class AuditController {
  public constructor(private readonly repository: AuditRepository) {}

  public listCurrentTenantAuditEvents(
    context: TenantContext | undefined,
    query?: unknown,
  ): ReturnType<AuditRepository["list"]> {
    return this.repository.list(context, parseQuery(query));
  }
}

interface PrivacyHarnessEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly action: string;
  readonly result: "SUCCEEDED" | "DENIED" | "FAILED";
  readonly occurredAt: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

function assertHarnessContext(
  context: TenantContext | undefined,
): TenantContext {
  if (
    context === undefined ||
    !context.roles.includes("owner_admin") ||
    !context.permissions.includes("access.audit.read")
  ) {
    throw new AuditQueryError("AUDIT_NOT_FOUND");
  }
  return context;
}

/** Test adapter for isolation, strict query validation and response sanitization. */
export function createAuditPrivacyHarness(options: {
  events: readonly PrivacyHarnessEvent[];
}): {
  list(
    context: TenantContext | undefined,
    query?: Record<string, unknown>,
  ): Promise<{
    items: readonly Record<string, unknown>[];
    nextCursor: string | null;
  }>;
  find(
    context: TenantContext,
    eventId: string,
  ): Promise<Readonly<Record<string, unknown>>>;
} {
  const serialize = (
    event: PrivacyHarnessEvent,
  ): Readonly<Record<string, unknown>> =>
    Object.freeze({
      id: event.id,
      action: event.action,
      result: event.result,
      occurredAt: event.occurredAt,
      before: sanitizeAuditPayload(event.before ?? null),
      after: sanitizeAuditPayload(event.after ?? null),
    });

  return {
    async list(candidateContext, query = {}) {
      await Promise.resolve();
      const context = assertHarnessContext(candidateContext);
      const parsed = parseQuery(query, true);
      const limit = parsed.limit ?? 50;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new AuditQueryError("AUDIT_INVALID_QUERY");
      }
      const matching = options.events
        .filter(
          (event) =>
            event.tenantId === context.tenantId &&
            (parsed.action === undefined || event.action === parsed.action) &&
            (parsed.result === undefined || event.result === parsed.result),
        )
        .sort(
          (left, right) =>
            right.occurredAt.localeCompare(left.occurredAt) ||
            right.id.localeCompare(left.id),
        );
      const items = matching.slice(0, limit).map(serialize);
      return {
        items,
        nextCursor: matching.length > limit ? "opaque-cursor" : null,
      };
    },
    async find(candidateContext, eventId) {
      await Promise.resolve();
      const context = assertHarnessContext(candidateContext);
      const event = options.events.find(
        (candidate) =>
          candidate.id === eventId && candidate.tenantId === context.tenantId,
      );
      if (event === undefined) throw new AuditQueryError("AUDIT_NOT_FOUND");
      return serialize(event);
    },
  };
}
