import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import type { PhoneBindingService } from "../crypto/phone-binding.service.js";

type Credential =
  | { readonly type: "QR_SECRET"; readonly value: string }
  | { readonly type: "MANUAL_CODE"; readonly value: string };

interface ChallengeState {
  status: "ISSUED" | "CONSUMED";
  expiresAt: Date;
  failedAttempts: number;
  maxAttempts: number;
  qrSecret: string;
  manualCode: string;
}

interface ConsumptionState {
  challenge: ChallengeState;
  devices: Array<{ id: string; type: "PERSONAL" }>;
  profiles: Array<{ id: string; status: "PENDING_PIN" }>;
}

interface ConsumptionOptions {
  readonly state: ConsumptionState;
  readonly transaction: <T>(
    work: (draft: ConsumptionState) => Promise<T>,
  ) => Promise<T>;
  readonly failAfterDevice?: boolean;
}

class SafeAuthenticationError extends Error {
  public readonly code = "AUTHENTICATION_FAILED" as const;

  public constructor() {
    super("Authentication could not be completed.");
    this.name = "SafeAuthenticationError";
  }
}

function authenticationFailure(): SafeAuthenticationError {
  return new SafeAuthenticationError();
}

/** Serialized acceptance adapter that models the database's single-winner transaction. */
export function createActivationConsumptionService(
  options: ConsumptionOptions,
): {
  consume(
    credential: Credential,
    now: Date,
  ): Promise<{ deviceId: string; profileId: string }>;
} {
  let queue: Promise<void> = Promise.resolve();
  return {
    consume(credential, now) {
      const operation = queue.then(async () => {
        const outcome = await options.transaction(async (draft) => {
          await Promise.resolve();
          const challenge = draft.challenge;
          if (
            challenge.status !== "ISSUED" ||
            challenge.expiresAt.getTime() < now.getTime() ||
            challenge.failedAttempts >= challenge.maxAttempts
          ) {
            return { ok: false as const };
          }
          const valid =
            credential.type === "QR_SECRET"
              ? credential.value === challenge.qrSecret
              : credential.value === challenge.manualCode;
          if (!valid) {
            challenge.failedAttempts += 1;
            return { ok: false as const };
          }

          const deviceId = randomUUID();
          const profileId = randomUUID();
          draft.devices.push({ id: deviceId, type: "PERSONAL" });
          if (options.failAfterDevice === true) {
            throw new Error("Synthetic DeviceProfile persistence failure.");
          }
          draft.profiles.push({ id: profileId, status: "PENDING_PIN" });
          challenge.status = "CONSUMED";
          return { ok: true as const, deviceId, profileId };
        });
        if (!outcome.ok) throw authenticationFailure();
        return { deviceId: outcome.deviceId, profileId: outcome.profileId };
      });
      queue = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}

export interface RateLimitInput {
  readonly ip: string;
  readonly deviceIdentifier: string;
  readonly pseudonymousIdentifier: string;
  readonly challengeAlias: string;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly status: number;
  readonly body: Record<string, unknown>;
}

type Dimension = keyof RateLimitInput;

export function createActivationRateLimiter(options: {
  readonly limit: number;
  readonly windowMs: number;
}): {
  check(input: RateLimitInput, now: Date): RateLimitDecision;
  recordFailure(input: RateLimitInput, now: Date): void;
} {
  const attempts = new Map<string, number[]>();
  const dimensions: readonly Dimension[] = [
    "ip",
    "deviceIdentifier",
    "pseudonymousIdentifier",
    "challengeAlias",
  ];
  const bucketKey = (dimension: Dimension, value: string): string =>
    `${dimension}:${value}`;
  const active = (key: string, now: Date): number[] => {
    const cutoff = now.getTime() - options.windowMs;
    const values = (attempts.get(key) ?? []).filter((value) => value >= cutoff);
    attempts.set(key, values);
    return values;
  };
  return {
    check(input, now) {
      const blocked = dimensions.some(
        (dimension) =>
          active(bucketKey(dimension, input[dimension]), now).length >=
          options.limit,
      );
      return blocked
        ? {
            allowed: false,
            status: 429,
            body: {
              code: "TOO_MANY_REQUESTS",
              message: "Authentication could not be completed.",
              correlationId: randomUUID(),
            },
          }
        : { allowed: true, status: 200, body: { code: "OK" } };
    },
    recordFailure(input, now) {
      for (const dimension of dimensions) {
        const key = bucketKey(dimension, input[dimension]);
        active(key, now).push(now.getTime());
      }
    },
  };
}

function hashBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash("sha256").update(value, "utf8").digest());
}

export interface ConsumeActivationCommand {
  readonly phoneE164: string;
  readonly credential: Credential;
  readonly installationId: string;
  readonly platform: "ANDROID" | "IOS";
  readonly appVersion: string;
  readonly deviceCredential: string;
  readonly requestContext?: {
    readonly ip: string;
  };
}

export class ConsumeActivationService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly phoneBinding: PhoneBindingService,
    private readonly rateLimiter = createActivationRateLimiter({
      limit: 5,
      windowMs: 15 * 60 * 1_000,
    }),
  ) {}

  public execute(command: ConsumeActivationCommand): Promise<{
    readonly deviceProfileId: string;
    readonly pinSetupToken: string;
    readonly expiresAt: Date;
  }> {
    const credentialHash = hashBytes(command.credential.value);
    const phoneBinding = this.phoneBinding.bind(command.phoneE164);
    const rateLimitInput: RateLimitInput = {
      ip: command.requestContext?.ip ?? "unknown",
      deviceIdentifier: Buffer.from(hashBytes(command.installationId)).toString(
        "base64url",
      ),
      pseudonymousIdentifier: phoneBinding.phoneBindingHmac,
      challengeAlias: Buffer.from(credentialHash).toString("base64url"),
    };
    const now = new Date();
    if (!this.rateLimiter.check(rateLimitInput, now).allowed) {
      throw authenticationFailure();
    }

    return this.prisma.transaction(async (transaction) => {
      const challenge = await this.findChallenge(
        transaction,
        command.credential,
        credentialHash,
      );
      if (
        challenge === null ||
        challenge.status !== "ISSUED" ||
        challenge.expiresAt <= now ||
        challenge.failedAttempts >= challenge.maxAttempts ||
        !this.phoneBinding.verify(command.phoneE164, {
          phoneBindingHmac: Buffer.from(challenge.phoneBindingHmac).toString(
            "base64url",
          ),
          phoneBindingKeyVersion: challenge.phoneBindingKeyVersion,
        })
      ) {
        if (challenge !== null && challenge.status === "ISSUED") {
          await transaction.activationChallenge.updateMany({
            where: {
              id: challenge.id,
              failedAttempts: { lt: challenge.maxAttempts },
            },
            data: { failedAttempts: { increment: 1 } },
          });
        }
        this.rateLimiter.recordFailure(rateLimitInput, now);
        throw authenticationFailure();
      }

      const device = await transaction.device.create({
        data: {
          type: "PERSONAL",
          installationIdHash: hashBytes(command.installationId),
          platform: command.platform,
          appVersion: command.appVersion,
          status: "ACTIVE",
        },
      });
      const profile = await transaction.deviceProfile.create({
        data: {
          tenantId: challenge.tenantId,
          deviceId: device.id,
          userId: challenge.membership.userId,
          membershipId: challenge.membershipId,
          status: "PENDING_PIN",
          deviceCredentialHashOrPublicKey: hashBytes(command.deviceCredential),
        },
      });
      const consumed = await transaction.activationChallenge.updateMany({
        where: {
          id: challenge.id,
          status: "ISSUED",
          expiresAt: { gt: now },
          failedAttempts: { lt: challenge.maxAttempts },
        },
        data: {
          status: "CONSUMED",
          consumedAt: now,
          consumedByDeviceProfileId: profile.id,
        },
      });
      if (consumed.count !== 1) throw authenticationFailure();
      await transaction.membership.update({
        where: {
          tenantId_id: {
            tenantId: challenge.tenantId,
            id: challenge.membershipId,
          },
        },
        data: { status: "ACTIVE", joinedAt: now, version: { increment: 1 } },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: challenge.tenantId,
          actorType: "SYSTEM",
          action: "ACTIVATION_CONSUMED",
          targetType: "DeviceProfile",
          targetId: profile.id,
          result: "SUCCEEDED",
          correlationId: randomUUID(),
          afterSanitized: {
            deviceType: "PERSONAL",
            profileStatus: "PENDING_PIN",
          },
        },
      });
      return {
        deviceProfileId: profile.id,
        pinSetupToken: randomUUID(),
        expiresAt: new Date(now.getTime() + 5 * 60 * 1_000),
      };
    });
  }

  private findChallenge(
    transaction: Prisma.TransactionClient,
    credential: Credential,
    credentialHash: Uint8Array<ArrayBuffer>,
  ) {
    if (credential.type === "QR_SECRET") {
      return transaction.activationChallenge.findUnique({
        where: { qrSecretHash: credentialHash },
        include: { membership: true },
      });
    }
    return transaction.activationManualAlias
      .findUnique({
        where: { codeHash: credentialHash },
        include: { challenge: { include: { membership: true } } },
      })
      .then((alias) => alias?.challenge ?? null);
  }
}
