import { randomUUID } from "node:crypto";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

interface MemoryDevice {
  id: string;
  type: "PERSONAL";
  status: "ACTIVE" | "REVOKED";
  revokedAt?: Date;
}

interface MemoryProfile {
  id: string;
  deviceId: string;
  tenantId: string;
  userId: string;
  membershipId: string;
  status: "PENDING_PIN" | "ACTIVE" | "REVOKED";
  pinHash?: string;
  credentialHash: string;
}

interface MemoryDeviceState {
  devices: MemoryDevice[];
  profiles: MemoryProfile[];
  memberships: Array<{
    id: string;
    tenantId: string;
    status: "ACTIVE" | "DISABLED";
  }>;
  sessions: Array<{
    id: string;
    deviceProfileId: string;
    revokedAt: Date | null;
  }>;
  history: Array<Record<string, unknown>>;
}

interface MemoryProfileInput {
  readonly deviceId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly pinHash?: string;
  readonly credentialHash: string;
  readonly biometricTemplate?: unknown;
}

class ActivationRequiredError extends Error {
  public readonly code = "ACTIVATION_REQUIRED" as const;

  public constructor() {
    super("A new in-person activation is required.");
    this.name = "ActivationRequiredError";
  }
}

function profileIsLive(profile: MemoryProfile): boolean {
  return profile.status === "PENDING_PIN" || profile.status === "ACTIVE";
}

/** In-memory boundary used by the lifecycle suite; it mirrors persisted rules. */
export function createPersonalDeviceService(state: MemoryDeviceState): {
  createProfile(input: MemoryProfileInput): Promise<MemoryProfile>;
  canAccess(profileId: string): boolean;
  revokeProfile(profileId: string, now: Date): Promise<void>;
  revokeDevice(deviceId: string, now: Date): Promise<void>;
  recover(profileId: string): Promise<never>;
} {
  const revokeSessions = (profileIds: ReadonlySet<string>, now: Date): void => {
    for (const session of state.sessions) {
      if (
        profileIds.has(session.deviceProfileId) &&
        session.revokedAt === null
      ) {
        session.revokedAt = now;
      }
    }
  };

  return {
    async createProfile(input) {
      await Promise.resolve();
      const device = state.devices.find(({ id }) => id === input.deviceId);
      const membership = state.memberships.find(
        ({ id }) => id === input.membershipId,
      );
      if (
        device === undefined ||
        device.type !== "PERSONAL" ||
        device.status !== "ACTIVE" ||
        membership === undefined ||
        membership.status !== "ACTIVE" ||
        membership.tenantId !== input.tenantId ||
        input.biometricTemplate !== undefined ||
        state.profiles.some(
          (profile) =>
            profile.deviceId === input.deviceId && profileIsLive(profile),
        )
      ) {
        throw new Error("The operation could not be completed.");
      }

      const profile: MemoryProfile = {
        id: randomUUID(),
        deviceId: input.deviceId,
        tenantId: input.tenantId,
        userId: input.userId,
        membershipId: input.membershipId,
        status: "PENDING_PIN",
        credentialHash: input.credentialHash,
        ...(input.pinHash === undefined ? {} : { pinHash: input.pinHash }),
      };
      state.profiles.push(profile);
      state.history.push({
        action: "DEVICE_PROFILE_CREATED",
        deviceId: input.deviceId,
        profileId: profile.id,
        tenantId: input.tenantId,
      });
      return profile;
    },
    canAccess(profileId) {
      const profile = state.profiles.find(({ id }) => id === profileId);
      if (profile === undefined || profile.status !== "ACTIVE") return false;
      const device = state.devices.find(({ id }) => id === profile.deviceId);
      const membership = state.memberships.find(
        ({ id }) => id === profile.membershipId,
      );
      return (
        device?.status === "ACTIVE" &&
        membership?.status === "ACTIVE" &&
        membership.tenantId === profile.tenantId
      );
    },
    async revokeProfile(profileId, now) {
      await Promise.resolve();
      const profile = state.profiles.find(({ id }) => id === profileId);
      if (profile === undefined) {
        throw new Error("The requested resource is not available.");
      }
      profile.status = "REVOKED";
      revokeSessions(new Set([profile.id]), now);
      state.history.push({
        action: "DEVICE_PROFILE_REVOKED",
        profileId: profile.id,
        occurredAt: now.toISOString(),
      });
    },
    async revokeDevice(deviceId, now) {
      await Promise.resolve();
      const device = state.devices.find(({ id }) => id === deviceId);
      if (device === undefined) {
        throw new Error("The requested resource is not available.");
      }
      device.status = "REVOKED";
      device.revokedAt = now;
      const profileIds = new Set(
        state.profiles
          .filter((profile) => profile.deviceId === deviceId)
          .map((profile) => {
            profile.status = "REVOKED";
            return profile.id;
          }),
      );
      revokeSessions(profileIds, now);
      state.history.push({
        action: "DEVICE_REVOKED",
        deviceId,
        profileIds: [...profileIds],
        occurredAt: now.toISOString(),
      });
    },
    async recover(profileId) {
      void profileId;
      await Promise.resolve();
      throw new ActivationRequiredError();
    },
  };
}

export interface DeviceActorContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly permissions: readonly string[];
}

export interface DeviceProfileSummary {
  readonly id: string;
  readonly deviceId: string;
  readonly type: "PERSONAL";
  readonly platform: "ANDROID" | "IOS";
  readonly status: "PENDING_PIN" | "ACTIVE" | "LOCKED" | "REVOKED";
  readonly biometricEnabled: false;
  readonly lastSeenAt: Date | null;
}

export class DeviceService {
  public constructor(private readonly prisma: PrismaModule) {}

  public listVisible(
    actor: DeviceActorContext,
    membershipId?: string,
  ): Promise<readonly DeviceProfileSummary[]> {
    return this.prisma.execute(async (client) => {
      const profiles = await client.deviceProfile.findMany({
        where: {
          tenantId: actor.tenantId,
          ...(membershipId === undefined
            ? { userId: actor.userId }
            : { membershipId }),
          membership: { status: "ACTIVE" },
        },
        include: { device: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return profiles.map((profile) => ({
        id: profile.id,
        deviceId: profile.deviceId,
        type: profile.device.type,
        platform: profile.device.platform,
        status: profile.status,
        biometricEnabled: false as const,
        lastSeenAt: profile.device.lastSeenAt,
      }));
    });
  }

  public revokeProfile(options: {
    readonly actor: DeviceActorContext;
    readonly deviceProfileId: string;
    readonly membershipId?: string;
    readonly reason: string;
    readonly now?: Date;
  }): Promise<void> {
    const now = options.now ?? new Date();
    return this.prisma.transaction(async (transaction) => {
      const profile = await transaction.deviceProfile.findFirst({
        where: {
          id: options.deviceProfileId,
          tenantId: options.actor.tenantId,
          ...(options.membershipId === undefined
            ? { userId: options.actor.userId }
            : { membershipId: options.membershipId }),
        },
        select: { id: true },
      });
      if (profile === null) {
        throw new Error("The requested resource is not available.");
      }
      await transaction.deviceProfile.update({
        where: { id: profile.id },
        data: { status: "REVOKED", revokedAt: now },
      });
      await transaction.session.updateMany({
        where: { deviceProfileId: profile.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: options.reason },
      });
    });
  }

  public revokeDevice(options: {
    readonly actor: DeviceActorContext;
    readonly deviceId: string;
    readonly reason: string;
    readonly now?: Date;
  }): Promise<void> {
    const now = options.now ?? new Date();
    return this.prisma.transaction(async (transaction) => {
      const device = await transaction.device.findFirst({
        where: {
          id: options.deviceId,
          type: "PERSONAL",
          profiles: {
            some: {
              tenantId: options.actor.tenantId,
              userId: options.actor.userId,
            },
          },
        },
        select: { id: true, profiles: { select: { id: true } } },
      });
      if (device === null) {
        throw new Error("The requested resource is not available.");
      }
      await transaction.device.update({
        where: { id: device.id },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokedByMembershipId: options.actor.membershipId,
          revokeReason: options.reason,
        },
      });
      const profileIds = device.profiles.map(({ id }) => id);
      await transaction.deviceProfile.updateMany({
        where: { id: { in: profileIds } },
        data: { status: "REVOKED", revokedAt: now },
      });
      await transaction.session.updateMany({
        where: { deviceProfileId: { in: profileIds }, revokedAt: null },
        data: { revokedAt: now, revokeReason: options.reason },
      });
    });
  }
}
