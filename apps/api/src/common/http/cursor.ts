export interface CursorPayload {
  readonly id: string;
  readonly occurredAt: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("id" in value) ||
      !("occurredAt" in value) ||
      typeof value.id !== "string" ||
      typeof value.occurredAt !== "string"
    ) {
      throw new Error("Invalid cursor payload.");
    }
    return { id: value.id, occurredAt: value.occurredAt };
  } catch {
    throw new Error("Invalid pagination cursor.");
  }
}
