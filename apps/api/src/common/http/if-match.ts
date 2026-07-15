const entityTagPattern = /^"([1-9][0-9]*)"$/u;

export function parseIfMatch(value: string | undefined): number {
  const match = value?.match(entityTagPattern);
  if (match?.[1] === undefined) {
    throw new Error("If-Match must contain a quoted positive version.");
  }
  return Number.parseInt(match[1], 10);
}

export function toEntityTag(version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Entity version must be a positive integer.");
  }
  return `"${version}"`;
}
