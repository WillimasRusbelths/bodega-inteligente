import { isUuid } from "../validation/uuid.js";

export function parseIdempotencyKey(value: string | undefined): string {
  if (value === undefined || !isUuid(value)) {
    throw new Error("Idempotency-Key must be a UUID.");
  }
  return value;
}
