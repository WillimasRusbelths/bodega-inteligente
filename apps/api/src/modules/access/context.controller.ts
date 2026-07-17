import { createHash, randomBytes } from "node:crypto";
import {
  HttpExceptionFilter,
  type FilteredHttpError,
} from "../../common/errors/http-exception.filter.js";
import type { SessionGuard } from "../auth/guards/session.guard.js";
import {
  SessionInvalidError,
  TokenService,
} from "../auth/services/token.service.js";
import { parseSelectTenantDto } from "./dto/index.js";
import { TenantResourceNotFoundError } from "./guards/authorization-errors.js";
import {
  memoryActiveMemberships,
  memoryMembershipChoice,
  type ActiveContextService,
  type MembershipChoice,
  type MemoryActiveMembership,
} from "./services/active-context.service.js";
import type {
  SelectTenantService,
  TenantSelectionResponse,
} from "./services/select-tenant.service.js";

const errors = new HttpExceptionFilter();

class ContextHttpError extends Error {
  public readonly status: number;
  public readonly body: FilteredHttpError["body"];

  public constructor(error: FilteredHttpError) {
    super(error.body.message);
    this.name = "ContextHttpError";
    this.status = error.status;
    this.body = error.body;
  }
}

function serializeSelection(value: TenantSelectionResponse): unknown {
  return {
    accessToken: value.accessToken,
    tokenType: value.tokenType,
    expiresInSeconds: value.expiresInSeconds,
    sessionExpiresAt: value.sessionExpiresAt.toISOString(),
    activeTenant: value.activeTenant,
    contextVersion: value.contextVersion,
  };
}

/** OpenAPI boundary for /me, /me/memberships and active tenant selection. */
export class ContextController {
  public constructor(
    private readonly activeContext: ActiveContextService,
    private readonly selectTenant: SelectTenantService,
    private readonly sessions: SessionGuard,
  ) {}

  public async getMyIdentity(accessToken: string): Promise<unknown> {
    try {
      const context = await this.sessions.authorize(accessToken);
      return this.activeContext.getMyContext(context.sessionId, context.userId);
    } catch (error) {
      throw new ContextHttpError(errors.catch(error, "SESSION_INVALID"));
    }
  }

  public async listMyActiveMemberships(accessToken: string): Promise<unknown> {
    try {
      const context = await this.sessions.authorize(accessToken);
      return this.activeContext.listActiveMemberships(context.userId);
    } catch (error) {
      throw new ContextHttpError(errors.catch(error, "SESSION_INVALID"));
    }
  }

  public async selectActiveTenant(
    accessToken: string,
    body: unknown,
  ): Promise<unknown> {
    try {
      const context = await this.sessions.authorize(accessToken);
      const dto = parseSelectTenantDto(body);
      return serializeSelection(
        await this.selectTenant.select({
          sessionId: context.sessionId,
          userId: context.userId,
          membershipId: dto.membershipId,
        }),
      );
    } catch (error) {
      const code =
        error instanceof TenantResourceNotFoundError
          ? "RESOURCE_NOT_FOUND"
          : "SESSION_INVALID";
      throw new ContextHttpError(errors.catch(error, code));
    }
  }
}

interface ContractState {
  user: { id: string; displayName: string; status: "ACTIVE" };
  memberships: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
    roles: string[];
    permissions: string[];
  }>;
  session: {
    id: string;
    userId: string;
    tenantId: string | null;
    activeMembershipId: string | null;
    authVersion: number;
    contextVersion: number;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  };
  audits: Array<Record<string, unknown>>;
  logs: unknown[];
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

/** Contract adapter proving context replacement without refresh rotation. */
export function createActiveTenantContractHarness(options: {
  readonly state: ContractState;
  readonly initialRefreshToken: string;
}): {
  getMe(): Promise<{
    readonly userId: string;
    readonly displayName: string;
    readonly activeContext: MembershipChoice | null;
    readonly memberships: readonly MembershipChoice[];
  }>;
  listMemberships(): Promise<readonly MembershipChoice[]>;
  issueCurrentAccessToken(now: Date): Promise<string>;
  selectTenant(input: {
    readonly membershipId: string;
    readonly now: Date;
  }): Promise<{
    readonly accessToken: string;
    readonly tokenType: "Bearer";
    readonly expiresInSeconds: number;
    readonly sessionExpiresAt: string;
    readonly activeTenant: MembershipChoice & {
      readonly capabilities: readonly string[];
    };
    readonly contextVersion: number;
  }>;
  refresh(input: {
    readonly refreshToken: string;
    readonly now: Date;
  }): Promise<{
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly absoluteExpiresAt: string;
    readonly activeContext: MembershipChoice | null;
  }>;
  authorize(
    accessToken: string,
    now: Date,
  ): Promise<{
    readonly tenantId: string | null;
    readonly membershipId: string | null;
    readonly contextVersion: number;
  }>;
} {
  const tokens = new TokenService({
    accessSigningKey: randomBytes(32),
    refreshHashKey: randomBytes(32),
  });
  let currentRefreshHash = tokenHash(options.initialRefreshToken);

  const activeMemberships = (): readonly MemoryActiveMembership[] =>
    memoryActiveMemberships(options.state.memberships, options.state.user.id);

  const activeChoice = (): MembershipChoice | null => {
    const membership = activeMemberships().find(
      ({ id, tenantId }) =>
        id === options.state.session.activeMembershipId &&
        tenantId === options.state.session.tenantId,
    );
    return membership === undefined ? null : memoryMembershipChoice(membership);
  };

  const issueAccess = (now: Date): string =>
    tokens.issueAccessToken({
      sessionId: options.state.session.id,
      userId: options.state.session.userId,
      authVersion: options.state.session.authVersion,
      contextVersion: options.state.session.contextVersion,
      tenantId: options.state.session.tenantId,
      membershipId: options.state.session.activeMembershipId,
      now,
    }).token;

  const list = (): readonly MembershipChoice[] =>
    activeMemberships().map(memoryMembershipChoice);

  return {
    async getMe() {
      await Promise.resolve();
      const memberships = activeMemberships();
      if (
        memberships.length === 1 &&
        options.state.session.tenantId === null &&
        options.state.session.activeMembershipId === null
      ) {
        const membership = memberships[0];
        if (membership !== undefined) {
          options.state.session.tenantId = membership.tenantId;
          options.state.session.activeMembershipId = membership.id;
        }
      }
      return {
        userId: options.state.user.id,
        displayName: options.state.user.displayName,
        activeContext: activeChoice(),
        memberships: list(),
      };
    },
    async listMemberships() {
      await Promise.resolve();
      return list();
    },
    async issueCurrentAccessToken(now) {
      await Promise.resolve();
      return issueAccess(now);
    },
    async selectTenant(input) {
      await Promise.resolve();
      const membership = activeMemberships().find(
        ({ id }) => id === input.membershipId,
      );
      if (membership === undefined) throw new TenantResourceNotFoundError();
      const previousTenantId = options.state.session.tenantId;
      const previousMembershipId = options.state.session.activeMembershipId;
      options.state.session.tenantId = membership.tenantId;
      options.state.session.activeMembershipId = membership.id;
      options.state.session.contextVersion += 1;
      options.state.audits.push({
        action: "ACTIVE_TENANT_CHANGED",
        sessionId: options.state.session.id,
        actorId: options.state.user.id,
        previousTenantId,
        previousMembershipId,
        tenantId: membership.tenantId,
        membershipId: membership.id,
        contextVersion: options.state.session.contextVersion,
        occurredAt: input.now.toISOString(),
      });
      const access = tokens.issueAccessToken({
        sessionId: options.state.session.id,
        userId: options.state.session.userId,
        authVersion: options.state.session.authVersion,
        contextVersion: options.state.session.contextVersion,
        tenantId: membership.tenantId,
        membershipId: membership.id,
        now: input.now,
      });
      return {
        accessToken: access.token,
        tokenType: "Bearer",
        expiresInSeconds: 600,
        sessionExpiresAt: options.state.session.absoluteExpiresAt.toISOString(),
        activeTenant: {
          ...memoryMembershipChoice(membership),
          capabilities: [...membership.permissions],
        },
        contextVersion: options.state.session.contextVersion,
      };
    },
    async refresh(input) {
      await Promise.resolve();
      if (
        tokenHash(input.refreshToken) !== currentRefreshHash ||
        options.state.session.revokedAt !== null ||
        options.state.session.absoluteExpiresAt <= input.now
      ) {
        throw new SessionInvalidError();
      }
      const nextRefresh = randomBytes(32).toString("base64url");
      currentRefreshHash = tokenHash(nextRefresh);
      return {
        accessToken: issueAccess(input.now),
        refreshToken: nextRefresh,
        absoluteExpiresAt:
          options.state.session.absoluteExpiresAt.toISOString(),
        activeContext: activeChoice(),
      };
    },
    async authorize(accessToken, now) {
      await Promise.resolve();
      const claims = tokens.verifyAccessToken(accessToken, now);
      if (
        claims.sessionId !== options.state.session.id ||
        claims.userId !== options.state.session.userId ||
        claims.authVersion !== options.state.session.authVersion ||
        claims.contextVersion !== options.state.session.contextVersion ||
        claims.tenantId !== options.state.session.tenantId ||
        claims.membershipId !== options.state.session.activeMembershipId ||
        options.state.session.revokedAt !== null ||
        options.state.session.absoluteExpiresAt <= now
      ) {
        throw new SessionInvalidError();
      }
      return {
        tenantId: claims.tenantId,
        membershipId: claims.membershipId,
        contextVersion: claims.contextVersion,
      };
    },
  };
}
