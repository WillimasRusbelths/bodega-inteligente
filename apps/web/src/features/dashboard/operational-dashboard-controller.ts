import { SafeWebApiError } from "../../api/client.js";
import {
  DashboardContextGeneration,
  resourceState,
  type OperationalDashboardState,
  type ResourceState,
  type SaleMutationState,
  type WebSessionContext,
} from "./operational-dashboard-state.js";

export const POST_SALE_INVALIDATION_GRAPH = {
  "catalog-stock": ["products"],
  "inventory-detail": ["lots", "balances", "movements"],
  alerts: ["alerts"],
  sales: ["sales"],
  indicators: ["indicators"],
} as const;

type PostSaleResource =
  (typeof POST_SALE_INVALIDATION_GRAPH)[keyof typeof POST_SALE_INVALIDATION_GRAPH][number];

export type OperationalResourceLoaders<
  TResources extends Record<string, unknown>,
> = {
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

function failedRefreshResource<T>(
  previous: ResourceState<T>,
  reason: unknown,
  cycle: number,
): ResourceState<T> {
  const correlationId =
    reason instanceof SafeWebApiError ? reason.correlationId : null;
  if (reason instanceof SafeWebApiError && [403, 404].includes(reason.status)) {
    return resourceState.error(
      "No se pudo consultar el recurso.",
      correlationId,
      cycle,
    );
  }
  if (previous.status === "ready" || previous.status === "stale") {
    return {
      ...resourceState.stale(
        previous.data,
        "POST_SALE_REFRESH_FAILED",
        correlationId,
        cycle,
      ),
      ...(previous.receivedAt === undefined
        ? {}
        : { receivedAt: previous.receivedAt }),
    };
  }
  if (previous.status === "empty") {
    return {
      ...resourceState.stale(
        [] as unknown as T,
        "POST_SALE_REFRESH_FAILED",
        correlationId,
        cycle,
      ),
      receivedAt: previous.receivedAt,
    };
  }
  return resourceState.error(
    "No se pudieron actualizar los datos operativos.",
    correlationId,
    cycle,
  ) as ResourceState<T>;
}

function refreshingResource<T>(
  previous: ResourceState<T>,
  cycle: number,
): ResourceState<T> {
  if (previous.status === "ready" || previous.status === "stale") {
    return {
      ...resourceState.stale(
        previous.data,
        "POST_SALE_REFRESH_PENDING",
        null,
        cycle,
      ),
      ...(previous.receivedAt === undefined
        ? {}
        : { receivedAt: previous.receivedAt }),
    };
  }
  if (previous.status === "empty") {
    return {
      ...resourceState.stale(
        [] as unknown as T,
        "POST_SALE_REFRESH_PENDING",
        null,
        cycle,
      ),
      receivedAt: previous.receivedAt,
    };
  }
  return resourceState.loading(cycle) as ResourceState<T>;
}

function postSaleResourceKeys<TResources extends Record<string, unknown>>(
  loaders: OperationalResourceLoaders<TResources>,
): (keyof TResources)[] {
  const available = new Set(Object.keys(loaders));
  return Object.values(POST_SALE_INVALIDATION_GRAPH)
    .flat()
    .filter((key): key is PostSaleResource =>
      available.has(key),
    ) as (keyof TResources)[];
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
  #cycle = 0;
  readonly #listeners = new Set<
    (state: OperationalDashboardState<TResources> | null) => void
  >();

  public subscribe(
    listener: (state: OperationalDashboardState<TResources> | null) => void,
  ): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #publish(): void {
    for (const listener of this.#listeners) listener(this.#state);
  }

  async #read(
    key: keyof TResources,
    context: WebSessionContext,
    signal: AbortSignal,
  ): Promise<TResources[keyof TResources]> {
    try {
      return await this.#loaders[key]({ context, signal });
    } catch (error) {
      if (
        !signal.aborted &&
        error instanceof SafeWebApiError &&
        error.status === 401
      )
        this.clear();
      throw error;
    }
  }
  #saleSubmission: Promise<OperationalDashboardState<TResources> | null> | null =
    null;

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
    this.#publish();
  }

  #nextCycle(): number {
    this.#cycle += 1;
    return this.#cycle;
  }

  public async load(
    context: WebSessionContext,
  ): Promise<OperationalDashboardState<TResources> | null> {
    this.#abortController?.abort();
    const abortController = new AbortController();
    this.#abortController = abortController;
    const active = this.#contexts.activate(context);
    const cycle = this.#nextCycle();
    const keys = Object.keys(this.#loaders) as (keyof TResources)[];
    const loading = {} as {
      [K in keyof TResources]: ResourceState<TResources[K]>;
    };
    for (const key of keys) loading[key] = resourceState.loading(cycle);

    this.#state = {
      context,
      contextKey: active.contextKey,
      generation: cycle,
      resources: loading,
      sale: { status: "idle" },
    };
    this.#publish();

    const settled = await Promise.allSettled(
      keys.map((key) => this.#read(key, context, abortController.signal)),
    );
    if (
      abortController.signal.aborted ||
      !this.#contexts.accepts(active.contextKey)
    ) {
      return null;
    }

    const resources = {} as {
      [K in keyof TResources]: ResourceState<TResources[K]>;
    };
    for (const [index, key] of keys.entries()) {
      const result = settled[index];
      if (result === undefined || result.status === "rejected") {
        resources[key] = failedResource<TResources[typeof key]>(
          result === undefined ? undefined : result.reason,
          cycle,
        );
        continue;
      }
      resources[key] = isEmptyResource(result.value)
        ? (resourceState.empty(
            new Date().toISOString(),
            cycle,
          ) as ResourceState<TResources[typeof key]>)
        : resourceState.ready(result.value, new Date().toISOString(), cycle);
    }

    const state: OperationalDashboardState<TResources> = {
      context,
      contextKey: active.contextKey,
      generation: cycle,
      resources: resources as ResourceStates<TResources>,
      sale: { status: "idle" },
    };
    this.#state = state;
    this.#publish();
    return state;
  }

  public submitSale<TSale>(input: {
    readonly idempotencyKey: string;
    readonly create: () => Promise<TSale>;
  }): Promise<OperationalDashboardState<TResources> | null> {
    if (this.#saleSubmission !== null) return this.#saleSubmission;
    const submission = this.#submitSaleOnce(input);
    this.#saleSubmission = submission;
    void submission.finally(() => {
      if (this.#saleSubmission === submission) this.#saleSubmission = null;
    });
    return submission;
  }

  async #submitSaleOnce<TSale>(input: {
    readonly idempotencyKey: string;
    readonly create: () => Promise<TSale>;
  }): Promise<OperationalDashboardState<TResources> | null> {
    const current = this.#state;
    if (
      current === null ||
      current.context === null ||
      current.contextKey === null
    ) {
      return null;
    }
    const contextKey = current.contextKey;
    this.#state = {
      ...current,
      sale: {
        status: "submitting",
        idempotencyKey: input.idempotencyKey,
      },
    };
    this.#publish();

    let sale: TSale;
    try {
      sale = await input.create();
    } catch (reason) {
      if (
        this.#contexts.accepts(contextKey) &&
        reason instanceof SafeWebApiError &&
        reason.status === 401
      )
        this.clear();
      if (!this.#contexts.accepts(contextKey) || this.#state === null)
        return null;
      const correlationId =
        reason instanceof SafeWebApiError ? reason.correlationId : null;
      this.#state = {
        ...this.#state,
        sale: {
          status: "error",
          message: "No se pudo registrar la venta.",
          correlationId,
          idempotencyKey: input.idempotencyKey,
        },
      };
      this.#publish();
      return this.#state;
    }

    if (!this.#contexts.accepts(contextKey) || this.#state === null)
      return null;
    const confirmedSale: SaleMutationState<TSale> = {
      status: "succeeded",
      sale,
      confirmedAt: new Date().toISOString(),
    };
    this.#state = { ...this.#state, sale: confirmedSale };
    this.#publish();
    return this.#refresh(postSaleResourceKeys(this.#loaders));
  }

  public retryStale(): Promise<OperationalDashboardState<TResources> | null> {
    const current = this.#state;
    if (
      current === null ||
      current.sale.status === "submitting" ||
      this.#readsPending()
    ) {
      return Promise.resolve(current);
    }
    const keys = (
      Object.keys(current.resources) as (keyof TResources)[]
    ).filter((key) => {
      const resource = current.resources[key];
      return (
        resource.status === "error" ||
        (resource.status === "stale" &&
          resource.reason !== "POST_SALE_REFRESH_PENDING")
      );
    });
    if (keys.length === 0) return Promise.resolve(current);
    return this.#refresh(keys);
  }

  public retryResources(
    requested: readonly (keyof TResources)[],
  ): Promise<OperationalDashboardState<TResources> | null> {
    const current = this.#state;
    if (
      current === null ||
      current.sale.status === "submitting" ||
      this.#readsPending()
    )
      return Promise.resolve(current);
    const keys = [...new Set(requested)].filter((key) => {
      const resource = current.resources[key];
      return (
        resource !== undefined &&
        (resource.status === "error" ||
          (resource.status === "stale" &&
            resource.reason !== "POST_SALE_REFRESH_PENDING"))
      );
    });
    return keys.length === 0 ? Promise.resolve(current) : this.#refresh(keys);
  }

  #readsPending(): boolean {
    return (
      this.#state !== null &&
      Object.values(this.#state.resources).some(
        (resource: ResourceState<unknown>) =>
          resource.status === "loading" ||
          (resource.status === "stale" &&
            resource.reason === "POST_SALE_REFRESH_PENDING"),
      )
    );
  }

  async #refresh(
    keys: readonly (keyof TResources)[],
  ): Promise<OperationalDashboardState<TResources> | null> {
    const current = this.#state;
    if (
      current === null ||
      current.context === null ||
      current.contextKey === null
    ) {
      return null;
    }
    const context = current.context;
    const contextKey = current.contextKey;
    const previousResources = current.resources;
    this.#abortController?.abort();
    const abortController = new AbortController();
    this.#abortController = abortController;
    const cycle = this.#nextCycle();
    const refreshing = { ...previousResources } as {
      [K in keyof TResources]: ResourceState<TResources[K]>;
    };
    for (const key of keys) {
      refreshing[key] = refreshingResource(previousResources[key], cycle);
    }
    this.#state = {
      ...current,
      generation: cycle,
      resources: refreshing,
    };
    this.#publish();

    const settled = await Promise.allSettled(
      keys.map((key) => this.#read(key, context, abortController.signal)),
    );
    if (
      abortController.signal.aborted ||
      !this.#contexts.accepts(contextKey) ||
      this.#state === null
    ) {
      return null;
    }

    const resources = { ...this.#state.resources } as {
      [K in keyof TResources]: ResourceState<TResources[K]>;
    };
    for (const [index, key] of keys.entries()) {
      const result = settled[index];
      if (result === undefined || result.status === "rejected") {
        resources[key] = failedRefreshResource(
          previousResources[key],
          result === undefined ? undefined : result.reason,
          cycle,
        );
        continue;
      }
      resources[key] = isEmptyResource(result.value)
        ? (resourceState.empty(
            new Date().toISOString(),
            cycle,
          ) as ResourceState<TResources[typeof key]>)
        : resourceState.ready(result.value, new Date().toISOString(), cycle);
    }

    this.#state = {
      ...this.#state,
      generation: cycle,
      resources,
    };
    this.#publish();
    return this.#state;
  }
}
