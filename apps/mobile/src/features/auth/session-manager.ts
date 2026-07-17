import type { components } from "@bodegia/api-contract";
import type { MobileApiClient } from "../../api/client.js";
import type { SecureSessionStore } from "../../security/secure-store.js";

type SessionResponse = components["schemas"]["SessionCreationResponse"];
type RefreshResponse = components["schemas"]["RefreshRotationResponse"];

export interface MobileSessionApi {
  unlockWithPin(input: {
    readonly phone: string;
    readonly pin: string;
    readonly deviceCredential: string;
  }): Promise<SessionResponse>;
  rotateRefreshToken(refreshToken: string): Promise<RefreshResponse>;
  logout(): Promise<void>;
}

export class MobileSessionHttpApi implements MobileSessionApi {
  public constructor(private readonly client: MobileApiClient) {}

  public unlockWithPin(input: {
    readonly phone: string;
    readonly pin: string;
    readonly deviceCredential: string;
  }): Promise<SessionResponse> {
    return this.client.request<SessionResponse, typeof input>({
      method: "POST",
      path: "/auth/pin/unlock",
      body: input,
    });
  }

  public rotateRefreshToken(refreshToken: string): Promise<RefreshResponse> {
    return this.client.request<
      RefreshResponse,
      { readonly refreshToken: string }
    >({
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken },
    });
  }

  public logout(): Promise<void> {
    return this.client.request<void>({
      method: "POST",
      path: "/auth/logout",
      authenticated: true,
    });
  }
}

export type MobileSessionState =
  | { readonly status: "SIGNED_OUT" }
  | { readonly status: "LOADING" }
  | { readonly status: "ACTIVE"; readonly absoluteExpiresAt: string }
  | { readonly status: "LOCAL_LOCKED"; readonly absoluteExpiresAt: string }
  | { readonly status: "ERROR"; readonly message: string };

export const LOCAL_INACTIVITY_LIMIT_MS = 30 * 60 * 1_000;

/** SecureStore-backed session coordinator; server responses remain authoritative. */
export class MobileSessionManager {
  #state: MobileSessionState = { status: "SIGNED_OUT" };
  #lastActivityAt: number | null = null;

  public constructor(
    private readonly api: MobileSessionApi,
    private readonly store: SecureSessionStore,
  ) {}

  public get state(): MobileSessionState {
    return this.#state;
  }

  public async restore(): Promise<void> {
    const session = await this.store.load();
    this.#state =
      session === null
        ? { status: "SIGNED_OUT" }
        : { status: "ACTIVE", absoluteExpiresAt: session.absoluteExpiresAt };
    this.#lastActivityAt = session === null ? null : Date.now();
  }

  public async unlockWithPin(input: {
    readonly phone: string;
    readonly pin: string;
    readonly deviceCredential: string;
  }): Promise<void> {
    if (!/^[0-9]{6}$/u.test(input.pin)) {
      throw new Error("El PIN debe tener 6 dígitos.");
    }
    this.#state = { status: "LOADING" };
    try {
      const response = await this.api.unlockWithPin(input);
      await this.store.replace({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        absoluteExpiresAt: response.absoluteExpiresAt,
        activeContext: response.activeContext ?? null,
      });
      this.#state = {
        status: "ACTIVE",
        absoluteExpiresAt: response.absoluteExpiresAt,
      };
      this.#lastActivityAt = Date.now();
    } catch {
      await this.store.clear();
      this.#state = {
        status: "ERROR",
        message: "No se pudo iniciar la sesión.",
      };
    }
  }

  public async refresh(): Promise<void> {
    const current = await this.store.load();
    if (current === null) {
      this.#state = { status: "SIGNED_OUT" };
      return;
    }
    try {
      const response = await this.api.rotateRefreshToken(current.refreshToken);
      if (
        Date.parse(response.absoluteExpiresAt) >
        Date.parse(current.absoluteExpiresAt)
      ) {
        throw new Error("Refresh attempted to extend absolute session expiry.");
      }
      await this.store.replace({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        absoluteExpiresAt: response.absoluteExpiresAt,
        activeContext: response.activeContext ?? null,
      });
      this.#state = {
        status: "ACTIVE",
        absoluteExpiresAt: response.absoluteExpiresAt,
      };
    } catch {
      await this.store.clear();
      this.#state = { status: "SIGNED_OUT" };
    }
  }

  public recordActivity(now: number = Date.now()): void {
    if (this.#state.status === "ACTIVE") this.#lastActivityAt = now;
  }

  public applyLocalInactivityLock(now: number = Date.now()): boolean {
    if (
      this.#state.status !== "ACTIVE" ||
      this.#lastActivityAt === null ||
      now - this.#lastActivityAt < LOCAL_INACTIVITY_LIMIT_MS
    ) {
      return false;
    }
    this.#state = {
      status: "LOCAL_LOCKED",
      absoluteExpiresAt: this.#state.absoluteExpiresAt,
    };
    return true;
  }

  public async logout(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      await this.store.clear();
      this.#lastActivityAt = null;
      this.#state = { status: "SIGNED_OUT" };
    }
  }

  public async handleRevocation(): Promise<void> {
    await this.store.clear();
    this.#lastActivityAt = null;
    this.#state = { status: "SIGNED_OUT" };
  }
}
