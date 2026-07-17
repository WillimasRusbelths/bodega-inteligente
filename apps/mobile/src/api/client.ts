import type { components } from "@bodegia/api-contract";

export type ApiErrorBody = components["schemas"]["Error"];

export class SafeMobileApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly correlationId: string | null;

  public constructor(input: {
    status: number;
    code: string;
    correlationId: string | null;
  }) {
    super("No se pudo completar la solicitud.");
    this.name = "SafeMobileApiError";
    this.status = input.status;
    this.code = input.code;
    this.correlationId = input.correlationId;
  }
}

export interface MobileApiClientOptions {
  readonly baseUrl: string;
  readonly accessToken: () => Promise<string | null>;
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface MobileRequest<TBody> {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: TBody;
  readonly authenticated?: boolean;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

function safeErrorBody(value: unknown): {
  readonly code: string;
  readonly correlationId: string | null;
} {
  if (value === null || typeof value !== "object") {
    return { code: "REQUEST_FAILED", correlationId: null };
  }
  const record = value as Record<string, unknown>;
  return {
    code:
      typeof record["code"] === "string" ? record["code"] : "REQUEST_FAILED",
    correlationId:
      typeof record["correlationId"] === "string"
        ? record["correlationId"]
        : null,
  };
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Mobile API URL must use HTTPS outside localhost.");
  }
  return url.toString().replace(/\/$/u, "");
}

/** REST-only mobile transport. It never owns or globally caches credentials. */
export class MobileApiClient {
  readonly #baseUrl: string;
  readonly #accessToken: () => Promise<string | null>;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  public constructor(options: MobileApiClientOptions) {
    this.#baseUrl = normalizedBaseUrl(options.baseUrl);
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
    if (this.#timeoutMs < 1 || this.#timeoutMs > 60_000) {
      throw new Error("Mobile API timeout is outside the approved range.");
    }
  }

  public async request<TResponse, TBody = never>(
    request: MobileRequest<TBody>,
  ): Promise<TResponse> {
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
        const token = await this.#accessToken();
        if (token === null) {
          throw new SafeMobileApiError({
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
        response.status === 204 ? undefined : await response.json();
      if (!response.ok) {
        const safe = safeErrorBody(responseBody);
        throw new SafeMobileApiError({
          status: response.status,
          code: safe.code,
          correlationId:
            safe.correlationId ?? response.headers.get("x-correlation-id"),
        });
      }
      return responseBody as TResponse;
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abort);
    }
  }
}

export function mobileApiBaseUrl(environment: NodeJS.ProcessEnv): string {
  const value = environment["EXPO_PUBLIC_API_BASE_URL"];
  if (value === undefined || value.trim().length === 0) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is required.");
  }
  return normalizedBaseUrl(value);
}
