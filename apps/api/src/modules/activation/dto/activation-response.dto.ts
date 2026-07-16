function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function serializeMembership(value: unknown): unknown {
  const source = record(value);
  return {
    id: source["id"],
    tenantId: source["tenantId"],
    userId: source["userId"],
    displayName: source["displayName"],
    status: source["status"],
    roles: source["roles"],
    version: source["version"],
  };
}

export function serializeActivationIssue(value: unknown): unknown {
  const source = record(value);
  return {
    challengeId: source["challengeId"],
    qrSecret: source["qrSecret"],
    qrPayload: source["qrPayload"],
    manualCode: source["manualCode"],
    expiresAt: source["expiresAt"],
    maxAttempts: source["maxAttempts"],
  };
}

export function serializeActivationConsume(value: unknown): unknown {
  const source = record(value);
  return {
    deviceProfileId: source["deviceProfileId"],
    pinSetupToken: source["pinSetupToken"],
    expiresAt: source["expiresAt"],
  };
}
