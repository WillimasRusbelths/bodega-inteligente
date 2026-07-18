export const REDACTED_VALUE = "[REDACTED]" as const;

const sensitiveKeys = new Set([
  "pin",
  "manualcode",
  "qrsecret",
  "approvalsecret",
  "browserpollingsecret",
  "accesstoken",
  "refreshtoken",
  "pepper",
  "hmackey",
  "phone",
  "telefono",
  "telephone",
  "biometrictemplate",
  "biometricdata",
  "biometrics",
]);

const e164Pattern = /(?<!\d)\+[1-9]\d{7,14}(?!\d)/gu;
const labelledSecretPattern =
  /\b(pin|manual[\s_-]*code|qr[\s_-]*secret|approval[\s_-]*secret|browser[\s_-]*polling[\s_-]*secret|access[\s_-]*token|refresh[\s_-]*token|pepper|hmac[\s_-]*key|biometric(?:[\s_-]*(?:template|data))?)\b\s*[:=]?\s*[^\s,;]+/giu;

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]/giu, "")
    .toLowerCase();
}

export function isSensitiveLogKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return sensitiveKeys.has(normalized) || normalized.startsWith("biometric");
}

export function redactLogText(value: string): string {
  return value
    .replace(labelledSecretPattern, REDACTED_VALUE)
    .replace(e164Pattern, REDACTED_VALUE);
}

function redactValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (typeof value === "string") return redactLogText(value);
  if (value === null || typeof value !== "object") return value;

  if (ancestors.has(value)) return "[CIRCULAR]";
  ancestors.add(value);

  try {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactLogText(value.message),
        ...(value.stack === undefined
          ? {}
          : { stack: redactLogText(value.stack) }),
      };
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, ancestors));
    }

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = isSensitiveLogKey(key)
        ? REDACTED_VALUE
        : redactValue(nestedValue, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function redactLogValue(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}
