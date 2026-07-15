const e164Pattern = /^\+[1-9][0-9]{7,14}$/u;

export function normalizeE164(value: string): string {
  const normalized = value.replace(/[\s()-]/gu, "");
  if (!e164Pattern.test(normalized)) {
    throw new Error("Phone number must use E.164 format.");
  }
  return normalized;
}

export function isE164(value: string): boolean {
  return e164Pattern.test(value);
}
