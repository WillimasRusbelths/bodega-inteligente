import type {
  TenantIsolationCase,
  TenantIsolationExpected,
  TenantLabel,
} from "./tenant-isolation.matrix.js";

export interface SafeTenantError {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
}

export interface TenantIsolationResourceAdapter<
  TContext,
  TSeed = unknown,
  TRead = unknown,
  TList = unknown,
  TMutation = unknown,
> {
  readonly name: string;
  readonly seed: (tenantId: string) => Promise<TSeed> | TSeed;
  readonly read?: (context: TContext, id: string) => Promise<TRead>;
  readonly list?: (context: TContext, input?: unknown) => Promise<TList>;
  readonly modify?: (
    context: TContext,
    id: string,
    input?: unknown,
  ) => Promise<TMutation>;
  readonly admin?: (
    context: TContext,
    id: string,
    input?: unknown,
  ) => Promise<TMutation>;
  readonly nestedRead?: (
    context: TContext,
    parentId: string,
    childId: string,
  ) => Promise<TRead>;
  readonly nestedWrite?: (
    context: TContext,
    parentId: string,
    childId: string,
    input?: unknown,
  ) => Promise<TMutation>;
  readonly assertNoLeakage?: (result: unknown, tenantId: string) => void;
  readonly expectedErrors?: readonly TenantIsolationExpected[];
}

export interface TenantIsolationRunInput<TContext> {
  readonly testCase: TenantIsolationCase;
  readonly contextFor: (tenant: TenantLabel) => TContext;
  readonly ids: {
    readonly sourceId: string;
    readonly foreignId: string;
    readonly missingId: string;
    readonly childId: string;
  };
}

export type TenantIsolationOutcome =
  | { readonly kind: "success"; readonly value: unknown }
  | { readonly kind: "error"; readonly error: SafeTenantError }
  | { readonly kind: "missing-adapter-method" };

function safeError(error: unknown): SafeTenantError {
  if (error !== null && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return {
      code: typeof value["code"] === "string" ? value["code"] : "UNKNOWN",
      message:
        typeof value["message"] === "string"
          ? value["message"]
          : "The operation could not be completed.",
      ...(typeof value["correlationId"] === "string"
        ? { correlationId: value["correlationId"] }
        : {}),
    };
  }
  return { code: "UNKNOWN", message: "The operation could not be completed." };
}

/**
 * Shared security gate for API-only tenant resources. Adapters seed synthetic
 * data and invoke real guards/repositories; no client talks to PostgreSQL.
 * Future sales, inventory, products, customers and BI suites can register
 * adapters without copying the A/B attack and anti-leakage assertions.
 */
export class TenantIsolationHarness<TContext> {
  readonly #adapters = new Map<
    string,
    TenantIsolationResourceAdapter<TContext>
  >();

  public register<TSeed, TRead, TList, TMutation>(
    adapter: TenantIsolationResourceAdapter<
      TContext,
      TSeed,
      TRead,
      TList,
      TMutation
    >,
  ): this {
    if (this.#adapters.has(adapter.name)) {
      throw new Error(
        `Tenant isolation adapter already registered: ${adapter.name}`,
      );
    }
    this.#adapters.set(
      adapter.name,
      adapter as TenantIsolationResourceAdapter<TContext>,
    );
    return this;
  }

  public get(name: string): TenantIsolationResourceAdapter<TContext> {
    const adapter = this.#adapters.get(name);
    if (adapter === undefined)
      throw new Error(`Unknown tenant isolation adapter: ${name}`);
    return adapter;
  }

  public resources(): readonly string[] {
    return Object.freeze([...this.#adapters.keys()]);
  }

  public async seedAll(tenantIds: readonly string[]): Promise<void> {
    for (const adapter of this.#adapters.values()) {
      for (const tenantId of tenantIds) await adapter.seed(tenantId);
    }
  }

  public async assertForeignDenied(
    name: string,
    context: TContext,
    foreignId: string,
  ): Promise<SafeTenantError> {
    const adapter = this.get(name);
    if (adapter.read === undefined)
      throw new Error(`Adapter ${name} has no read operation.`);
    try {
      await adapter.read(context, foreignId);
    } catch (error) {
      return safeError(error);
    }
    throw new Error(`Foreign ${name} resource was returned.`);
  }

  public async runCase(
    input: TenantIsolationRunInput<TContext>,
  ): Promise<TenantIsolationOutcome> {
    const adapter = this.get(input.testCase.resource);
    const context = input.contextFor(input.testCase.sourceTenant);
    const ids = input.ids;
    const id =
      input.testCase.targetTenant === input.testCase.sourceTenant
        ? input.testCase.attackVector === "missingId"
          ? ids.missingId
          : ids.sourceId
        : ids.foreignId;
    try {
      let value: unknown;
      switch (input.testCase.operation) {
        case "readById":
          if (adapter.read === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.read(context, id);
          break;
        case "list":
          if (adapter.list === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.list(context, {
            attackVector: input.testCase.attackVector,
            id,
          });
          break;
        case "modify":
          if (adapter.modify === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.modify(context, id, {
            attackVector: input.testCase.attackVector,
          });
          break;
        case "admin":
          if (adapter.admin === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.admin(context, id, {
            attackVector: input.testCase.attackVector,
          });
          break;
        case "administration":
          if (adapter.admin === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.admin(context, id, {
            attackVector: input.testCase.attackVector,
          });
          break;
        case "nestedRead":
          if (adapter.nestedRead === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.nestedRead(
            context,
            ids.sourceId,
            ids.foreignId,
          );
          break;
        case "nestedWrite":
          if (adapter.nestedWrite === undefined)
            return { kind: "missing-adapter-method" };
          value = await adapter.nestedWrite(
            context,
            ids.sourceId,
            ids.foreignId,
            {
              attackVector: input.testCase.attackVector,
            },
          );
          break;
      }
      adapter.assertNoLeakage?.(value, input.testCase.sourceTenant);
      return { kind: "success", value };
    } catch (error) {
      return { kind: "error", error: safeError(error) };
    }
  }
}

export function createTenantIsolationHarness<
  TContext,
>(): TenantIsolationHarness<TContext> {
  return new TenantIsolationHarness<TContext>();
}
