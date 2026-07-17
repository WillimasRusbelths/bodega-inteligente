import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  HttpExceptionFilter,
  type FilteredHttpError,
} from "../../common/errors/http-exception.filter.js";
import {
  parsePinLoginDto,
  parseRefreshTokenDto,
  serializeSessionResponse,
} from "./dto/index.js";
import type { SessionGuard } from "./guards/session.guard.js";
import type { RefreshRotationService } from "./services/refresh-rotation.service.js";
import type { SessionService } from "./services/session.service.js";
import { SafeAuthenticationError } from "./services/pin.service.js";
import {
  SESSION_ABSOLUTE_TTL_MILLISECONDS,
  SessionInvalidError,
  TokenService,
} from "./services/token.service.js";

interface ContractSessionRecord {
  id: string;
  userId: string;
  deviceProfileId: string;
  platform: "MOBILE";
  createdAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

interface ContractRefreshRecord {
  id: string;
  sessionId: string;
  familyId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  rotatedAt: Date | null;
  replacedById: string | null;
  revokedAt: Date | null;
}

interface SessionContractState {
  user: { id: string; status: "ACTIVE" | "DISABLED"; authVersion: number };
  tenant: { id: string; status: "ACTIVE" | "DISABLED" };
  membership: {
    id: string;
    tenantId: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
  };
  device: { id: string; status: "ACTIVE" | "REVOKED" };
  profile: {
    id: string;
    tenantId: string;
    userId: string;
    membershipId: string;
    deviceId: string;
    status: "ACTIVE" | "REVOKED";
  };
  sessions: ContractSessionRecord[];
  refreshCredentials: ContractRefreshRecord[];
  logs: unknown[];
  audits: unknown[];
}

interface ContractSessionResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly activeContext: {
    readonly tenantId: string;
    readonly membershipId: string;
  };
}

const errors = new HttpExceptionFilter();

class AuthHttpError extends Error {
  public readonly status: number;
  public readonly body: FilteredHttpError["body"];

  public constructor(error: FilteredHttpError) {
    super(error.body.message);
    this.name = "AuthHttpError";
    this.status = error.status;
    this.body = error.body;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

function authenticationFailure(): SafeAuthenticationError {
  return new SafeAuthenticationError();
}

export const authContract = Object.freeze({
  validatePinLogin: parsePinLoginDto,
  validateRefresh: parseRefreshTokenDto,
  serializeSession: serializeSessionResponse,
  serializeAuthenticationError(error: unknown): FilteredHttpError["body"] {
    return errors.catch(error, "AUTHENTICATION_FAILED").body;
  },
  serializeSessionError(error: unknown): FilteredHttpError["body"] {
    return errors.catch(error, "SESSION_INVALID").body;
  },
});

/** HTTP boundary for the three authentication operations approved in OpenAPI. */
export class AuthController {
  public constructor(
    private readonly sessions: SessionService,
    private readonly refreshRotation: RefreshRotationService,
    private readonly sessionGuard: SessionGuard,
  ) {}

  public async unlockWithPin(body: unknown): Promise<unknown> {
    try {
      const dto = parsePinLoginDto(body);
      return serializeSessionResponse(
        await this.sessions.loginWithPin({
          phone: dto.phone,
          pin: dto.pin,
          deviceCredential: dto.deviceCredential,
        }),
      );
    } catch (error) {
      throw new AuthHttpError(errors.catch(error, "AUTHENTICATION_FAILED"));
    }
  }

  public async rotateRefreshToken(body: unknown): Promise<unknown> {
    try {
      const dto = parseRefreshTokenDto(body);
      return serializeSessionResponse(
        await this.refreshRotation.rotate(dto.refreshToken),
      );
    } catch (error) {
      throw new AuthHttpError(errors.catch(error, "SESSION_INVALID"));
    }
  }

  public async logoutCurrentSession(accessToken: string): Promise<void> {
    try {
      await this.sessionGuard.authorize(accessToken);
      await this.sessions.logout(accessToken);
    } catch (error) {
      throw new AuthHttpError(errors.catch(error, "SESSION_INVALID"));
    }
  }
}

/** Contract adapter exercising session invariants without a database connection. */
export function createSessionContractHarness(options: {
  readonly state: SessionContractState;
  readonly expectedPin: string;
  readonly expectedPhone: string;
  readonly expectedDeviceCredential: string;
}): {
  login(input: {
    readonly phone: string;
    readonly pin: string;
    readonly deviceCredential: string;
    readonly now?: Date;
  }): Promise<ContractSessionResponse>;
  refresh(input: {
    readonly refreshToken: string;
    readonly now?: Date;
  }): Promise<ContractSessionResponse>;
  logout(input: {
    readonly accessToken: string;
    readonly now?: Date;
  }): Promise<void>;
  authorize(input: {
    readonly accessToken: string;
    readonly now?: Date;
  }): Promise<void>;
} {
  const tokens = new TokenService({
    accessSigningKey: randomBytes(32),
    refreshHashKey: randomBytes(32),
  });

  const activeContext = {
    tenantId: options.state.tenant.id,
    membershipId: options.state.membership.id,
  } as const;

  const validateIdentity = (): boolean =>
    options.state.user.status === "ACTIVE" &&
    options.state.tenant.status === "ACTIVE" &&
    options.state.membership.status === "ACTIVE" &&
    options.state.device.status === "ACTIVE" &&
    options.state.profile.status === "ACTIVE" &&
    options.state.membership.userId === options.state.user.id &&
    options.state.membership.tenantId === options.state.tenant.id &&
    options.state.profile.userId === options.state.user.id &&
    options.state.profile.membershipId === options.state.membership.id &&
    options.state.profile.tenantId === options.state.tenant.id &&
    options.state.profile.deviceId === options.state.device.id;

  const issueAccess = (sessionId: string, now: Date) =>
    tokens.issueAccessToken({
      sessionId,
      userId: options.state.user.id,
      authVersion: options.state.user.authVersion,
      contextVersion: 1,
      tenantId: activeContext.tenantId,
      membershipId: activeContext.membershipId,
      now,
    });

  const responseFor = (
    session: ContractSessionRecord,
    refreshToken: string,
    now: Date,
  ): ContractSessionResponse => {
    const access = issueAccess(session.id, now);
    return {
      accessToken: access.token,
      refreshToken,
      accessExpiresAt: access.expiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      activeContext,
    };
  };

  const authorize = async (input: {
    readonly accessToken: string;
    readonly now?: Date;
  }): Promise<void> => {
    await Promise.resolve();
    const now = input.now ?? new Date();
    let claims;
    try {
      claims = tokens.verifyAccessToken(input.accessToken, now);
    } catch {
      throw new SessionInvalidError();
    }
    const session = options.state.sessions.find(
      ({ id }) => id === claims.sessionId,
    );
    if (
      session === undefined ||
      session.revokedAt !== null ||
      session.absoluteExpiresAt <= now ||
      claims.userId !== options.state.user.id ||
      claims.authVersion !== options.state.user.authVersion ||
      claims.tenantId !== options.state.tenant.id ||
      claims.membershipId !== options.state.membership.id ||
      !validateIdentity()
    ) {
      throw new SessionInvalidError();
    }
  };

  return {
    async login(input) {
      await Promise.resolve();
      const now = input.now ?? new Date();
      if (
        input.phone !== options.expectedPhone ||
        input.pin !== options.expectedPin ||
        input.deviceCredential !== options.expectedDeviceCredential ||
        !validateIdentity()
      ) {
        throw authenticationFailure();
      }
      const session: ContractSessionRecord = {
        id: randomUUID(),
        userId: options.state.user.id,
        deviceProfileId: options.state.profile.id,
        platform: "MOBILE",
        createdAt: now,
        absoluteExpiresAt: new Date(
          now.getTime() + SESSION_ABSOLUTE_TTL_MILLISECONDS,
        ),
        revokedAt: null,
      };
      const refreshToken = randomBytes(32).toString("base64url");
      const familyId = randomUUID();
      options.state.sessions.push(session);
      options.state.refreshCredentials.push({
        id: randomUUID(),
        sessionId: session.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        issuedAt: now,
        expiresAt: session.absoluteExpiresAt,
        rotatedAt: null,
        replacedById: null,
        revokedAt: null,
      });
      return responseFor(session, refreshToken, now);
    },

    async refresh(input) {
      await Promise.resolve();
      const now = input.now ?? new Date();
      const credential = options.state.refreshCredentials.find(
        ({ tokenHash }) => tokenHash === hashToken(input.refreshToken),
      );
      const session = options.state.sessions.find(
        ({ id }) => id === credential?.sessionId,
      );
      if (
        credential === undefined ||
        session === undefined ||
        credential.rotatedAt !== null ||
        credential.revokedAt !== null ||
        credential.expiresAt <= now ||
        session.revokedAt !== null ||
        session.absoluteExpiresAt <= now ||
        !validateIdentity()
      ) {
        throw authenticationFailure();
      }
      const refreshToken = randomBytes(32).toString("base64url");
      const replacement: ContractRefreshRecord = {
        id: randomUUID(),
        sessionId: session.id,
        familyId: credential.familyId,
        tokenHash: hashToken(refreshToken),
        issuedAt: now,
        expiresAt: session.absoluteExpiresAt,
        rotatedAt: null,
        replacedById: null,
        revokedAt: null,
      };
      credential.rotatedAt = now;
      credential.replacedById = replacement.id;
      options.state.refreshCredentials.push(replacement);
      return responseFor(session, refreshToken, now);
    },

    async logout(input) {
      await Promise.resolve();
      const now = input.now ?? new Date();
      let claims;
      try {
        claims = tokens.verifyAccessToken(input.accessToken, now);
      } catch {
        throw new SessionInvalidError();
      }
      const session = options.state.sessions.find(
        ({ id }) => id === claims.sessionId,
      );
      if (session === undefined || session.revokedAt !== null) {
        throw new SessionInvalidError();
      }
      session.revokedAt = now;
      for (const credential of options.state.refreshCredentials) {
        if (
          credential.sessionId === session.id &&
          credential.revokedAt === null
        ) {
          credential.revokedAt = now;
        }
      }
    },

    authorize,
  };
}
