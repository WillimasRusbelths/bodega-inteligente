import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface OperationalDataAdapter {
  normalizeOperationalProducts(input: unknown): readonly {
    readonly id: string;
    readonly availableStock: number;
  }[];
  unwrapApiData<T>(input: unknown): T;
  projectOperationalDataForContext<T>(
    input: T,
    context: {
      readonly role: string;
      readonly capabilities?: readonly string[];
    },
  ): T;
}

async function loadAdapter(): Promise<OperationalDataAdapter> {
  const modulePath = fileURLToPath(
    new URL("../src/api/operational-data-adapter.ts", import.meta.url),
  );
  if (!existsSync(modulePath)) {
    throw new Error("[T020] operational-data-adapter is required by T015.");
  }
  const module = (await import(
    pathToFileURL(modulePath).href
  )) as Partial<OperationalDataAdapter>;
  if (
    module.normalizeOperationalProducts === undefined ||
    module.unwrapApiData === undefined ||
    module.projectOperationalDataForContext === undefined
  ) {
    throw new Error("[T020/T025] operational response adapters are required.");
  }
  return {
    normalizeOperationalProducts: module.normalizeOperationalProducts,
    unwrapApiData: module.unwrapApiData,
    projectOperationalDataForContext: module.projectOperationalDataForContext,
  };
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
        adapter
          .normalizeOperationalProducts(input)
          .map((product) => product.availableStock),
      ),
    ).toEqual([[18], [18], [18]]);
    expect(() =>
      adapter.normalizeOperationalProducts({ data: { items: [] } }),
    ).toThrow("INVALID_OPERATIONAL_DATA");
  });

  it("preserves the combined products envelope while unwrapping ordinary data responses", async () => {
    const adapter = await loadAdapter();
    const combined = {
      items: [{ id: salesSummary.id, availableStock: 18 }],
      data: [salesSummary],
      nextCursor: null,
    };

    expect(adapter.unwrapApiData<typeof combined>(combined)).toBe(combined);
    expect(
      adapter.unwrapApiData<readonly (typeof salesSummary)[]>({
        data: [salesSummary],
      }),
    ).toEqual([salesSummary]);
  });

  it("removes seller cost, valuation, estimated-loss and purchase derivatives recursively", async () => {
    const adapter = await loadAdapter();
    const malformed = {
      unitCost: 91.25,
      nested: {
        inventoryValuation: 680.6,
        estimatedLoss: 46.8,
        purchasePrice: 23.4,
        safeStock: 4,
      },
      rows: [{ totalCost: 365, productName: "Leche" }],
    };

    const seller = adapter.projectOperationalDataForContext(malformed, {
      role: "seller",
      capabilities: ["inventory.products.read", "inventory.stock.read"],
    });
    const manager = adapter.projectOperationalDataForContext(malformed, {
      role: "inventory_manager",
      capabilities: ["inventory.lots.read"],
    });

    expect(seller).toEqual({
      nested: { safeStock: 4 },
      rows: [{ productName: "Leche" }],
    });
    expect(JSON.stringify(seller)).not.toMatch(
      /unitCost|inventoryValuation|estimatedLoss|purchasePrice|totalCost|91\.25|680\.6|46\.8|23\.4|365/iu,
    );
    expect(manager).toBe(malformed);
  });
});
