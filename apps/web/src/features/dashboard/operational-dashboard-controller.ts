import { SafeWebApiError } from "../../api/client.js";
import {
  DashboardContextGeneration,
  resourceState,
  type OperationalDashboardState,
  type ResourceState,
  type WebSessionContext,
} from "./operational-dashboard-state.js";

export type OperationalResourceLoaders<TResources extends Record<string, unknown>> = {
  readonly [K in keyof TResources]: (input: {
    readonly context: WebSessionContext;
    readonly signal: AbortSignal;
  }) => Promise<TResources[K]>;
};

type ResourceStates<TResources extends Record<string, unknown>> = {
  readonly [K in keyof TResources]: ResourceState<TResources[K]>;
};

function isEmptyResource(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function failedResource<T>(reason: unknown, cycle: number): ResourceState<T> {
  const correlationId =
    reason instanceof SafeWebApiError ? reason.correlationId : null;
  return resourceState.error(
    "No se pudieron cargar los datos operativos.",
    correlationId,
    cycle,
  ) as ResourceState<T>;
}

/**
 * Coordinates independent operational reads for one active session/tenant.
 * A new load aborts the old one and its completed results are ignored unless
 * their context key is still active.
 */
export class OperationalDashboardController<
  TResources extends Record<string, unknown>,
> {
  readonly #loaders: OperationalResourceLoaders<TResources>;
  readonly #contexts = new DashboardContextGeneration();
  #abortController: AbortController | null = null;
  #state: OperationalDashboardState<TResources> | null = null;

  public constructor(loaders: OperationalResourceLoaders<TResources>) {
    this.#loaders = loaders;
  }

  public snapshot(): OperationalDashboardState<TResources> | null {
    return this.#state;
  }

  public clear(): void {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#contexts.clear();
    this.#state = null;
  }

  public async load(
    context: WebSessionContext,
  ): Promise<OperationalDashboardState<TResources> | null> {
    this.#abortController?.abort();
    const abortController = new AbortController();
    this.#abortController = abortController;
    const active = this.#contexts.activate(context);
    const keys = Object.keys(this.#loaders) as (keyof TResources)[];
    const loading = {} as { [K in keyof TResources]: ResourceState<TResources[K]> };
    for (const key of keys) loading[key] = resourceState.loading(active.generation);

    this.#state = {
      context,
      contextKey: active.contextKey,
      generation: active.generation,
      resources: loading,
      sale: { status: "idle" },
    };

    const settled = await Promise.allSettled(
      keys.map((key) =>
        this.#loaders[key]({ context, signal: abortController.signal }),
      ),
    );
    if (
      abortController.signal.aborted ||
      !this.#contexts.accepts(active.contextKey)
    ) {
      return null;
    }

    const resources = {} as { [K in keyof TResources]: ResourceState<TResources[K]> };
    for (const [index, key] of keys.entries()) {
      const result = settled[index];
      if (result === undefined || result.status === "rejected") {
        resources[key] = failedResource<TResources[typeof key]>(
          result === undefined ? undefined : result.reason,
          active.generation,
        );
        continue;
      }
      resources[key] = isEmptyResource(result.value)
        ? (resourceState.empty(
            new Date().toISOString(),
            active.generation,
          ) as ResourceState<TResources[typeof key]>)
        : resourceState.ready(
            result.value,
            new Date().toISOString(),
            active.generation,
          );
    }

    const state: OperationalDashboardState<TResources> = {
      context,
      contextKey: active.contextKey,
      generation: active.generation,
      resources: resources as ResourceStates<TResources>,
      sale: { status: "idle" },
    };
    this.#state = state;
    return state;
  }
}
