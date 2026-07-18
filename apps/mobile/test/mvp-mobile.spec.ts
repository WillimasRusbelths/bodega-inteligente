import { describe, expect, it, vi } from "vitest";
import { ActivationFlow } from "../src/features/activation/activation-flow.js";
import {
  LOCAL_INACTIVITY_LIMIT_MS,
  MobileSessionManager,
} from "../src/features/auth/session-manager.js";
import { TenantSelector } from "../src/features/tenant/tenant-selector.js";
import {
  SecureSessionStore,
  type SecureStoreBridge,
} from "../src/security/secure-store.js";

function secureStore() {
  const values = new Map<string, string>();
  const bridge: SecureStoreBridge = {
    getItemAsync(key) {
      return Promise.resolve(values.get(key) ?? null);
    },
    setItemAsync(key, value) {
      values.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync(key) {
      values.delete(key);
      return Promise.resolve();
    },
  };
  return { values, store: new SecureSessionStore(bridge) };
}

const expiry = "2026-07-17T18:00:00.000Z";

describe("mobile MVP access [T107-T110]", () => {
  it("rejects TENANT_SHARED activation without calling the API", async () => {
    const activate = vi.fn();
    const flow = new ActivationFlow({ activate, setupPin: vi.fn() });
    flow.scanQr("opaque-qr-secret-with-128-bits", expiry);
    await flow.consume({
      phone: "+51987654321",
      idempotencyKey: "synthetic-idempotency-key",
      device: {
        installationId: "00000000-0000-4000-8000-000000000701",
        platform: "ANDROID",
        appVersion: "0.0.0-test",
        deviceCredential: "synthetic-device-proof",
        type: "TENANT_SHARED",
      },
    });
    expect(activate).not.toHaveBeenCalled();
    expect(flow.state).toMatchObject({ status: "ERROR" });
  });

  it("accepts exactly eight manual digits and clears them after the attempt", async () => {
    const flow = new ActivationFlow({
      activate() {
        return Promise.resolve({
          deviceProfileId: "00000000-0000-4000-8000-000000000702",
          pinSetupToken: "one-time-pin-setup",
          expiresAt: expiry,
        });
      },
      setupPin: vi.fn(),
    });
    expect(() => flow.enterManualCode("1234567", expiry)).toThrow();
    flow.enterManualCode("12345678", expiry);
    await flow.consume({
      phone: "+51987654321",
      idempotencyKey: "synthetic-idempotency-key",
      device: {
        installationId: "00000000-0000-4000-8000-000000000701",
        platform: "ANDROID",
        appVersion: "0.0.0-test",
        deviceCredential: "synthetic-device-proof",
      },
    });
    await expect(
      flow.consume({
        phone: "+51987654321",
        idempotencyKey: "second-key",
        device: {},
      }),
    ).rejects.toThrow("credential");
  });

  it("stores session credentials only behind the SecureStore bridge", async () => {
    const { values, store } = secureStore();
    await store.replace({
      accessToken: "synthetic-access",
      refreshToken: "synthetic-refresh",
      absoluteExpiresAt: expiry,
      activeContext: null,
    });
    expect([...values.values()]).toContain("synthetic-refresh");
    expect(await store.load()).toMatchObject({
      refreshToken: "synthetic-refresh",
    });
  });

  it("removes every local credential even when remote logout fails", async () => {
    const { values, store } = secureStore();
    await store.replace({
      accessToken: "synthetic-access",
      refreshToken: "synthetic-refresh",
      absoluteExpiresAt: expiry,
      activeContext: null,
    });
    const sessions = new MobileSessionManager(
      {
        unlockWithPin: vi.fn(),
        rotateRefreshToken: vi.fn(),
        logout() {
          return Promise.reject(new Error("synthetic network failure"));
        },
      },
      store,
    );
    await expect(sessions.logout()).rejects.toThrow();
    expect(values.size).toBe(0);
    expect(sessions.state).toEqual({ status: "SIGNED_OUT" });
  });

  it("applies a local UI lock after thirty minutes without treating it as server authority", async () => {
    const { store } = secureStore();
    const sessions = new MobileSessionManager(
      {
        unlockWithPin() {
          return Promise.resolve({
            accessToken: "synthetic-access",
            refreshToken: "synthetic-refresh",
            absoluteExpiresAt: expiry,
            activeContext: null,
          });
        },
        rotateRefreshToken: vi.fn(),
        logout: vi.fn(),
      },
      store,
    );
    await sessions.unlockWithPin({
      phone: "+51987654321",
      pin: "123456",
      deviceCredential: "synthetic-device-proof",
    });
    sessions.recordActivity(1_000);
    expect(
      sessions.applyLocalInactivityLock(1_000 + LOCAL_INACTIVITY_LIMIT_MS),
    ).toBe(true);
    expect(sessions.state).toMatchObject({ status: "LOCAL_LOCKED" });
  });

  it("replaces access, roles and permissions while preserving refresh family", async () => {
    const { store } = secureStore();
    await store.replace({
      accessToken: "old-access",
      refreshToken: "same-refresh-family",
      absoluteExpiresAt: expiry,
      activeContext: {
        membershipId: "membership-a",
        tenantId: "tenant-a",
        tenantName: "Bodega A",
        roles: ["owner_admin"],
      },
    });
    const selector = new TenantSelector(
      {
        listActiveMemberships: vi.fn(),
        selectActiveTenant() {
          return Promise.resolve({
            accessToken: "new-access",
            tokenType: "Bearer",
            expiresInSeconds: 600,
            sessionExpiresAt: expiry,
            activeTenant: {
              membershipId: "membership-b",
              tenantId: "tenant-b",
              tenantName: "Bodega B",
              roles: ["seller"],
              capabilities: ["sales.create"],
            },
            contextVersion: 2,
          });
        },
      },
      store,
    );
    await selector.select("membership-b");
    expect(selector.state).toMatchObject({
      status: "ACTIVE",
      roles: ["seller"],
      permissions: ["sales.create"],
    });
    expect(JSON.stringify(selector.state)).not.toContain("owner_admin");
    expect(await store.load()).toMatchObject({
      accessToken: "new-access",
      refreshToken: "same-refresh-family",
    });
  });
});
