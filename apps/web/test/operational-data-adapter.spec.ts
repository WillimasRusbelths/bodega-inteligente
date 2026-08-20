import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface OperationalDataAdapter {
  normalizeOperationalProducts(input: unknown): readonly {
    readonly id: string;
    readonly availableStock: number;
  }[];
}

async function loadAdapter(): Promise<OperationalDataAdapter> {
  const modulePath = fileURLToPath(
    new URL("../src/api/operational-data-adapter.ts", import.meta.url),
  );
  if (!existsSync(modulePath)) {
    throw new Error("[T020] operational-data-adapter is required by T015.");
  }
  const module = (await import(pathToFileURL(modulePath).href)) as Partial<OperationalDataAdapter>;
  if (module.normalizeOperationalProducts === undefined) {
    throw new Error(
      "[T020] normalizeOperationalProducts export is required by T015.",
    );
  }
  return { normalizeOperationalProducts: module.normalizeOperationalProducts };
}

const salesSummary = {
  id: "00000000-0000-4000-8000-000000000301",
  name: "Leche evaporada",
  sku: "LAC-LEC-001",
  barcode: "7750001000011",
  status: "ACTIVE",
  salePrice: 5.5,
  availableStock: 18,
};

describe("operational data adapter [T015]", () => {
  it("normalizes sales summaries, data envelopes and operational pages without recalculating backend stock", async () => {
    const adapter = await loadAdapter();
    const inputs = [
      [salesSummary],
      { data: [salesSummary] },
      {
        items: [
          {
            ...salesSummary,
            tenantId: "00000000-0000-4000-8000-000000000001",
            category: null,
            unitOfMeasure: {
              id: "00000000-0000-4000-8000-000000000201",
              code: "UND",
              name: "Unidad",
              quantityScale: 0,
            },
            minimumStock: 3,
            expiryAlertDays: 10,
            version: 1,
          },
        ],
        nextCursor: null,
      },
    ];

    expect(
      inputs.map((input) =>
        adapter.normalizeOperationalProducts(input).map((product) => product.availableStock),
      ),
    ).toEqual([[18], [18], [18]]);
    expect(() => adapter.normalizeOperationalProducts({ data: { items: [] } })).toThrow(
      "INVALID_OPERATIONAL_DATA",
    );
  });
});
