import type { components } from "@bodegia/api-contract";

export type WebErrorBody = components["schemas"]["Error"];

export class SafeWebApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly correlationId: string | null;

  public constructor(input: {
    status: number;
    code: string;
    correlationId: string | null;
  }) {
    super("No se pudo completar la solicitud.");
    this.name = "SafeWebApiError";
    this.status = input.status;
    this.code = input.code;
    this.correlationId = input.correlationId;
  }
}

export interface WebApiClientOptions {
  readonly baseUrl: string;
  readonly accessToken: () => string | null;
  readonly activeTenantId: () => string | null;
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface WebRequest<TBody = unknown> {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: TBody;
  readonly authenticated?: boolean;
  readonly tenantScoped?: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Web API URL must use HTTPS outside localhost.");
  }
  return url.toString().replace(/\/$/u, "");
}

export function errorMetadata(value: unknown): {
  readonly code: string;
  readonly correlationId: string | null;
} {
  if (value === null || typeof value !== "object") {
    return { code: "REQUEST_FAILED", correlationId: null };
  }
  const body = value as Record<string, unknown>;
  if (body["error"] !== null && typeof body["error"] === "object") {
    return errorMetadata(body["error"]);
  }
  return {
    code: typeof body["code"] === "string" ? body["code"] : "REQUEST_FAILED",
    correlationId:
      typeof body["correlationId"] === "string" ? body["correlationId"] : null,
  };
}

/** REST-only web transport. Tenant scope is validated locally but never client-selected. */
export class WebApiClient {
  readonly #baseUrl: string;
  readonly #accessToken: () => string | null;
  readonly #activeTenantId: () => string | null;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  public constructor(options: WebApiClientOptions) {
    this.#baseUrl = normalizedBaseUrl(options.baseUrl);
    this.#accessToken = options.accessToken;
    this.#activeTenantId = options.activeTenantId;
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
  }

  public async request<TResponse, TBody = unknown>(
    request: WebRequest<TBody>,
  ): Promise<TResponse> {
    request.signal?.throwIfAborted();
    if (request.tenantScoped === true && this.#activeTenantId() === null) {
      throw new SafeWebApiError({
        status: 403,
        code: "ACTIVE_TENANT_REQUIRED",
        correlationId: null,
      });
    }
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    request.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, this.#timeoutMs);
    try {
      const headers = new Headers({ Accept: "application/json" });
      if (request.body !== undefined)
        headers.set("Content-Type", "application/json");
      for (const [key, value] of Object.entries(request.headers ?? {})) {
        headers.set(key, value);
      }
      if (request.authenticated === true) {
        const token = this.#accessToken();
        if (token === null) {
          throw new SafeWebApiError({
            status: 401,
            code: "SESSION_REQUIRED",
            correlationId: null,
          });
        }
        headers.set("Authorization", `Bearer ${token}`);
      }
      const response = await this.#fetch(`${this.#baseUrl}${request.path}`, {
        method: request.method,
        headers,
        signal: controller.signal,
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
      });
      const responseBody: unknown =
        response.status === 204
          ? undefined
          : await response.json().catch(() => undefined);
      if (!response.ok) {
        const metadata = errorMetadata(responseBody);
        throw new SafeWebApiError({
          status: response.status,
          code: metadata.code,
          correlationId:
            metadata.correlationId ?? response.headers.get("x-correlation-id"),
        });
      }
      return responseBody as TResponse;
    } catch (error) {
      if (error instanceof SafeWebApiError) throw error;
      if (request.signal?.aborted === true)
        throw new DOMException("Solicitud cancelada.", "AbortError");
      throw new SafeWebApiError({
        status: 0,
        code: controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        correlationId: null,
      });
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abort);
    }
  }
}

export function webApiBaseUrl(environment: NodeJS.ProcessEnv): string {
  const value = environment["VITE_API_BASE_URL"];
  if (value === undefined || value.trim().length === 0) {
    throw new Error("VITE_API_BASE_URL is required.");
  }
  return normalizedBaseUrl(value);
}
