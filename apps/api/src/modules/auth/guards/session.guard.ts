import { randomUUID } from "node:crypto";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  type AccessTokenClaims,
  SessionInvalidError,
} from "../services/token.service.js";
import type { TokenService } from "../services/token.service.js";

export interface SessionAuthorizationContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly deviceProfileId: string;
  readonly tenantId: string | null;
  readonly membershipId: string | null;
  readonly contextVersion: number;
}

interface HarnessState {
  user: { id: string; status: "ACTIVE" | "DISABLED"; authVersion: number };
  tenants: Array<{ id: string; status: "ACTIVE" | "DISABLED" }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
  }>;
  devices: Array<{ id: string; status: "ACTIVE" | "REVOKED" }>;
  profiles: Array<{
    id: string;
    tenantId: string;
    membershipId: string;
    userId: string;
    deviceId: string;
    status: "ACTIVE" | "REVOKED";
  }>;
  sessions: Array<{
    id: string;
    userId: string;
    tenantId: string;
    activeMembershipId: string;
    deviceProfileId: string;
    authVersion: number;
    contextVersion: number;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  }>;
  refreshFamilies: Array<{
    id: string;
    sessionId: string;
    status: "ACTIVE" | "REVOKED";
  }>;
  validationReads: number;
  audits: Array<Record<string, unknown>>;
  logs: unknown[];
}

interface HarnessClaims {
  readonly sessionId: string;
  readonly userId: string;
  readonly authVersion: number;
  readonly contextVersion: number;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly expiresAt: Date;
}

function invalidSession(): SessionInvalidError {
  return new SessionInvalidError();
}

/** State-backed guard used to prove immediate revocation and A/B isolation. */
export function createSessionGuardHarness(options: {
  readonly state: HarnessState;
  readonly decodeAccessToken: (token: string) => HarnessClaims;
}): {
  authorize(input: {
    readonly accessToken: string;
    readonly serverNow: Date;
  }): Promise<{ readonly tenantId: string; readonly membershipId: string }>;
} {
  const deny = (now: Date): never => {
    options.state.audits.push({
      action: "SESSION_ACCESS_DENIED",
      occurredAt: now.toISOString(),
      result: "DENIED",
    });
    throw invalidSession();
  };

  return {
    async authorize(input) {
      await Promise.resolve();
      options.state.validationReads += 1;
      let claims: HarnessClaims;
      try {
        claims = options.decodeAccessToken(input.accessToken);
      } catch {
        return deny(input.serverNow);
      }
      const session = options.state.sessions.find(
        ({ id }) => id === claims.sessionId,
      );
      const tenant = options.state.tenants.find(
        ({ id }) => id === claims.tenantId,
      );
      const membership = options.state.memberships.find(
        ({ id }) => id === claims.membershipId,
      );
      const profile = options.state.profiles.find(
        ({ id }) => id === session?.deviceProfileId,
      );
      const device = options.state.devices.find(
        ({ id }) => id === profile?.deviceId,
      );
      const hasActiveFamily = options.state.refreshFamilies.some(
        (family) =>
          family.sessionId === claims.sessionId && family.status === "ACTIVE",
      );
      const valid =
        claims.expiresAt.getTime() > input.serverNow.getTime() &&
        session !== undefined &&
        session.revokedAt === null &&
        session.absoluteExpiresAt.getTime() > input.serverNow.getTime() &&
        session.userId === claims.userId &&
        session.tenantId === claims.tenantId &&
        session.activeMembershipId === claims.membershipId &&
        session.authVersion === claims.authVersion &&
        session.contextVersion === claims.contextVersion &&
        options.state.user.id === claims.userId &&
        options.state.user.status === "ACTIVE" &&
        options.state.user.authVersion === claims.authVersion &&
        tenant?.status === "ACTIVE" &&
        membership?.status === "ACTIVE" &&
        membership.userId === claims.userId &&
        membership.tenantId === claims.tenantId &&
        profile?.status === "ACTIVE" &&
        profile.userId === claims.userId &&
        profile.membershipId === claims.membershipId &&
        profile.tenantId === claims.tenantId &&
        device?.status === "ACTIVE" &&
        hasActiveFamily;
      if (!valid) return deny(input.serverNow);
      return {
        tenantId: claims.tenantId,
        membershipId: claims.membershipId,
      };
    },
  };
}

/** Revalidates all authoritative state on every protected API request. */
export class SessionGuard {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly tokens: TokenService,
  ) {}

  public async authorize(
    accessToken: string,
    serverNow: Date = new Date(),
  ): Promise<SessionAuthorizationContext> {
    let claims: AccessTokenClaims | null = null;
    try {
      const currentClaims = this.tokens.verifyAccessToken(
        accessToken,
        serverNow,
      );
      claims = currentClaims;
      const session = await this.prisma.execute((client) =>
        client.session.findUnique({
          where: { id: currentClaims.sessionId },
          include: {
            user: true,
            tenant: true,
            activeMembership: true,
            deviceProfile: {
              include: {
                user: true,
                tenant: true,
                membership: true,
                device: true,
              },
            },
            refreshCredentials: {
              where: { revokedAt: null, expiresAt: { gt: serverNow } },
              select: { id: true },
              take: 1,
            },
          },
        }),
      );
      if (
        session === null ||
        session.revokedAt !== null ||
        session.absoluteExpiresAt <= serverNow ||
        session.platform !== "MOBILE" ||
        session.userId !== currentClaims.userId ||
        session.authVersion !== currentClaims.authVersion ||
        session.contextVersion !== currentClaims.contextVersion ||
        session.tenantId !== currentClaims.tenantId ||
        session.activeMembershipId !== currentClaims.membershipId ||
        session.user.status !== "ACTIVE" ||
        session.user.authVersion !== currentClaims.authVersion ||
        session.deviceProfile.status !== "ACTIVE" ||
        session.deviceProfile.userId !== currentClaims.userId ||
        session.deviceProfile.user.status !== "ACTIVE" ||
        session.deviceProfile.membership.status !== "ACTIVE" ||
        session.deviceProfile.membership.userId !== currentClaims.userId ||
        session.deviceProfile.membership.tenantId !==
          session.deviceProfile.tenantId ||
        session.deviceProfile.tenant.status !== "ACTIVE" ||
        session.deviceProfile.device.status !== "ACTIVE" ||
        session.deviceProfile.device.type !== "PERSONAL" ||
        session.refreshCredentials.length !== 1
      ) {
        throw invalidSession();
      }
      if (
        currentClaims.tenantId === null ||
        currentClaims.membershipId === null
      ) {
        if (session.tenant !== null || session.activeMembership !== null) {
          throw invalidSession();
        }
      } else if (
        session.tenant?.status !== "ACTIVE" ||
        session.activeMembership?.status !== "ACTIVE" ||
        session.activeMembership.userId !== currentClaims.userId ||
        session.activeMembership.tenantId !== currentClaims.tenantId ||
        session.deviceProfile.tenantId !== currentClaims.tenantId ||
        session.deviceProfile.membershipId !== currentClaims.membershipId ||
        session.deviceProfile.membership.status !== "ACTIVE" ||
        session.deviceProfile.tenant.status !== "ACTIVE"
      ) {
        throw invalidSession();
      }
      return {
        sessionId: session.id,
        userId: session.userId,
        deviceProfileId: session.deviceProfileId,
        tenantId: session.tenantId,
        membershipId: session.activeMembershipId,
        contextVersion: session.contextVersion,
      };
    } catch {
      await this.auditDenial(claims?.sessionId ?? null, serverNow);
      throw invalidSession();
    }
  }

  private async auditDenial(
    sessionId: string | null,
    now: Date,
  ): Promise<void> {
    if (sessionId === null) return;
    try {
      await this.prisma.transaction(async (transaction) => {
        const session = await transaction.session.findUnique({
          where: { id: sessionId },
        });
        if (session === null) return;
        await transaction.auditEvent.create({
          data: {
            tenantId: session.tenantId,
            actorType: "SYSTEM",
            actorId: session.userId,
            effectiveMembershipId: session.activeMembershipId,
            sessionId: session.id,
            action: "SESSION_ACCESS_DENIED",
            targetType: "Session",
            targetId: session.id,
            result: "DENIED",
            reasonCode: "SESSION_INVALID",
            correlationId: randomUUID(),
            occurredAt: now,
          },
        });
      });
    } catch {
      // Authorization remains fail-closed and the response stays uniform.
    }
  }
}
