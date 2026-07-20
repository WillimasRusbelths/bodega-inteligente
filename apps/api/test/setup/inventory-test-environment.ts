export const TEST_DATABASE_URL =
  "postgresql://bodegia_test:BodegiaLocal2026@127.0.0.1:5432/bodegia_test?schema=public";

export function requireLocalInventoryDatabase(
  value: string | undefined = process.env["DATABASE_URL"],
): string {
  if (value === undefined)
    throw new Error("Inventory tests require DATABASE_URL.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost")
    throw new Error("Inventory tests only allow local PostgreSQL.");
  if (database !== "bodegia_test" || url.username !== "bodegia_test")
    throw new Error("Inventory tests require bodegia_test.");
  return value;
}

export class ControlledInventoryClock {
  #current = new Date("2026-07-19T00:00:00.000Z");
  public now(): Date {
    return new Date(this.#current);
  }
  public set(instant: string): void {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime()))
      throw new Error("A valid UTC instant is required.");
    this.#current = next;
  }
}

export function controlledInventoryClock(): ControlledInventoryClock {
  return new ControlledInventoryClock();
}
