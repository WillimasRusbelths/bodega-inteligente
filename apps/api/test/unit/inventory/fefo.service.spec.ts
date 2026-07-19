import { describe, expect, it } from "vitest";
import {
  operationalDate,
  orderFefoCandidates,
} from "../../../src/modules/inventory/services/fefo.service.js";

function lot(
  id: string,
  expiresAt: string,
  receivedAt: string,
  availableQuantity: number,
  status: "AVAILABLE" | "EXPIRED" = "AVAILABLE",
) {
  return {
    id,
    tenantId: "00000000-0000-4000-8000-000000007001",
    productId: "00000000-0000-4000-8000-000000007002",
    receivedAt: new Date(`${receivedAt}T00:00:00.000Z`),
    expiresAt: new Date(`${expiresAt}T00:00:00.000Z`),
    initialQuantity: { toString: () => String(availableQuantity) },
    availableQuantity: { valueOf: () => availableQuantity } as unknown as {
      toString(): string;
    },
    unitCost: { toString: () => "1" },
    status,
    version: 1,
    createdBy: "00000000-0000-4000-8000-000000007003",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as never;
}

describe("FEFO rules [T051, T055]", () => {
  it("uses tenant local date and orders expiry, receipt and id", () => {
    expect(
      operationalDate(new Date("2026-07-19T02:00:00.000Z"), "America/Lima"),
    ).toBe("2026-07-18");
    const ordered = orderFefoCandidates(
      [
        lot("b", "2026-08-01", "2026-06-02", 2),
        lot("a", "2026-08-01", "2026-06-01", 2),
        lot("c", "2026-07-01", "2026-05-01", 2),
      ],
      "2026-07-19",
    );
    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("excludes depleted and expired lots unless explicitly allowed", () => {
    expect(
      orderFefoCandidates(
        [lot("expired", "2026-07-01", "2026-01-01", 4)],
        "2026-07-19",
      ),
    ).toHaveLength(0);
    expect(
      orderFefoCandidates(
        [lot("expired", "2026-07-01", "2026-01-01", 4)],
        "2026-07-19",
        true,
      ),
    ).toHaveLength(1);
  });
});
