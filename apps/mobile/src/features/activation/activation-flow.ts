import type { components } from "@bodegia/api-contract";
import type { MobileApiClient } from "../../api/client.js";

type ActivateRequest = components["schemas"]["ActivateRequest"];
type ActivationResult = components["schemas"]["ActivationConsumeResponse"];
type PersonalDevice = components["schemas"]["PersonalActivationDeviceRequest"];

export interface ActivationApi {
  activate(
    request: ActivateRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ActivationResult>;
  setupPin(pinSetupToken: string, pin: string): Promise<void>;
}

export class MobileActivationHttpApi implements ActivationApi {
  public constructor(private readonly client: MobileApiClient) {}

  public activate(
    request: ActivateRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ActivationResult> {
    return this.client.request<ActivationResult, ActivateRequest>({
      method: "POST",
      path: "/auth/activations",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public setupPin(pinSetupToken: string, pin: string): Promise<void> {
    return this.client.request<void, { readonly pin: string }>({
      method: "POST",
      path: "/auth/pin/setup",
      body: { pin },
      headers: { Authorization: `Bearer ${pinSetupToken}` },
    });
  }
}

export type ActivationViewState =
  | { readonly status: "EMPTY" }
  | {
      readonly status: "READY";
      readonly method: "QR" | "MANUAL";
      readonly expiresAt: string;
    }
  | { readonly status: "LOADING" }
  | {
      readonly status: "PIN_REQUIRED";
      readonly deviceProfileId: string;
      readonly expiresAt: string;
    }
  | { readonly status: "SUCCESS"; readonly deviceProfileId: string }
  | {
      readonly status: "ERROR";
      readonly message: "No se pudo completar la activación.";
      readonly correlationId: string | null;
    };

type PendingCredential =
  | { readonly type: "QR_SECRET"; readonly qrSecret: string }
  | { readonly type: "MANUAL_CODE"; readonly manualCode: string };

function strictPersonalDevice(value: unknown): PersonalDevice {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid personal device input.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "installationId",
    "platform",
    "appVersion",
    "deviceCredential",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new Error("Only PERSONAL devices are accepted in the MVP.");
  }
  if (
    typeof input["installationId"] !== "string" ||
    (input["platform"] !== "ANDROID" && input["platform"] !== "IOS") ||
    typeof input["appVersion"] !== "string" ||
    typeof input["deviceCredential"] !== "string"
  ) {
    throw new Error("Invalid personal device input.");
  }
  return {
    installationId: input["installationId"],
    platform: input["platform"],
    appVersion: input["appVersion"],
    deviceCredential: input["deviceCredential"],
  };
}

function correlationId(error: unknown): string | null {
  if (error === null || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)["correlationId"];
  return typeof value === "string" ? value : null;
}

/** Mobile-first state machine; raw activation credentials remain private and transient. */
export class ActivationFlow {
  #state: ActivationViewState = { status: "EMPTY" };
  #credential: PendingCredential | null = null;
  #pinSetupToken: string | null = null;

  public constructor(private readonly api: ActivationApi) {}

  public get state(): ActivationViewState {
    return this.#state;
  }

  public scanQr(qrSecret: string, expiresAt: string): void {
    if (qrSecret.length < 22) throw new Error("Invalid activation QR.");
    this.#credential = { type: "QR_SECRET", qrSecret };
    this.#state = { status: "READY", method: "QR", expiresAt };
  }

  public enterManualCode(manualCode: string, expiresAt: string): void {
    if (!/^[0-9]{8}$/u.test(manualCode)) {
      throw new Error("El código manual debe tener 8 dígitos.");
    }
    this.#credential = { type: "MANUAL_CODE", manualCode };
    this.#state = { status: "READY", method: "MANUAL", expiresAt };
  }

  public async consume(input: {
    readonly phone: string;
    readonly device: unknown;
    readonly idempotencyKey: string;
    readonly signal?: AbortSignal;
  }): Promise<void> {
    const credential = this.#credential;
    if (credential === null)
      throw new Error("Activation credential is required.");
    this.#state = { status: "LOADING" };
    try {
      const result = await this.api.activate(
        {
          phone: input.phone,
          credential,
          device: strictPersonalDevice(input.device),
        },
        input.idempotencyKey,
        input.signal,
      );
      this.#pinSetupToken = result.pinSetupToken;
      this.#state = {
        status: "PIN_REQUIRED",
        deviceProfileId: result.deviceProfileId,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      this.#state = {
        status: "ERROR",
        message: "No se pudo completar la activación.",
        correlationId: correlationId(error),
      };
    } finally {
      this.#credential = null;
    }
  }

  public async configurePin(pin: string, confirmation: string): Promise<void> {
    if (!/^[0-9]{6}$/u.test(pin) || pin !== confirmation) {
      throw new Error(
        "El PIN y su confirmación deben coincidir y tener 6 dígitos.",
      );
    }
    const token = this.#pinSetupToken;
    const deviceProfileId =
      this.#state.status === "PIN_REQUIRED"
        ? this.#state.deviceProfileId
        : null;
    if (token === null || deviceProfileId === null) {
      throw new Error("PIN setup is not available.");
    }
    this.#state = { status: "LOADING" };
    try {
      await this.api.setupPin(token, pin);
      this.#state = { status: "SUCCESS", deviceProfileId };
    } catch (error) {
      this.#state = {
        status: "ERROR",
        message: "No se pudo completar la activación.",
        correlationId: correlationId(error),
      };
    } finally {
      this.#pinSetupToken = null;
    }
  }

  public leave(): void {
    this.#credential = null;
    this.#pinSetupToken = null;
    this.#state = { status: "EMPTY" };
  }
}
