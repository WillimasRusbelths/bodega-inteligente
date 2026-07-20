import { FIXTURE_INSTANT, tenantA, tenantB } from "./fixtures.js";

export interface SyntheticInventoryProduct {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly sku: string;
  readonly minimumStock: number;
}

export interface SyntheticInventoryLot {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly expiresAt: string;
  readonly availableQuantity: number;
  readonly unitCost: number;
}

export interface SyntheticInventoryAlert {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly type: "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED";
}

export function buildInventoryProduct(
  tenantId: string = tenantA.id,
  overrides: Partial<SyntheticInventoryProduct> = {},
): SyntheticInventoryProduct {
  const suffix = tenantId === tenantB.id ? "B" : "A";
  return Object.freeze({
    id:
      tenantId === tenantB.id
        ? "00000000-0000-4000-8000-000000001102"
        : "00000000-0000-4000-8000-000000001101",
    tenantId,
    name: `Producto sintético ${suffix}`,
    sku: `SYN-${suffix}`,
    minimumStock: 3,
    ...overrides,
  });
}

export function buildInventoryLot(
  product: SyntheticInventoryProduct = buildInventoryProduct(),
  overrides: Partial<SyntheticInventoryLot> = {},
): SyntheticInventoryLot {
  return Object.freeze({
    id:
      product.tenantId === tenantB.id
        ? "00000000-0000-4000-8000-000000002102"
        : "00000000-0000-4000-8000-000000002101",
    tenantId: product.tenantId,
    productId: product.id,
    expiresAt: "2027-01-01",
    availableQuantity: 10,
    unitCost: 4.25,
    ...overrides,
  });
}

export function buildInventoryAlert(
  product: SyntheticInventoryProduct = buildInventoryProduct(),
  overrides: Partial<SyntheticInventoryAlert> = {},
): SyntheticInventoryAlert {
  return Object.freeze({
    id:
      product.tenantId === tenantB.id
        ? "00000000-0000-4000-8000-000000003102"
        : "00000000-0000-4000-8000-000000003101",
    tenantId: product.tenantId,
    productId: product.id,
    type: "LOW_STOCK" as const,
    ...overrides,
  });
}

export const inventoryFixtureInstant = FIXTURE_INSTANT;
export const inventoryTenantFixtures = Object.freeze({
  tenantA: buildInventoryProduct(tenantA.id),
  tenantB: buildInventoryProduct(tenantB.id),
});
