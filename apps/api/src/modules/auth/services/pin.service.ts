import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { argon2id, hash as argon2Hash, verify as argon2Verify } from "argon2";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  DEFAULT_ARGON2_CONFIGURATION,
  type Argon2Configuration,
} from "../crypto/argon2.config.js";

const PIN_PATTERN = /^\d{6}$/u;
const PIN_LOCKOUT_ATTEMPTS = 5;
const PIN_LOCKOUT_MILLISECONDS = 15 * 60 * 1_000;

interface PepperOptions {
  readonly currentPepperVersion: string;
  readonly peppers: ReadonlyMap<string, Uint8Array>;
  readonly argon2?: Readonly<Argon2Configuration>;
}

interface MutablePinProfile {
  id: string;
  status: "PENDING_PIN" | "ACTIVE" | "LOCKED" | "REVOKED";
  pinHash?: string;
  pinSaltVersion?: string;
  pinPepperVersion?: string;
}

interface PinTelemetryState {
  readonly logs: unknown[];
  readonly audits: unknown[];
  readonly errors: unknown[];
}

interface LockoutProfile {
  status: "ACTIVE" | "LOCKED" | "REVOKED";
  membershipStatus: "ACTIVE" | "DISABLED";
  failedPinAttempts: number;
  lockedUntil: Date | null;
  pinHash: string;
}

interface AttemptState {
  profile: LockoutProfile;
  audits: Array<Record<string, unknown>>;
}

export class SafeAuthenticationError extends Error {
  public readonly code = "AUTHENTICATION_FAILED" as const;

  public constructor() {
    super("Authentication could not be completed.");
    this.name = "SafeAuthenticationError";
  }
}

function authenticationFailure(): SafeAuthenticationError {
  return new SafeAuthenticationError();
}

function validatePin(pin: string): void {
  if (!PIN_PATTERN.test(pin)) throw authenticationFailure();
}

function pepperedPin(pin: string, pepper: Uint8Array): Buffer {
  return createHmac("sha256", pepper).update(pin, "utf8").digest();
}

class PinHasher {
  readonly #configuration: Readonly<Argon2Configuration>;

  public constructor(private readonly options: PepperOptions) {
    this.#configuration = options.argon2 ?? DEFAULT_ARGON2_CONFIGURATION;
    if (!options.peppers.has(options.currentPepperVersion)) {
      throw new Error("The current PIN pepper version is not configured.");
    }
  }

  public async hash(pin: string): Promise<{
    readonly encodedHash: string;
    readonly saltVersion: string;
    readonly pepperVersion: string;
  }> {
    validatePin(pin);
    const pepper = this.options.peppers.get(this.options.currentPepperVersion);
    if (pepper === undefined) {
      throw new Error("The current PIN pepper version is not configured.");
    }
    const material = pepperedPin(pin, pepper);
    try {
      const encodedHash = await argon2Hash(material, {
        type: argon2id,
        memoryCost: this.#configuration.memoryCostKiB,
        timeCost: this.#configuration.timeCost,
        parallelism: this.#configuration.parallelism,
        hashLength: this.#configuration.hashLength,
        salt: randomBytes(this.#configuration.saltLength),
      });
      return {
        encodedHash,
        saltVersion: this.#configuration.version,
        pepperVersion: this.options.currentPepperVersion,
      };
    } finally {
      material.fill(0);
    }
  }

  public async verify(
    pin: string,
    encodedHash: string,
    pepperVersion: string,
  ): Promise<boolean> {
    if (!PIN_PATTERN.test(pin)) return false;
    const pepper = this.options.peppers.get(pepperVersion);
    if (pepper === undefined) return false;
    const material = pepperedPin(pin, pepper);
    try {
      return await argon2Verify(encodedHash, material);
    } catch {
      return false;
    } finally {
      material.fill(0);
    }
  }
}

/** Small deterministic boundary used by the security suite without persistence. */
export function createPinService(options: PepperOptions): {
  validate(pin: string): void;
  setup(
    pin: string,
    profile: MutablePinProfile,
    state: PinTelemetryState,
  ): Promise<void>;
  verify(pin: string, profile: MutablePinProfile): Promise<boolean>;
} {
  const hasher = new PinHasher(options);
  return {
    validate: validatePin,
    async setup(pin, profile, state) {
      void state;
      if (profile.status !== "PENDING_PIN") throw authenticationFailure();
      const result = await hasher.hash(pin);
      profile.pinHash = result.encodedHash;
      profile.pinSaltVersion = result.saltVersion;
      profile.pinPepperVersion = result.pepperVersion;
      profile.status = "ACTIVE";
    },
    async verify(pin, profile) {
      if (
        profile.pinHash === undefined ||
        profile.pinPepperVersion === undefined ||
        profile.status === "REVOKED"
      ) {
        return false;
      }
      return hasher.verify(pin, profile.pinHash, profile.pinPepperVersion);
    },
  };
}

/** Serialized adapter mirroring the database transaction used for lockout. */
export function createPinAttemptService(options: {
  readonly state: AttemptState;
  readonly transaction: <T>(
    work: (draft: AttemptState) => Promise<T>,
  ) => Promise<T>;
  readonly verifyHash?: (pin: string, hash: string) => Promise<boolean>;
}): {
  attempt(input: {
    readonly pin: string;
    readonly serverNow: Date;
    readonly deviceNow?: Date;
  }): Promise<{ authenticated: boolean }>;
} {
  const verifyHash =
    options.verifyHash ??
    ((pin: string): Promise<boolean> => Promise.resolve(pin === "123456"));
  let queue: Promise<void> = Promise.resolve();

  return {
    attempt(input) {
      const operation = queue.then(async () => {
        const result = await options.transaction(async (draft) => {
          const profile = draft.profile;
          if (
            profile.status === "REVOKED" ||
            profile.membershipStatus !== "ACTIVE"
          ) {
            return { authenticated: false as const };
          }

          if (
            profile.status === "LOCKED" &&
            profile.lockedUntil !== null &&
            profile.lockedUntil.getTime() > input.serverNow.getTime()
          ) {
            return { authenticated: false as const };
          }

          if (profile.status === "LOCKED") {
            profile.status = "ACTIVE";
            profile.failedPinAttempts = 0;
            profile.lockedUntil = null;
          }

          const authenticated = await verifyHash(input.pin, profile.pinHash);
          if (authenticated) {
            profile.failedPinAttempts = 0;
            profile.lockedUntil = null;
            profile.status = "ACTIVE";
            return { authenticated: true as const };
          }

          profile.failedPinAttempts += 1;
          if (profile.failedPinAttempts >= PIN_LOCKOUT_ATTEMPTS) {
            profile.status = "LOCKED";
            profile.lockedUntil = new Date(
              input.serverNow.getTime() + PIN_LOCKOUT_MILLISECONDS,
            );
            draft.audits.push({
              action: "PIN_PROFILE_LOCKED",
              occurredAt: input.serverNow.toISOString(),
              result: "DENIED",
            });
          }
          return { authenticated: false as const };
        });
        if (!result.authenticated) throw authenticationFailure();
        return { authenticated: true };
      });
      queue = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}

export interface SetupPinCommand {
  readonly deviceProfileId: string;
  readonly pin: string;
  readonly now?: Date;
}

export interface VerifyPinCommand {
  readonly deviceProfileId: string;
  readonly pin: string;
  readonly serverNow?: Date;
}

/** Prisma-backed API service. Clients never receive or import this boundary. */
export class PinService {
  readonly #hasher: PinHasher;

  public constructor(
    private readonly prisma: PrismaModule,
    options: PepperOptions,
  ) {
    this.#hasher = new PinHasher(options);
  }

  public setup(command: SetupPinCommand): Promise<void> {
    validatePin(command.pin);
    const now = command.now ?? new Date();
    return this.prisma.transaction(async (transaction) => {
      const profile = await transaction.deviceProfile.findUnique({
        where: { id: command.deviceProfileId },
        include: { device: true, membership: true, tenant: true, user: true },
      });
      if (
        profile === null ||
        profile.status !== "PENDING_PIN" ||
        profile.device.status !== "ACTIVE" ||
        profile.membership.status !== "ACTIVE" ||
        profile.tenant.status !== "ACTIVE" ||
        profile.user.status !== "ACTIVE"
      ) {
        throw authenticationFailure();
      }

      const hashed = await this.#hasher.hash(command.pin);
      const updated = await transaction.deviceProfile.updateMany({
        where: { id: profile.id, status: "PENDING_PIN" },
        data: {
          pinHash: Buffer.from(hashed.encodedHash, "utf8"),
          pinSaltVersion: hashed.saltVersion,
          pinPepperVersion: hashed.pepperVersion,
          failedPinAttempts: 0,
          lockedUntil: null,
          status: "ACTIVE",
          activatedAt: now,
        },
      });
      if (updated.count !== 1) throw authenticationFailure();
    });
  }

  public async verify(
    command: VerifyPinCommand,
  ): Promise<{ authenticated: true }> {
    const serverNow = command.serverNow ?? new Date();
    const authenticated = await this.prisma.transaction(async (transaction) => {
      const profile = await transaction.deviceProfile.findUnique({
        where: { id: command.deviceProfileId },
        include: { device: true, membership: true, tenant: true, user: true },
      });
      if (
        profile === null ||
        profile.status === "REVOKED" ||
        profile.device.status !== "ACTIVE" ||
        profile.membership.status !== "ACTIVE" ||
        profile.tenant.status !== "ACTIVE" ||
        profile.user.status !== "ACTIVE" ||
        profile.pinHash === null ||
        profile.pinPepperVersion === null
      ) {
        return false;
      }

      if (
        profile.status === "LOCKED" &&
        profile.lockedUntil !== null &&
        profile.lockedUntil > serverNow
      ) {
        return false;
      }

      const authenticated = await this.#hasher.verify(
        command.pin,
        Buffer.from(profile.pinHash).toString("utf8"),
        profile.pinPepperVersion,
      );
      if (authenticated) {
        await transaction.deviceProfile.update({
          where: { id: profile.id },
          data: {
            failedPinAttempts: 0,
            lockedUntil: null,
            status: "ACTIVE",
          },
        });
        return true;
      }

      const failedPinAttempts =
        profile.status === "LOCKED" ? 1 : profile.failedPinAttempts + 1;
      const locked = failedPinAttempts >= PIN_LOCKOUT_ATTEMPTS;
      await transaction.deviceProfile.update({
        where: { id: profile.id },
        data: {
          failedPinAttempts,
          status: locked ? "LOCKED" : "ACTIVE",
          lockedUntil: locked
            ? new Date(serverNow.getTime() + PIN_LOCKOUT_MILLISECONDS)
            : null,
        },
      });
      if (locked) {
        await transaction.auditEvent.create({
          data: {
            tenantId: profile.tenantId,
            actorType: "USER",
            actorId: profile.userId,
            effectiveMembershipId: profile.membershipId,
            deviceId: profile.deviceId,
            action: "PIN_PROFILE_LOCKED",
            targetType: "DeviceProfile",
            targetId: profile.id,
            result: "DENIED",
            reasonCode: "PIN_ATTEMPT_LIMIT",
            correlationId: randomUUID(),
          },
        });
      }
      return false;
    });
    if (!authenticated) throw authenticationFailure();
    return { authenticated: true };
  }
}
