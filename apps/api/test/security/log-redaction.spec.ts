import { describe, expect, it } from "vitest";
import { redactLogValue } from "../../src/common/logging/redaction.js";

const forbiddenSecrets = {
  pin: "123456",
  manualCode: "87654321",
  qrSecret: "qr-secret-example",
  approvalSecret: "approval-secret-example",
  browserPollingSecret: "polling-secret-example",
  accessToken: "access-token-example",
  refreshToken: "refresh-token-example",
  pepper: "pepper-example",
  hmacKey: "hmac-key-example",
  phone: "+51987654321",
  biometricTemplate: "biometric-template-example",
} as const;

describe("structured log redaction", () => {
  it.each(Object.entries(forbiddenSecrets))("redacts %s", (_name, secret) => {
    const serialized = JSON.stringify(redactLogValue(forbiddenSecrets));
    expect(serialized).not.toContain(secret);
  });
});
