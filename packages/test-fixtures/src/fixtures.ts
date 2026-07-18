import type {
  SyntheticDevice,
  SyntheticMembership,
  SyntheticTenant,
  SyntheticUser,
} from "./types.js";

export const FIXTURE_INSTANT = "2026-01-01T00:00:00.000Z";

export const tenantA = Object.freeze<SyntheticTenant>({
  id: "00000000-0000-4000-8000-000000000001",
  label: "Synthetic Tenant A",
  createdAt: FIXTURE_INSTANT,
});
export const tenantB = Object.freeze<SyntheticTenant>({
  id: "00000000-0000-4000-8000-000000000002",
  label: "Synthetic Tenant B",
  createdAt: FIXTURE_INSTANT,
});

export const ownerA = Object.freeze<SyntheticUser>({
  id: "00000000-0000-4000-8000-000000000011",
  label: "Synthetic Owner A",
  createdAt: FIXTURE_INSTANT,
});
export const ownerB = Object.freeze<SyntheticUser>({
  id: "00000000-0000-4000-8000-000000000012",
  label: "Synthetic Owner B",
  createdAt: FIXTURE_INSTANT,
});
export const sellerA = Object.freeze<SyntheticUser>({
  id: "00000000-0000-4000-8000-000000000013",
  label: "Synthetic Seller A",
  createdAt: FIXTURE_INSTANT,
});
export const inventoryA = Object.freeze<SyntheticUser>({
  id: "00000000-0000-4000-8000-000000000014",
  label: "Synthetic Inventory A",
  createdAt: FIXTURE_INSTANT,
});
export const crossTenantUser = Object.freeze<SyntheticUser>({
  id: "00000000-0000-4000-8000-000000000015",
  label: "Synthetic Cross-Tenant User",
  createdAt: FIXTURE_INSTANT,
});

export const memberships = Object.freeze<SyntheticMembership[]>([
  {
    id: "00000000-0000-4000-8000-000000000101",
    tenantId: tenantA.id,
    userId: ownerA.id,
    roles: ["OWNER"],
    createdAt: FIXTURE_INSTANT,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    tenantId: tenantB.id,
    userId: ownerB.id,
    roles: ["OWNER"],
    createdAt: FIXTURE_INSTANT,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    tenantId: tenantA.id,
    userId: sellerA.id,
    roles: ["SELLER"],
    createdAt: FIXTURE_INSTANT,
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    tenantId: tenantA.id,
    userId: inventoryA.id,
    roles: ["INVENTORY_MANAGER"],
    createdAt: FIXTURE_INSTANT,
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    tenantId: tenantA.id,
    userId: crossTenantUser.id,
    roles: ["SELLER"],
    createdAt: FIXTURE_INSTANT,
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    tenantId: tenantB.id,
    userId: crossTenantUser.id,
    roles: ["INVENTORY_MANAGER"],
    createdAt: FIXTURE_INSTANT,
  },
]);

export const devices = Object.freeze<SyntheticDevice[]>([
  {
    id: "00000000-0000-4000-8000-000000000201",
    userId: ownerA.id,
    label: "Synthetic Device A",
    createdAt: FIXTURE_INSTANT,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    userId: ownerB.id,
    label: "Synthetic Device B",
    createdAt: FIXTURE_INSTANT,
  },
]);

export const tenantIsolationFixtures = Object.freeze({
  tenantA,
  tenantB,
  ownerA,
  ownerB,
  sellerA,
  inventoryA,
  crossTenantUser,
  memberships,
  devices,
});
