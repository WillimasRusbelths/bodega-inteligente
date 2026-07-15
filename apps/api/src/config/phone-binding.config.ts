import { z } from "zod";

const sourceSchema = z.object({
  PHONE_BINDING_HMAC_CURRENT_VERSION: z.string().min(1),
  PHONE_BINDING_HMAC_KEYS_JSON: z.string().min(1),
});

const keysSchema = z.record(z.string().min(1), z.string().min(1));

export interface PhoneBindingConfig {
  readonly currentVersion: string;
  readonly keysByVersion: ReadonlyMap<string, Uint8Array>;
}

function decodeKey(encoded: string, version: string): Uint8Array {
  const key = Buffer.from(encoded, "base64url");
  if (key.byteLength < 32) {
    throw new Error(
      `Phone-binding HMAC key ${version} must contain at least 256 bits.`,
    );
  }
  return Uint8Array.from(key);
}

export function loadPhoneBindingConfig(
  source: NodeJS.ProcessEnv | Record<string, string> | object,
): PhoneBindingConfig {
  const parsedSource = sourceSchema.parse(source);
  let serializedKeys: unknown;

  try {
    serializedKeys = JSON.parse(
      parsedSource.PHONE_BINDING_HMAC_KEYS_JSON,
    ) as unknown;
  } catch {
    throw new Error("PHONE_BINDING_HMAC_KEYS_JSON must be valid JSON.");
  }

  const parsedKeys = keysSchema.parse(serializedKeys);
  const keysByVersion = new Map(
    Object.entries(parsedKeys).map(([version, encoded]) => [
      version,
      decodeKey(encoded, version),
    ]),
  );

  if (!keysByVersion.has(parsedSource.PHONE_BINDING_HMAC_CURRENT_VERSION)) {
    throw new Error(
      "The current phone-binding HMAC key version is unavailable.",
    );
  }

  return Object.freeze({
    currentVersion: parsedSource.PHONE_BINDING_HMAC_CURRENT_VERSION,
    keysByVersion: keysByVersion as ReadonlyMap<string, Uint8Array>,
  });
}
