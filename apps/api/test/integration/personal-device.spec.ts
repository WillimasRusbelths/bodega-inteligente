import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface DeviceRecord {
  id: string;
  type: "PERSONAL";
  status: "ACTIVE" | "REVOKED";
  revokedAt?: Date;
}

interface ProfileRecord {
  id: string;
  deviceId: string;
  tenantId: string;
  userId: string;
  membershipId: string;
  status: "PENDING_PIN" | "ACTIVE" | "REVOKED";
  pinHash?: string;
  credentialHash: string;
  biometricTemplate?: unknown;
}

interface DeviceState {
  devices: DeviceRecord[];
  profiles: ProfileRecord[];
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

interface DeviceService {
  createProfile(
    input: Omit<ProfileRecord, "id" | "status">,
  ): Promise<ProfileRecord>;
  canAccess(profileId: string): boolean;
  revokeProfile(profileId: string, now: Date): Promise<void>;
  revokeDevice(deviceId: string, now: Date): Promise<void>;
  recover(profileId: string): Promise<unknown>;
}

interface DeviceModule {
  createPersonalDeviceService(state: DeviceState): DeviceService;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/devices/services/device.service.ts",
);
const controllerPath = resolve(
  process.cwd(),
  "apps/api/src/modules/devices/devices.controller.ts",
);

async function loadService(state: DeviceState): Promise<DeviceService> {
  if (!existsSync(servicePath) || !existsSync(controllerPath)) {
    throw new Error(
      "[T045] personal Device service and controller are required by T043.",
    );
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<DeviceModule>;
  if (module.createPersonalDeviceService === undefined) {
    throw new Error(
      "[T045] createPersonalDeviceService export is required by T043.",
    );
  }
  return module.createPersonalDeviceService(state);
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const membershipA = "00000000-0000-4000-8000-000000000101";
const membershipB = "00000000-0000-4000-8000-000000000102";

function state(): DeviceState {
  return {
    devices: [{ id: "device-a", type: "PERSONAL", status: "ACTIVE" }],
    profiles: [],
    memberships: [
      { id: membershipA, tenantId: tenantA, status: "ACTIVE" },
      { id: membershipB, tenantId: tenantB, status: "ACTIVE" },
    ],
    sessions: [],
    history: [],
  };
}

const profileInput = {
  deviceId: "device-a",
  tenantId: tenantA,
  userId: "user-a",
  membershipId: membershipA,
  credentialHash: "credential-hash-a",
};

describe("personal Device lifecycle [T043; HU-002; FR-037..FR-039]", () => {
  it("supports only PERSONAL Device in the MVP", async () => {
    const store = state();
    await (await loadService(store)).createProfile(profileInput);
    expect(store.devices.every(({ type }) => type === "PERSONAL")).toBe(true);
    expect(JSON.stringify(store)).not.toContain("TENANT_SHARED");
  });

  it("allows only one active profile per personal Device", async () => {
    const store = state();
    const service = await loadService(store);
    await service.createProfile(profileInput);
    await expect(
      service.createProfile({ ...profileInput, userId: "user-b" }),
    ).rejects.toBeDefined();
    expect(store.profiles).toHaveLength(1);
  });

  it("binds DeviceProfile to the correct User, Membership and Tenant", async () => {
    const store = state();
    const profile = await (
      await loadService(store)
    ).createProfile(profileInput);
    expect(profile).toMatchObject(profileInput);
  });

  it("rejects a Tenant A DeviceProfile pointing to Membership B", async () => {
    const store = state();
    await expect(
      (await loadService(store)).createProfile({
        ...profileInput,
        membershipId: membershipB,
      }),
    ).rejects.toBeDefined();
    expect(store.profiles).toHaveLength(0);
  });

  it("prevents access after DeviceProfile revocation", async () => {
    const store = state();
    const service = await loadService(store);
    const profile = await service.createProfile(profileInput);
    await service.revokeProfile(profile.id, new Date());
    expect(service.canAccess(profile.id)).toBe(false);
  });

  it("revoking Device revokes profiles and their existing sessions", async () => {
    const store = state();
    const service = await loadService(store);
    const profile = await service.createProfile(profileInput);
    store.sessions.push({
      id: "session-a",
      deviceProfileId: profile.id,
      revokedAt: null,
    });
    const now = new Date("2026-01-01T00:00:00.000Z");
    await service.revokeDevice("device-a", now);
    expect(store.devices[0]?.status).toBe("REVOKED");
    expect(store.profiles[0]?.status).toBe("REVOKED");
    expect(store.sessions[0]?.revokedAt).toEqual(now);
  });

  it("invalidates a profile when Membership becomes disabled", async () => {
    const store = state();
    const service = await loadService(store);
    const profile = await service.createProfile(profileInput);
    const membership = store.memberships.find(({ id }) => id === membershipA);
    if (membership !== undefined) membership.status = "DISABLED";
    expect(service.canAccess(profile.id)).toBe(false);
  });

  it("requires a new approved in-person activation for recovery", async () => {
    const store = state();
    const service = await loadService(store);
    const profile = await service.createProfile({
      ...profileInput,
      pinHash: "old-pin-hash",
    });
    await service.revokeProfile(profile.id, new Date());
    await expect(service.recover(profile.id)).rejects.toMatchObject({
      code: "ACTIVATION_REQUIRED",
    });
    expect(store.profiles).toHaveLength(1);
    expect(store.profiles[0]?.pinHash).toBe("old-pin-hash");
  });

  it("never reuses old PIN, challenge or device credentials", async () => {
    const store = state();
    const service = await loadService(store);
    const profile = await service.createProfile({
      ...profileInput,
      pinHash: "old-pin-hash",
    });
    await service.revokeProfile(profile.id, new Date());
    const serialized = JSON.stringify(store.history);
    expect(serialized).not.toContain("old-pin-hash");
    expect(serialized).not.toContain("credential-hash-a");
  });

  it("stores no biometric templates and preserves revoked history", async () => {
    const store = state();
    const service = await loadService(store);
    const profile = await service.createProfile(profileInput);
    await service.revokeDevice("device-a", new Date());
    expect(JSON.stringify(store)).not.toContain("biometricTemplate");
    expect(store.devices).toContainEqual(
      expect.objectContaining({ id: "device-a" }),
    );
    expect(store.profiles).toContainEqual(
      expect.objectContaining({ id: profile.id }),
    );
    expect(store.history.length).toBeGreaterThan(0);
  });
});
