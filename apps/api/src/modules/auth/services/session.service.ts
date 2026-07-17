import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { normalizeE164 } from "../../../common/validation/e164.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import { SafeAuthenticationError } from "./pin.service.js";
import type { PinService } from "./pin.service.js";
import {
  SESSION_ABSOLUTE_TTL_MILLISECONDS,
  SessionInvalidError,
} from "./token.service.js";
import type { TokenService } from "./token.service.js";

export interface SessionCreationResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly activeContext: null | {
    readonly tenantId: string;
    readonly membershipId: string;
  };
}

export interface LoginWithPinCommand {
  readonly phone: string;
  readonly pin: string;
  readonly deviceCredential: string;
  readonly now?: Date;
}

function authenticationFailure(): SafeAuthenticationError {
  return new SafeAuthenticationError();
}

function defaultCredentialVerifier(
  rawCredential: string,
  storedCredential: Uint8Array,
): boolean {
  const received = createHash("sha256").update(rawCredential, "utf8").digest();
  const expected = Buffer.from(storedCredential);
  return (
    received.byteLength === expected.byteLength &&
    timingSafeEqual(received, expected)
  );
}

/** Creates and revokes persisted MOBILE sessions without retaining raw tokens. */
export class SessionService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly pins: PinService,
    private readonly tokens: TokenService,
    private readonly verifyDeviceCredential: (
      rawCredential: string,
      storedCredential: Uint8Array,
    ) => boolean = defaultCredentialVerifier,
  ) {}

  public async loginWithPin(
    command: LoginWithPinCommand,
  ): Promise<SessionCreationResponse> {
    let phoneE164: string;
    try {
      phoneE164 = normalizeE164(command.phone);
    } catch {
      throw authenticationFailure();
    }
    const now = command.now ?? new Date();
    const candidates = await this.prisma.execute((client) =>
      client.deviceProfile.findMany({
        where: {
          user: { phoneE164 },
          status: "ACTIVE",
          device: { status: "ACTIVE", type: "PERSONAL" },
          membership: { status: "ACTIVE" },
          tenant: { status: "ACTIVE" },
        },
        include: { user: true, device: true, membership: true, tenant: true },
      }),
    );
    const matchingProfiles = candidates.filter((profile) =>
      this.verifyDeviceCredential(
        command.deviceCredential,
        profile.deviceCredentialHashOrPublicKey,
      ),
    );
    const candidate = matchingProfiles[0];
    if (candidate === undefined || matchingProfiles.length !== 1) {
      throw authenticationFailure();
    }

    await this.pins.verify({
      deviceProfileId: candidate.id,
      pin: command.pin,
      serverNow: now,
    });

    return this.prisma.transaction(async (transaction) => {
      const profile = await transaction.deviceProfile.findUnique({
        where: { id: candidate.id },
        include: { user: true, device: true, membership: true, tenant: true },
      });
      if (
        profile === null ||
        profile.user.phoneE164 !== phoneE164 ||
        profile.user.status !== "ACTIVE" ||
        profile.status !== "ACTIVE" ||
        profile.device.status !== "ACTIVE" ||
        profile.device.type !== "PERSONAL" ||
        profile.membership.status !== "ACTIVE" ||
        profile.membership.userId !== profile.userId ||
        profile.membership.tenantId !== profile.tenantId ||
        profile.tenant.status !== "ACTIVE" ||
        !this.verifyDeviceCredential(
          command.deviceCredential,
          profile.deviceCredentialHashOrPublicKey,
        )
      ) {
        throw authenticationFailure();
      }

      const activeMembershipCount = await transaction.membership.count({
        where: {
          userId: profile.userId,
          status: "ACTIVE",
          tenant: { status: "ACTIVE" },
        },
      });
      const hasSingleContext = activeMembershipCount === 1;
      const tenantId = hasSingleContext ? profile.tenantId : null;
      const membershipId = hasSingleContext ? profile.membershipId : null;
      const absoluteExpiresAt = new Date(
        now.getTime() + SESSION_ABSOLUTE_TTL_MILLISECONDS,
      );
      const session = await transaction.session.create({
        data: {
          userId: profile.userId,
          deviceProfileId: profile.id,
          platform: "MOBILE",
          tenantId,
          activeMembershipId: membershipId,
          authVersion: profile.user.authVersion,
          contextVersion: 1,
          createdAt: now,
          absoluteExpiresAt,
          lastActivityAt: now,
        },
      });
      const familyId = randomUUID();
      const refresh = this.tokens.issueRefreshToken();
      await transaction.refreshCredential.create({
        data: {
          sessionId: session.id,
          familyId,
          tokenHash: refresh.hash,
          issuedAt: now,
          expiresAt: absoluteExpiresAt,
        },
      });
      const access = this.tokens.issueAccessToken({
        sessionId: session.id,
        userId: session.userId,
        authVersion: session.authVersion,
        contextVersion: session.contextVersion,
        tenantId: session.tenantId,
        membershipId: session.activeMembershipId,
        now,
      });
      return {
        accessToken: access.token,
        refreshToken: refresh.token,
        accessExpiresAt: access.expiresAt,
        absoluteExpiresAt,
        activeContext:
          tenantId === null || membershipId === null
            ? null
            : { tenantId, membershipId },
      };
    });
  }

  public logout(accessToken: string, now: Date = new Date()): Promise<void> {
    const claims = this.tokens.verifyAccessToken(accessToken, now);
    return this.prisma.transaction(async (transaction) => {
      const revoked = await transaction.session.updateMany({
        where: {
          id: claims.sessionId,
          userId: claims.userId,
          authVersion: claims.authVersion,
          contextVersion: claims.contextVersion,
          revokedAt: null,
          absoluteExpiresAt: { gt: now },
        },
        data: { revokedAt: now, revokeReason: "USER_LOGOUT" },
      });
      if (revoked.count !== 1) throw new SessionInvalidError();
      await transaction.refreshCredential.updateMany({
        where: { sessionId: claims.sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }
}
