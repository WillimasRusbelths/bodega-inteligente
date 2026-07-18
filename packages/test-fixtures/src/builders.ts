import type {
  SyntheticMembership,
  SyntheticRole,
  SyntheticUser,
} from "./types.js";

export function buildSyntheticUser(
  overrides: Partial<SyntheticUser> = {},
): SyntheticUser {
  return Object.freeze({
    id: "00000000-0000-4000-8000-000000000099",
    label: "Synthetic User",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

export function buildSyntheticMembership(
  roles: readonly SyntheticRole[],
  overrides: Partial<SyntheticMembership> = {},
): SyntheticMembership {
  return Object.freeze({
    id: "00000000-0000-4000-8000-000000000199",
    tenantId: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000099",
    roles: Object.freeze([...roles]),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}
