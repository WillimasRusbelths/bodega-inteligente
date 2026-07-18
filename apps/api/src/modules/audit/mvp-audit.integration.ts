import type { Prisma } from "@prisma/client";
import type {
  AuditedTransaction,
  AuditedOperationResult,
} from "./audited-transaction.js";
import {
  sanitizeAuditPayload,
  type AppendAuditEventInput,
} from "./services/audit.service.js";

export const MVP_AUDITED_OPERATIONS = Object.freeze([
  "TENANT_BOOTSTRAPPED",
  "IDENTITY_CHANGED",
  "MEMBERSHIP_CREATED",
  "ACTIVATION_ISSUED",
  "ACTIVATION_CONSUMED",
  "PIN_DEVICE_CONFIGURED",
  "SESSION_STARTED",
  "SESSION_REFRESHED",
  "SESSION_ENDED",
  "ACTIVE_TENANT_CHANGED",
  "MEMBERSHIP_ROLES_CHANGED",
  "MEMBERSHIP_DISABLED",
  "MEMBERSHIP_REACTIVATED",
  "TENANT_ACCESS_DENIED",
] as const);

export type MvpAuditedOperation = (typeof MVP_AUDITED_OPERATIONS)[number];

export function isMvpAuditedOperation(
  value: string,
): value is MvpAuditedOperation {
  return (MVP_AUDITED_OPERATIONS as readonly string[]).includes(value);
}

export type MvpAuditContext = Omit<AppendAuditEventInput, "action">;

/**
 * Production integration point for MVP mutations. The operation callback cannot
 * append audit itself: this boundary derives the action from the closed catalog
 * and delegates exactly one append to AuditedTransaction.
 */
export class MvpAuditIntegration {
  public constructor(private readonly transactions: AuditedTransaction) {}

  public execute<TResult>(
    operation: MvpAuditedOperation,
    context: MvpAuditContext,
    mutate: (transaction: Prisma.TransactionClient) => Promise<TResult>,
  ): Promise<TResult> {
    return this.transactions.execute(async (transaction) => {
      const result = await mutate(transaction);
      return {
        result,
        audit: { ...context, action: operation },
      } satisfies AuditedOperationResult<TResult>;
    });
  }
}

interface HarnessEvent {
  readonly action: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly result: "SUCCEEDED";
  readonly before: unknown;
  readonly after: unknown;
}

interface HarnessState {
  changes: string[];
  events: HarnessEvent[];
}

/** Test adapter mirrors the copy-on-write semantics of a DB transaction. */
export function createAuditedTransactionHarness(options: {
  state: HarnessState;
}): {
  execute(input: {
    operation: string;
    tenantId: string;
    correlationId: string;
    before?: unknown;
    after?: unknown;
    failOperation?: boolean;
    failAudit?: boolean;
  }): Promise<void>;
} {
  return {
    async execute(input) {
      await Promise.resolve();
      if (!isMvpAuditedOperation(input.operation)) {
        throw new Error("The MVP operation is not registered for audit.");
      }
      const pendingChanges = [...options.state.changes];
      const pendingEvents = [...options.state.events];
      if (input.failOperation) throw new Error("Sensitive operation failed.");
      pendingChanges.push(input.operation);
      if (input.failAudit) throw new Error("AuditEvent insertion failed.");
      pendingEvents.push({
        action: input.operation,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        result: "SUCCEEDED",
        before: sanitizeAuditPayload(input.before ?? null),
        after: sanitizeAuditPayload(input.after ?? null),
      });
      options.state.changes.splice(
        0,
        options.state.changes.length,
        ...pendingChanges,
      );
      options.state.events.splice(
        0,
        options.state.events.length,
        ...pendingEvents,
      );
    },
  };
}
