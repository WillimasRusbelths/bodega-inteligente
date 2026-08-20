/**
 * Ephemeral state shared by the operational dashboard.  This module deliberately
 * contains no storage access and no stock arithmetic: resource values always
 * remain values supplied by their authoritative API reader.
 */
export interface WebSessionContext {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly capabilities: readonly string[];
}

export type ResourceState<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly cycle: number }
  | {
      readonly status: "ready";
      readonly data: T;
      readonly receivedAt: string;
      readonly cycle: number;
    }
  | {
      readonly status: "empty";
      readonly receivedAt: string;
      readonly cycle: number;
    }
  | {
      readonly status: "error";
      readonly message: string;
      readonly correlationId: string | null;
      readonly cycle: number;
    }
  | {
      readonly status: "stale";
      readonly data: T;
      readonly reason: string;
      readonly correlationId: string | null;
      readonly cycle: number;
    };

export type SaleMutationState<TSale = unknown> =
  | { readonly status: "idle" }
  | { readonly status: "submitting"; readonly idempotencyKey: string }
  | {
      readonly status: "succeeded";
      readonly sale: TSale;
      readonly confirmedAt: string;
    }
  | {
      readonly status: "error";
      readonly message: string;
      readonly correlationId: string | null;
      readonly idempotencyKey: string;
    };

export interface OperationalDashboardState<TResources = Record<string, unknown>> {
  readonly context: WebSessionContext | null;
  readonly contextKey: string | null;
  readonly generation: number;
  readonly resources: {
    readonly [K in keyof TResources]: ResourceState<TResources[K]>;
  };
  readonly sale: SaleMutationState;
}

export const resourceState = {
  idle: (): ResourceState<never> => ({ status: "idle" }),
  loading: (cycle: number): ResourceState<never> => ({ status: "loading", cycle }),
  ready: <T>(data: T, receivedAt: string, cycle: number): ResourceState<T> => ({
    status: "ready",
    data,
    receivedAt,
    cycle,
  }),
  empty: (receivedAt: string, cycle: number): ResourceState<never> => ({
    status: "empty",
    receivedAt,
    cycle,
  }),
  error: (
    message: string,
    correlationId: string | null,
    cycle: number,
  ): ResourceState<never> => ({ status: "error", message, correlationId, cycle }),
  stale: <T>(
    data: T,
    reason: string,
    correlationId: string | null,
    cycle: number,
  ): ResourceState<T> => ({
    status: "stale",
    data,
    reason,
    correlationId,
    cycle,
  }),
};

function createContextKey(context: WebSessionContext): string {
  return [
    context.sessionId,
    context.tenantId,
    context.membershipId,
    ...[...context.capabilities].sort(),
  ].join("|");
}

/** Tracks the active in-memory context so stale network responses can be ignored. */
export class DashboardContextGeneration {
  #currentContextKey: string | null = null;
  #generation = 0;

  public activate(context: WebSessionContext): {
    readonly contextKey: string;
    readonly generation: number;
  } {
    this.#generation += 1;
    this.#currentContextKey = createContextKey(context);
    return { contextKey: this.#currentContextKey, generation: this.#generation };
  }

  public accepts(contextKey: string): boolean {
    return contextKey === this.#currentContextKey;
  }

  public clear(): void {
    this.#generation += 1;
    this.#currentContextKey = null;
  }

  /** No aggregate is retained here: operational data is memory-only in the controller. */
  public snapshot(): null {
    return null;
  }
}
