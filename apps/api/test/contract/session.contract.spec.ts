import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface SessionResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly activeContext: null | {
    readonly tenantId: string;
    readonly membershipId: string;
  };
}

interface SessionRecord {
  id: string;
  userId: string;
  deviceProfileId: string;
  platform: "MOBILE";
  createdAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

interface RefreshRecord {
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
  sessions: SessionRecord[];
  refreshCredentials: RefreshRecord[];
  logs: unknown[];
  audits: unknown[];
}

interface SessionContractHarness {
  login(input: {
    readonly phone: string;
    readonly pin: string;
    readonly deviceCredential: string;
    readonly now?: Date;
  }): Promise<SessionResponse>;
  refresh(input: {
    readonly refreshToken: string;
    readonly now?: Date;
  }): Promise<SessionResponse>;
  logout(input: {
    readonly accessToken: string;
    readonly now?: Date;
  }): Promise<void>;
  authorize(input: {
    readonly accessToken: string;
    readonly now?: Date;
  }): Promise<void>;
}

interface SessionContractModule {
  createSessionContractHarness(options: {
    readonly state: SessionContractState;
    readonly expectedPin: string;
    readonly expectedPhone: string;
    readonly expectedDeviceCredential: string;
  }): SessionContractHarness;
}

const futurePaths = [
  "apps/api/src/modules/auth/services/session.service.ts",
  "apps/api/src/modules/auth/services/token.service.ts",
  "apps/api/src/modules/auth/services/refresh-rotation.service.ts",
  "apps/api/src/modules/auth/auth.controller.ts",
  "apps/api/src/modules/auth/dto",
].map((path) => resolve(process.cwd(), path));

const controllerPath = futurePaths[3];

async function loadModule(): Promise<SessionContractModule> {
  if (
    controllerPath === undefined ||
    futurePaths.some((path) => !existsSync(path))
  ) {
    throw new Error(
      "[T055-T058] SessionService, TokenService, RefreshRotationService, auth controller and DTOs are required by T052.",
    );
  }
  const module = (await import(
    pathToFileURL(controllerPath).href
  )) as Partial<SessionContractModule>;
  if (module.createSessionContractHarness === undefined) {
    throw new Error(
      "[T058] createSessionContractHarness export is required by T052.",
    );
  }
  return { createSessionContractHarness: module.createSessionContractHarness };
}

const now = new Date("2026-01-01T00:00:00.000Z");
const tenantId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000011";
const membershipId = "00000000-0000-4000-8000-000000000101";
const deviceId = "00000000-0000-4000-8000-000000000201";
const profileId = "00000000-0000-4000-8000-000000000301";
const phone = "+51900000011";
const pin = "123456";
const deviceCredential = "synthetic-device-credential-a";

function createState(): SessionContractState {
  return {
    user: { id: userId, status: "ACTIVE", authVersion: 1 },
    tenant: { id: tenantId, status: "ACTIVE" },
    membership: {
      id: membershipId,
      tenantId,
      userId,
      status: "ACTIVE",
    },
    device: { id: deviceId, status: "ACTIVE" },
    profile: {
      id: profileId,
      tenantId,
      userId,
      membershipId,
      deviceId,
      status: "ACTIVE",
    },
    sessions: [],
    refreshCredentials: [],
    logs: [],
    audits: [],
  };
}

async function setup(overrides?: (state: SessionContractState) => void) {
  const state = createState();
  overrides?.(state);
  const harness = (await loadModule()).createSessionContractHarness({
    state,
    expectedPin: pin,
    expectedPhone: phone,
    expectedDeviceCredential: deviceCredential,
  });
  return { state, harness };
}

function login(harness: SessionContractHarness): Promise<SessionResponse> {
  return harness.login({ phone, pin, deviceCredential, now });
}

async function expectSafeAuthenticationFailure(
  promise: Promise<unknown>,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code: "AUTHENTICATION_FAILED",
  });
}

describe("mobile session OpenAPI contract [T052; HU-002; FR-005, FR-035]", () => {
  it("declares login, refresh and logout operations with approved responses", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "specs/001-multi-tenant-access/contracts/openapi.yaml",
      ),
      "utf8",
    );
    for (const operation of [
      "operationId: unlockWithPin",
      "operationId: rotateRefreshToken",
      "operationId: logoutCurrentSession",
      "SessionCreationResponse:",
      "RefreshRotationResponse:",
    ]) {
      expect(openapi).toContain(operation);
    }
  });

  it("logs in with the correct PIN and device credential", async () => {
    const response = await login((await setup()).harness);
    expect(response.accessToken).toBeTypeOf("string");
    expect(response.refreshToken).toBeTypeOf("string");
  });

  it("rejects an incorrect PIN with the uniform authentication error", async () => {
    const { harness } = await setup();
    await expectSafeAuthenticationFailure(
      harness.login({ phone, pin: "000000", deviceCredential, now }),
    );
  });

  it.each([
    (state: SessionContractState) => {
      state.profile.status = "REVOKED";
    },
    (state: SessionContractState) => {
      state.profile.userId = "00000000-0000-4000-8000-000000000099";
    },
    (state: SessionContractState) => {
      state.profile.membershipId = "00000000-0000-4000-8000-000000000199";
    },
    (state: SessionContractState) => {
      state.profile.tenantId = "00000000-0000-4000-8000-000000000002";
    },
  ])("rejects an inactive or incoherent DeviceProfile %#", async (mutate) => {
    await expectSafeAuthenticationFailure(login((await setup(mutate)).harness));
  });

  it("creates a server-side MOBILE Session", async () => {
    const { state, harness } = await setup();
    await login(harness);
    expect(state.sessions).toEqual([
      expect.objectContaining({
        userId,
        deviceProfileId: profileId,
        platform: "MOBILE",
        revokedAt: null,
      }),
    ]);
  });

  it("limits the access token to ten minutes", async () => {
    const response = await login((await setup()).harness);
    expect(new Date(response.accessExpiresAt).getTime()).toBe(
      now.getTime() + 10 * 60 * 1_000,
    );
  });

  it("issues an opaque refresh token only in the authorized response", async () => {
    const { state, harness } = await setup();
    const response = await login(harness);
    expect(response.refreshToken).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
    expect(response.refreshToken).not.toContain(".");
    expect(JSON.stringify(state)).not.toContain(response.refreshToken);
    expect(state.refreshCredentials[0]?.tokenHash).toBeTypeOf("string");
  });

  it("sets an immutable absolute session expiry of eight hours", async () => {
    const response = await login((await setup()).harness);
    expect(new Date(response.absoluteExpiresAt).getTime()).toBe(
      now.getTime() + 8 * 60 * 60 * 1_000,
    );
  });

  it("rotates refresh and returns new access and refresh tokens", async () => {
    const { harness } = await setup();
    const first = await login(harness);
    const rotated = await harness.refresh({
      refreshToken: first.refreshToken,
      now: new Date(now.getTime() + 60_000),
    });
    expect(rotated.accessToken).not.toBe(first.accessToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
  });

  it("does not extend the eight-hour absolute expiry during rotation", async () => {
    const { harness } = await setup();
    const first = await login(harness);
    const rotated = await harness.refresh({
      refreshToken: first.refreshToken,
      now: new Date(now.getTime() + 60 * 60 * 1_000),
    });
    expect(rotated.absoluteExpiresAt).toBe(first.absoluteExpiresAt);
  });

  it("invalidates the previous refresh token after rotation", async () => {
    const { harness } = await setup();
    const first = await login(harness);
    await harness.refresh({ refreshToken: first.refreshToken, now });
    await expectSafeAuthenticationFailure(
      harness.refresh({ refreshToken: first.refreshToken, now }),
    );
  });

  it("logout revokes the Session and its refresh family", async () => {
    const { state, harness } = await setup();
    const response = await login(harness);
    await harness.logout({ accessToken: response.accessToken, now });
    expect(state.sessions[0]?.revokedAt).toEqual(now);
    expect(
      state.refreshCredentials.every(({ revokedAt }) => revokedAt !== null),
    ).toBe(true);
  });

  it("accepts neither access nor refresh tokens after logout", async () => {
    const { harness } = await setup();
    const response = await login(harness);
    await harness.logout({ accessToken: response.accessToken, now });
    await expect(
      harness.authorize({ accessToken: response.accessToken, now }),
    ).rejects.toBeDefined();
    await expectSafeAuthenticationFailure(
      harness.refresh({ refreshToken: response.refreshToken, now }),
    );
  });

  it("never returns hashes, PIN, pepper or internal secret metadata", async () => {
    const response = await login((await setup()).harness);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain(pin);
    expect(serialized).not.toMatch(/hash|pepper|familyId|sessionId/iu);
  });
});
