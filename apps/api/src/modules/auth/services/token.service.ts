import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const ACCESS_TOKEN_TTL_MILLISECONDS = 10 * 60 * 1_000;
export const SESSION_ABSOLUTE_TTL_MILLISECONDS = 8 * 60 * 60 * 1_000;

export interface AccessTokenClaims {
  readonly sessionId: string;
  readonly userId: string;
  readonly authVersion: number;
  readonly contextVersion: number;
  readonly tenantId: string | null;
  readonly membershipId: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

interface SerializedAccessClaims {
  readonly sid: string;
  readonly sub: string;
  readonly av: number;
  readonly cv: number;
  readonly tid: string | null;
  readonly mid: string | null;
  readonly iat: number;
  readonly exp: number;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface IssuedRefreshToken {
  readonly token: string;
  readonly hash: Uint8Array<ArrayBuffer>;
}

export class SessionInvalidError extends Error {
  public readonly code = "SESSION_INVALID" as const;

  public constructor() {
    super("The session is invalid or expired.");
    this.name = "SessionInvalidError";
  }
}

function invalidSession(): SessionInvalidError {
  return new SessionInvalidError();
}

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseClaims(encodedPayload: string): SerializedAccessClaims {
  let value: unknown;
  try {
    value = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;
  } catch {
    throw invalidSession();
  }
  if (
    !isRecord(value) ||
    typeof value["sid"] !== "string" ||
    typeof value["sub"] !== "string" ||
    typeof value["av"] !== "number" ||
    typeof value["cv"] !== "number" ||
    (value["tid"] !== null && typeof value["tid"] !== "string") ||
    (value["mid"] !== null && typeof value["mid"] !== "string") ||
    typeof value["iat"] !== "number" ||
    typeof value["exp"] !== "number"
  ) {
    throw invalidSession();
  }
  return {
    sid: value["sid"],
    sub: value["sub"],
    av: value["av"],
    cv: value["cv"],
    tid: value["tid"],
    mid: value["mid"],
    iat: value["iat"],
    exp: value["exp"],
  };
}

/** Issues compact signed access tokens and high-entropy opaque refresh tokens. */
export class TokenService {
  readonly #accessSigningKey: Buffer;
  readonly #refreshHashKey: Buffer | null;

  public constructor(options: {
    readonly accessSigningKey: Uint8Array;
    readonly refreshHashKey?: Uint8Array;
  }) {
    if (options.accessSigningKey.byteLength < 32) {
      throw new Error("The access token signing key must contain 256 bits.");
    }
    if (
      options.refreshHashKey !== undefined &&
      options.refreshHashKey.byteLength < 32
    ) {
      throw new Error("The refresh token hash key must contain 256 bits.");
    }
    this.#accessSigningKey = Buffer.from(options.accessSigningKey);
    this.#refreshHashKey =
      options.refreshHashKey === undefined
        ? null
        : Buffer.from(options.refreshHashKey);
  }

  public issueAccessToken(input: {
    readonly sessionId: string;
    readonly userId: string;
    readonly authVersion: number;
    readonly contextVersion: number;
    readonly tenantId: string | null;
    readonly membershipId: string | null;
    readonly now?: Date;
  }): IssuedAccessToken {
    const issuedAt = input.now ?? new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + ACCESS_TOKEN_TTL_MILLISECONDS,
    );
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson({
      sid: input.sessionId,
      sub: input.userId,
      av: input.authVersion,
      cv: input.contextVersion,
      tid: input.tenantId,
      mid: input.membershipId,
      iat: issuedAt.getTime(),
      exp: expiresAt.getTime(),
    } satisfies SerializedAccessClaims);
    const unsigned = `${header}.${payload}`;
    const signature = createHmac("sha256", this.#accessSigningKey)
      .update(unsigned, "utf8")
      .digest("base64url");
    return { token: `${unsigned}.${signature}`, expiresAt };
  }

  public verifyAccessToken(
    token: string,
    now: Date = new Date(),
  ): AccessTokenClaims {
    const parts = token.split(".");
    const header = parts[0];
    const payload = parts[1];
    const signature = parts[2];
    if (
      parts.length !== 3 ||
      header === undefined ||
      payload === undefined ||
      signature === undefined
    ) {
      throw invalidSession();
    }
    const expected = createHmac("sha256", this.#accessSigningKey)
      .update(`${header}.${payload}`, "utf8")
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(signature, "base64url");
    } catch {
      throw invalidSession();
    }
    if (
      received.byteLength !== expected.byteLength ||
      !timingSafeEqual(received, expected)
    ) {
      throw invalidSession();
    }
    const claims = parseClaims(payload);
    if (
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= now.getTime() ||
      claims.iat > now.getTime()
    ) {
      throw invalidSession();
    }
    return {
      sessionId: claims.sid,
      userId: claims.sub,
      authVersion: claims.av,
      contextVersion: claims.cv,
      tenantId: claims.tid,
      membershipId: claims.mid,
      issuedAt: new Date(claims.iat),
      expiresAt: new Date(claims.exp),
    };
  }

  public issueRefreshToken(): IssuedRefreshToken {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hashRefreshToken(token) };
  }

  public hashRefreshToken(token: string): Uint8Array<ArrayBuffer> {
    const digest =
      this.#refreshHashKey === null
        ? createHash("sha256").update(token, "utf8").digest()
        : createHmac("sha256", this.#refreshHashKey)
            .update(token, "utf8")
            .digest();
    return Uint8Array.from(digest);
  }
}
