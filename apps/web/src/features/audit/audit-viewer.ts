import type { components } from "@bodegia/api-contract";
import type { WebApiClient } from "../../api/client.js";

type AuditEvent = components["schemas"]["AuditEvent"];
type AuditResult = AuditEvent["result"];

export interface AuditPage {
  readonly items: readonly AuditEvent[];
  readonly nextCursor?: string | null;
}

export interface AuditApi {
  list(input: {
    readonly cursor?: string;
    readonly action?: string;
    readonly result?: AuditResult;
  }): Promise<AuditPage>;
}

export class WebAuditHttpApi implements AuditApi {
  public constructor(private readonly client: WebApiClient) {}

  public list(input: {
    readonly cursor?: string;
    readonly action?: string;
    readonly result?: AuditResult;
  }): Promise<AuditPage> {
    const query = new URLSearchParams();
    if (input.cursor !== undefined) query.set("cursor", input.cursor);
    if (input.action !== undefined) query.set("action", input.action);
    if (input.result !== undefined) query.set("result", input.result);
    const serialized = query.toString();
    return this.client.request<AuditPage>({
      method: "GET",
      path: `/tenants/current/audit-events${serialized.length === 0 ? "" : `?${serialized}`}`,
      authenticated: true,
      tenantScoped: true,
    });
  }
}

export interface SafeAuditRow {
  readonly id: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly result: AuditResult;
  readonly occurredAt: string;
  readonly correlationId: string;
}

export type AuditViewerState =
  | { readonly status: "LOADING" }
  | { readonly status: "EMPTY" }
  | {
      readonly status: "READY";
      readonly items: readonly SafeAuditRow[];
      readonly nextCursor: string | null;
    }
  | { readonly status: "FORBIDDEN" }
  | { readonly status: "ERROR"; readonly message: string };

function safeRow(event: AuditEvent): SafeAuditRow {
  return Object.freeze({
    id: event.id,
    actorId: event.actorId ?? null,
    action: event.action,
    result: event.result,
    occurredAt: event.occurredAt,
    correlationId: event.correlationId,
  });
}

/** Read-only owner view. Sensitive before/after payloads are never projected. */
export class AuditViewer {
  #state: AuditViewerState = { status: "LOADING" };

  public constructor(
    private readonly api: AuditApi,
    private readonly roles: readonly string[],
  ) {}

  public get state(): AuditViewerState {
    return this.#state;
  }

  public async load(
    input: {
      readonly cursor?: string;
      readonly action?: string;
      readonly result?: AuditResult;
    } = {},
  ): Promise<void> {
    if (!this.roles.includes("owner_admin")) {
      this.#state = { status: "FORBIDDEN" };
      return;
    }
    this.#state = { status: "LOADING" };
    try {
      const page = await this.api.list(input);
      const items = page.items.map(safeRow);
      this.#state =
        items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items,
              nextCursor: page.nextCursor ?? null,
            };
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudo cargar la auditoría.",
      };
    }
  }
}
