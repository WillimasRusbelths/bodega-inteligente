import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeE164 } from "../../../common/validation/e164.js";

export interface PhoneBinding {
  readonly phoneBindingHmac: string;
  readonly phoneBindingKeyVersion: string;
}

export interface PhoneBindingServiceOptions {
  readonly currentVersion: string;
  readonly keys: ReadonlyMap<string, Uint8Array>;
  readonly compare?: (left: Uint8Array, right: Uint8Array) => boolean;
}

export interface PhoneBindingService {
  normalize(phone: string): string;
  bind(phone: string): PhoneBinding;
  verify(phone: string, binding: PhoneBinding): boolean;
}

function defaultConstantTimeCompare(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

function calculate(phone: string, key: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    createHmac("sha256", key).update(normalizeE164(phone), "utf8").digest(),
  );
}

export function createPhoneBindingService(
  options: PhoneBindingServiceOptions,
): PhoneBindingService {
  const currentKey = options.keys.get(options.currentVersion);
  if (currentKey === undefined) {
    throw new Error("The current phone-binding key version is unavailable.");
  }
  const compare = options.compare ?? defaultConstantTimeCompare;

  return Object.freeze({
    normalize: normalizeE164,
    bind(phone: string): PhoneBinding {
      return {
        phoneBindingHmac: Buffer.from(calculate(phone, currentKey)).toString(
          "base64url",
        ),
        phoneBindingKeyVersion: options.currentVersion,
      };
    },
    verify(phone: string, binding: PhoneBinding): boolean {
      const key = options.keys.get(binding.phoneBindingKeyVersion);
      if (key === undefined) return false;
      try {
        const expected = calculate(phone, key);
        const supplied = Uint8Array.from(
          Buffer.from(binding.phoneBindingHmac, "base64url"),
        );
        return compare(expected, supplied);
      } catch {
        return false;
      }
    },
  });
}
