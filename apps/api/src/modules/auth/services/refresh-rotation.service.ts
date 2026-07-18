import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import { SessionInvalidError } from "./token.service.js";
import type { TokenService } from "./token.service.js";

export interface RefreshRotationResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly activeContext: null | {
    readonly tenantId: string;
    readonly membershipId: string;
  };
}

interface HarnessCredential {
  id: string;
  sessionId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  replacedById: string | null;
  revokedAt: Date | null;
  reuseDetectedAt: Date | null;
}

interface HarnessState {
  session: {
    id: string;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  };
  credentials: HarnessCredential[];
  audits: Array<Record<string, unknown>>;
  logs: unknown[];
}

interface HarnessRotationResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly absoluteExpiresAt: Date;
}

function invalidSession(): SessionInvalidError {
  return new SessionInvalidError();
}

function revokeHarnessFamily(
  draft: HarnessState,
  credential: HarnessCredential,
  now: Date,
): void {
  credential.reuseDetectedAt = now;
  for (const member of draft.credentials) {
    if (member.familyId === credential.familyId && member.revokedAt === null) {
      member.revokedAt = now;
    }
  }
  draft.session.revokedAt ??= now;
  draft.audits.push({
    action: "REFRESH_REUSE_DETECTED",
    sessionId: draft.session.id,
    occurredAt: now.toISOString(),
    result: "DENIED",
  });
}

/** Deterministic transaction adapter used by the refresh security suite. */
export function createRefreshRotationHarness(options: {
  readonly state: HarnessState;
  readonly transaction: <T>(
    work: (draft: HarnessState) => Promise<T>,
  ) => Promise<T>;
  readonly hashToken: (rawToken: string) => string;
  readonly issueOpaqueToken: () => string;
  readonly failAfterReplacement?: boolean;
}): {
  rotate(rawToken: string, now: Date): Promise<HarnessRotationResponse>;
} {
  let queue: Promise<void> = Promise.resolve();
  return {
    rotate(rawToken, now) {
      const operation = queue.then(async () => {
        const outcome = await options.transaction(async (draft) => {
          await Promise.resolve();
          const tokenHash = options.hashToken(rawToken);
          const credential = draft.credentials.find(
            (candidate) => candidate.tokenHash === tokenHash,
          );
          if (
            credential === undefined ||
            credential.sessionId !== draft.session.id ||
            credential.revokedAt !== null ||
            credential.expiresAt.getTime() <= now.getTime() ||
            draft.session.revokedAt !== null ||
            draft.session.absoluteExpiresAt.getTime() <= now.getTime()
          ) {
            return { ok: false as const };
          }
          if (credential.rotatedAt !== null) {
            revokeHarnessFamily(draft, credential, now);
            return { ok: false as const };
          }

          const refreshToken = options.issueOpaqueToken();
          const replacement: HarnessCredential = {
            id: randomUUID(),
            sessionId: credential.sessionId,
            familyId: credential.familyId,
            tokenHash: options.hashToken(refreshToken),
            expiresAt: draft.session.absoluteExpiresAt,
            rotatedAt: null,
            replacedById: null,
            revokedAt: null,
            reuseDetectedAt: null,
          };
          draft.credentials.push(replacement);
          if (options.failAfterReplacement === true) {
            throw new Error("Synthetic replacement persistence failure.");
          }
          credential.rotatedAt = now;
          credential.replacedById = replacement.id;
          return {
            ok: true as const,
            accessToken: randomBytes(32).toString("base64url"),
            refreshToken,
            absoluteExpiresAt: draft.session.absoluteExpiresAt,
          };
        });
        if (!outcome.ok) throw invalidSession();
        return {
          accessToken: outcome.accessToken,
          refreshToken: outcome.refreshToken,
          absoluteExpiresAt: outcome.absoluteExpiresAt,
        };
      });
      queue = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}

type RotationOutcome =
  | { readonly ok: false }
  | { readonly ok: true; readonly response: RefreshRotationResponse };

/** Prisma-backed single-use refresh rotation with family-wide reuse response. */
export class RefreshRotationService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly tokens: TokenService,
  ) {}

  public async rotate(
    rawToken: string,
    now: Date = new Date(),
  ): Promise<RefreshRotationResponse> {
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    try {
      const outcome = await this.prisma.transaction(async (transaction) => {
        const credential = await transaction.refreshCredential.findUnique({
          where: { tokenHash },
          include: { session: true },
        });
        if (credential === null) return { ok: false as const };
        if (credential.rotatedAt !== null) {
          await this.revokeFamily(
            transaction,
            credential.familyId,
            credential.sessionId,
            now,
          );
          return { ok: false as const };
        }
        if (
          credential.revokedAt !== null ||
          credential.expiresAt <= now ||
          credential.session.revokedAt !== null ||
          credential.session.absoluteExpiresAt <= now
        ) {
          return { ok: false as const };
        }

        const replacementId = randomUUID();
        const replacement = this.tokens.issueRefreshToken();
        await transaction.refreshCredential.create({
          data: {
            id: replacementId,
            sessionId: credential.sessionId,
            familyId: credential.familyId,
            tokenHash: replacement.hash,
            issuedAt: now,
            expiresAt: credential.session.absoluteExpiresAt,
          },
        });
        const consumed = await transaction.refreshCredential.updateMany({
          where: {
            id: credential.id,
            rotatedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { rotatedAt: now, replacedById: replacementId },
        });
        if (consumed.count !== 1) {
          throw new Error("Concurrent refresh consumption detected.");
        }

        const access = this.tokens.issueAccessToken({
          sessionId: credential.session.id,
          userId: credential.session.userId,
          authVersion: credential.session.authVersion,
          contextVersion: credential.session.contextVersion,
          tenantId: credential.session.tenantId,
          membershipId: credential.session.activeMembershipId,
          now,
        });
        return {
          ok: true as const,
          response: {
            accessToken: access.token,
            refreshToken: replacement.token,
            accessExpiresAt: access.expiresAt,
            absoluteExpiresAt: credential.session.absoluteExpiresAt,
            activeContext:
              credential.session.tenantId === null ||
              credential.session.activeMembershipId === null
                ? null
                : {
                    tenantId: credential.session.tenantId,
                    membershipId: credential.session.activeMembershipId,
                  },
          },
        } satisfies RotationOutcome;
      });
      if (!outcome.ok) throw invalidSession();
      return outcome.response;
    } catch (error) {
      if (error instanceof SessionInvalidError) throw error;
      await this.revokeIfRotated(tokenHash, now);
      throw invalidSession();
    }
  }

  private async revokeIfRotated(
    tokenHash: Uint8Array<ArrayBuffer>,
    now: Date,
  ): Promise<void> {
    try {
      await this.prisma.transaction(async (transaction) => {
        const credential = await transaction.refreshCredential.findUnique({
          where: { tokenHash },
        });
        if (credential?.rotatedAt !== null && credential !== null) {
          await this.revokeFamily(
            transaction,
            credential.familyId,
            credential.sessionId,
            now,
          );
        }
      });
    } catch {
      // Fail closed. The public response remains uniform even if auditing fails.
    }
  }

  private async revokeFamily(
    transaction: Parameters<Parameters<PrismaModule["transaction"]>[0]>[0],
    familyId: string,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    await transaction.refreshCredential.updateMany({
      where: { familyId },
      data: { revokedAt: now },
    });
    await transaction.refreshCredential.updateMany({
      where: { familyId, rotatedAt: { not: null } },
      data: { reuseDetectedAt: now },
    });
    const session = await transaction.session.update({
      where: { id: sessionId },
      data: { revokedAt: now, revokeReason: "REFRESH_REUSE_DETECTED" },
    });
    await transaction.auditEvent.create({
      data: {
        tenantId: session.tenantId,
        actorType: "SYSTEM",
        actorId: session.userId,
        effectiveMembershipId: session.activeMembershipId,
        sessionId: session.id,
        action: "REFRESH_REUSE_DETECTED",
        targetType: "Session",
        targetId: session.id,
        result: "DENIED",
        reasonCode: "REFRESH_REUSE_DETECTED",
        correlationId: randomUUID(),
      },
    });
  }
}
