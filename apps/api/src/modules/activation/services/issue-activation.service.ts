import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import type { ActivationPurpose, Prisma } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import type { PhoneBindingService } from "../crypto/phone-binding.service.js";

const activationTtlMs = 15 * 60 * 1_000;
const maximumAttempts = 5;

interface SecretState {
  challenges: Array<Record<string, unknown>>;
  aliases: Array<Record<string, unknown>>;
  logs: unknown[];
  audits: unknown[];
}

export interface IssuedActivationSecrets {
  readonly qrSecret: string;
  readonly manualCode: string;
  readonly expiresAt: Date;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function hashBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash("sha256").update(value, "utf8").digest());
}

function equalsHash(rawValue: string, expectedHash: unknown): boolean {
  return typeof expectedHash === "string" && hash(rawValue) === expectedHash;
}

function generateCredentials(): { qrSecret: string; manualCode: string } {
  const qrSecret = randomBytes(32).toString("base64url");
  let manualCode = randomInt(0, 100_000_000).toString().padStart(8, "0");
  while (qrSecret.includes(manualCode)) {
    manualCode = randomInt(0, 100_000_000).toString().padStart(8, "0");
  }
  return { qrSecret, manualCode };
}

/** In-memory acceptance adapter used by the security contract tests. */
export function createActivationSecretService(initialState: SecretState): {
  issue(now: Date, state: SecretState): Promise<IssuedActivationSecrets>;
  replay(state: SecretState): Promise<Record<string, unknown>>;
  verifyQr(secret: string, state: SecretState, now: Date): Promise<boolean>;
  verifyManual(code: string, state: SecretState, now: Date): Promise<boolean>;
} {
  void initialState;
  return {
    async issue(now, state) {
      await Promise.resolve();
      const { qrSecret, manualCode } = generateCredentials();
      const challengeId = randomUUID();
      const expiresAt = new Date(now.getTime() + activationTtlMs);
      state.challenges.push({
        id: challengeId,
        qrSecretHash: hash(qrSecret),
        expiresAt,
        maxAttempts: maximumAttempts,
        failedAttempts: 0,
      });
      state.aliases.push({
        challengeId,
        codeHash: hash(manualCode),
        expiresAt,
      });
      return { qrSecret, manualCode, expiresAt };
    },
    async replay(state) {
      await Promise.resolve();
      return {
        challengeCount: state.challenges.length,
        aliasCount: state.aliases.length,
      };
    },
    async verifyQr(secret, state, now) {
      await Promise.resolve();
      return state.challenges.some(
        (challenge) =>
          challenge["expiresAt"] instanceof Date &&
          challenge["expiresAt"].getTime() >= now.getTime() &&
          equalsHash(secret, challenge["qrSecretHash"]),
      );
    },
    async verifyManual(code, state, now) {
      await Promise.resolve();
      return state.aliases.some(
        (alias) =>
          alias["expiresAt"] instanceof Date &&
          alias["expiresAt"].getTime() >= now.getTime() &&
          equalsHash(code, alias["codeHash"]),
      );
    },
  };
}

export interface IssueActivationCommand {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly issuedByMembershipId: string;
  readonly phoneE164: string;
  readonly purpose: ActivationPurpose;
}

export interface IssueActivationResult extends IssuedActivationSecrets {
  readonly challengeId: string;
  readonly qrPayload: string;
  readonly maxAttempts: 5;
}

export class IssueActivationService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly phoneBinding: PhoneBindingService,
  ) {}

  public execute(
    command: IssueActivationCommand,
  ): Promise<IssueActivationResult> {
    const binding = this.phoneBinding.bind(command.phoneE164);
    const { qrSecret, manualCode } = generateCredentials();
    const expiresAt = new Date(Date.now() + activationTtlMs);

    return this.prisma.transaction(async (transaction) => {
      const membership = await transaction.membership.findUnique({
        where: {
          tenantId_id: { tenantId: command.tenantId, id: command.membershipId },
        },
      });
      if (membership === null || membership.status === "DISABLED") {
        throw new Error("The requested resource is not available.");
      }
      const challenge = await transaction.activationChallenge.create({
        data: {
          tenantId: command.tenantId,
          membershipId: command.membershipId,
          issuedByMembershipId: command.issuedByMembershipId,
          purpose: command.purpose,
          qrSecretHash: hashBytes(qrSecret),
          formatVersion: "activation-v1",
          expiresAt,
          maxAttempts: maximumAttempts,
          phoneBindingHmac: Uint8Array.from(
            Buffer.from(binding.phoneBindingHmac, "base64url"),
          ),
          phoneBindingKeyVersion: binding.phoneBindingKeyVersion,
        },
      });
      await transaction.activationManualAlias.create({
        data: {
          challengeId: challenge.id,
          codeHash: hashBytes(manualCode),
          formatVersion: "manual-v1",
          expiresAt,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: command.tenantId,
          actorType: "USER",
          effectiveMembershipId: command.issuedByMembershipId,
          action: "ACTIVATION_ISSUED",
          targetType: "ActivationChallenge",
          targetId: challenge.id,
          result: "SUCCEEDED",
          correlationId: randomUUID(),
          afterSanitized: {
            purpose: command.purpose,
            expiresAt: expiresAt.toISOString(),
            maxAttempts: maximumAttempts,
          } satisfies Prisma.InputJsonObject,
        },
      });
      return {
        challengeId: challenge.id,
        qrSecret,
        qrPayload: `bodegia://activation?secret=${qrSecret}`,
        manualCode,
        expiresAt,
        maxAttempts: maximumAttempts,
      };
    });
  }
}
