import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface ActivationState {
  devices: Array<{ type: string }>;
  profiles: Array<{ status: string }>;
}

interface ActivationContract {
  validateCreateMembership(body: unknown): unknown;
  validateIssue(body: unknown): unknown;
  validateConsume(body: unknown): unknown;
  dispatchConsume(body: unknown, state: ActivationState): Promise<unknown>;
  serializeMembership(value: unknown): unknown;
  serializeIssue(value: unknown): unknown;
  serializeConsume(value: unknown): unknown;
}

const controllerPath = resolve(
  process.cwd(),
  "apps/api/src/modules/activation/activation.controller.ts",
);

async function loadContract(): Promise<ActivationContract> {
  if (!existsSync(controllerPath)) {
    throw new Error(
      "[T036-T040] activation controller, DTOs and services are required for this contract suite.",
    );
  }
  const module = (await import(pathToFileURL(controllerPath).href)) as {
    activationContract?: ActivationContract;
  };
  if (module.activationContract === undefined) {
    throw new Error("[T040] activationContract export is required by T031.");
  }
  return module.activationContract;
}

const personalDevice = {
  installationId: "synthetic-installation-a",
  platform: "ANDROID",
  appVersion: "0.0.0-test",
  deviceCredential: "synthetic-device-credential",
};

describe("activation OpenAPI contract [T031; HU-004; FR-015, FR-031, FR-037, FR-039]", () => {
  it("declares membership, challenge and activation operations", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "specs/001-multi-tenant-access/contracts/openapi.yaml",
      ),
      "utf8",
    );
    for (const operation of [
      "operationId: createMembership",
      "operationId: issueActivationChallenge",
      "operationId: activateDeviceProfile",
    ]) {
      expect(openapi).toContain(operation);
    }
    expect(openapi).toContain("#/components/schemas/ActivateRequest");
  });

  it("accepts a pending membership request with approved initial roles", async () => {
    const contract = await loadContract();
    expect(() =>
      contract.validateCreateMembership({
        displayName: "Synthetic Worker",
        phone: "+51900000011",
        roles: ["seller"],
      }),
    ).not.toThrow();
    expect(
      contract.serializeMembership({
        id: "00000000-0000-4000-8000-000000000100",
        tenantId: "00000000-0000-4000-8000-000000000001",
        userId: "00000000-0000-4000-8000-000000000011",
        displayName: "Synthetic Worker",
        status: "PENDING_ACTIVATION",
        roles: ["seller"],
        version: 1,
      }),
    ).toMatchObject({ status: "PENDING_ACTIVATION" });
  });

  it("accepts an initial activation challenge request", async () => {
    const contract = await loadContract();
    expect(() =>
      contract.validateIssue({ purpose: "INITIAL_ACTIVATION" }),
    ).not.toThrow();
  });

  it.each([
    {
      credential: { type: "QR_SECRET", qrSecret: "opaque-qr-secret-128-bits" },
    },
    { credential: { type: "MANUAL_CODE", manualCode: "12345678" } },
  ])(
    "accepts QR and manual activation credentials %#",
    async ({ credential }) => {
      const contract = await loadContract();
      expect(() =>
        contract.validateConsume({
          phone: "+51900000011",
          credential,
          device: personalDevice,
        }),
      ).not.toThrow();
    },
  );

  it("creates PERSONAL Device and PENDING_PIN DeviceProfile authoritatively", async () => {
    const contract = await loadContract();
    const state: ActivationState = { devices: [], profiles: [] };
    await contract.dispatchConsume(
      {
        phone: "+51900000011",
        credential: { type: "MANUAL_CODE", manualCode: "12345678" },
        device: personalDevice,
      },
      state,
    );
    expect(state.devices).toEqual([{ type: "PERSONAL" }]);
    expect(state.profiles).toEqual([{ status: "PENDING_PIN" }]);
  });

  it.each(["PERSONAL", "TENANT_SHARED"])(
    "rejects client-supplied device type %s without writes",
    async (type) => {
      const contract = await loadContract();
      const state: ActivationState = { devices: [], profiles: [] };
      await expect(
        contract.dispatchConsume(
          {
            phone: "+51900000011",
            credential: { type: "MANUAL_CODE", manualCode: "12345678" },
            device: { ...personalDevice, type },
          },
          state,
        ),
      ).rejects.toBeDefined();
      expect(state).toEqual({ devices: [], profiles: [] });
    },
  );

  it("serializes raw issue credentials only in the initial authorized response", async () => {
    const response = (await loadContract()).serializeIssue({
      challengeId: "00000000-0000-4000-8000-000000000101",
      qrSecret: "one-time-qr-secret",
      qrPayload: "one-time-qr-payload",
      manualCode: "12345678",
      expiresAt: "2026-01-01T00:15:00.000Z",
      maxAttempts: 5,
      qrSecretHash: "hash-only-server-field",
      codeHash: "hash-only-server-field",
    });
    const serialized = JSON.stringify(response);
    expect(serialized).toContain("one-time-qr-secret");
    expect(serialized).toContain("12345678");
    expect(serialized).not.toContain("qrSecretHash");
    expect(serialized).not.toContain("codeHash");
  });

  it("does not return activation credentials after consumption", async () => {
    const serialized = JSON.stringify(
      (await loadContract()).serializeConsume({
        deviceProfileId: "00000000-0000-4000-8000-000000000102",
        pinSetupToken: "one-time-pin-setup",
        expiresAt: "2026-01-01T00:20:00.000Z",
        qrSecret: "forbidden-qr",
        manualCode: "87654321",
      }),
    );
    expect(serialized).not.toContain("forbidden-qr");
    expect(serialized).not.toContain("87654321");
  });
});
