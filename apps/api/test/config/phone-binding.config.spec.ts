import { describe, expect, it } from "vitest";
import { loadPhoneBindingConfig } from "../../src/config/phone-binding.config.js";

const keyV1 = Buffer.alloc(32, 1).toString("base64url");
const keyV2 = Buffer.alloc(32, 2).toString("base64url");

describe("phone binding configuration", () => {
  it("loads an external current key and its explicit version", () => {
    const config = loadPhoneBindingConfig({
      PHONE_BINDING_HMAC_CURRENT_VERSION: "v2",
      PHONE_BINDING_HMAC_KEYS_JSON: JSON.stringify({ v1: keyV1, v2: keyV2 }),
    });

    expect(config.currentVersion).toBe("v2");
    expect(config.keysByVersion.get("v2")).toHaveLength(32);
  });

  it.each([
    {},
    { PHONE_BINDING_HMAC_CURRENT_VERSION: "v1" },
    { PHONE_BINDING_HMAC_KEYS_JSON: JSON.stringify({ v1: keyV1 }) },
  ])("fails fast when key configuration is absent: %o", (source) => {
    expect(() => loadPhoneBindingConfig(source)).toThrow();
  });

  it("fails closed when the current version has no key", () => {
    expect(() =>
      loadPhoneBindingConfig({
        PHONE_BINDING_HMAC_CURRENT_VERSION: "v2",
        PHONE_BINDING_HMAC_KEYS_JSON: JSON.stringify({ v1: keyV1 }),
      }),
    ).toThrow();
  });

  it("rejects short HMAC keys", () => {
    expect(() =>
      loadPhoneBindingConfig({
        PHONE_BINDING_HMAC_CURRENT_VERSION: "v1",
        PHONE_BINDING_HMAC_KEYS_JSON: JSON.stringify({ v1: "c2hvcnQ" }),
      }),
    ).toThrow();
  });

  it("exposes no serializable key material", () => {
    const config = loadPhoneBindingConfig({
      PHONE_BINDING_HMAC_CURRENT_VERSION: "v1",
      PHONE_BINDING_HMAC_KEYS_JSON: JSON.stringify({ v1: keyV1 }),
    });

    expect(JSON.stringify(config)).not.toContain(keyV1);
  });
});
