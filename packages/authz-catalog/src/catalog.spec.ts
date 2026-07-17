import { describe, expect, it } from "vitest";

type RoleCode = "owner_admin" | "seller" | "inventory_manager";

interface CatalogModule {
  readonly ROLE_CODES: readonly RoleCode[];
  readonly roleCatalog: Readonly<
    Record<RoleCode, { readonly permissions: readonly string[] }>
  >;
  isRoleCode(value: string): value is RoleCode;
  permissionsForRoles(roles: readonly string[]): readonly string[];
}

async function loadCatalog(): Promise<CatalogModule> {
  const module = (await import("./index.js")) as Partial<CatalogModule>;
  if (
    module.ROLE_CODES === undefined ||
    module.roleCatalog === undefined ||
    module.isRoleCode === undefined ||
    module.permissionsForRoles === undefined
  ) {
    throw new Error(
      "[T071] The typed authorization catalog is required by T067.",
    );
  }
  return module as CatalogModule;
}

describe("authorization catalog [T067; HU-005; FR-013, FR-014, FR-032]", () => {
  it("defines exactly the three approved deterministic role codes", async () => {
    const catalog = await loadCatalog();
    expect(catalog.ROLE_CODES).toEqual([
      "owner_admin",
      "seller",
      "inventory_manager",
    ]);
    expect(Object.isFrozen(catalog.ROLE_CODES)).toBe(true);
    expect(Object.isFrozen(catalog.roleCatalog)).toBe(true);
  });

  it("reserves membership, role and audit administration for owner_admin", async () => {
    const catalog = await loadCatalog();
    const permissions = catalog.permissionsForRoles(["owner_admin"]);
    expect(permissions).toEqual(
      expect.arrayContaining([
        "access.memberships.read",
        "access.memberships.manage",
        "access.roles.read",
        "access.roles.manage",
        "access.audit.read",
      ]),
    );
  });

  it("allows seller to read authorized stock without adjusting it", async () => {
    const permissions = (await loadCatalog()).permissionsForRoles(["seller"]);
    expect(permissions).toContain("inventory.stock.read");
    expect(permissions).not.toContain("inventory.stock.adjust");
    expect(permissions).not.toContain("access.memberships.manage");
    expect(permissions).not.toContain("access.roles.manage");
  });

  it("grants inventory_manager the reserved inventory capabilities only", async () => {
    const permissions = (await loadCatalog()).permissionsForRoles([
      "inventory_manager",
    ]);
    expect(permissions).toEqual(
      expect.arrayContaining([
        "inventory.products.read",
        "inventory.lots.read",
        "inventory.stock.read",
        "inventory.stock.adjust",
      ]),
    );
    expect(permissions).not.toContain("access.memberships.manage");
    expect(permissions).not.toContain("access.roles.manage");
  });

  it("combines roles as a unique deterministic union", async () => {
    const catalog = await loadCatalog();
    const first = catalog.permissionsForRoles([
      "inventory_manager",
      "seller",
      "inventory_manager",
    ]);
    const second = catalog.permissionsForRoles(["seller", "inventory_manager"]);
    expect(first).toEqual(second);
    expect(first).toEqual([...new Set(first)].sort());
  });

  it("calculates permissions independently for each membership", async () => {
    const catalog = await loadCatalog();
    const tenantA = catalog.permissionsForRoles(["seller"]);
    const tenantB = catalog.permissionsForRoles(["inventory_manager"]);
    expect(tenantA).not.toContain("inventory.stock.adjust");
    expect(tenantB).toContain("inventory.stock.adjust");
    expect(tenantA).not.toBe(tenantB);
  });

  it("never accepts global permissions as an input", async () => {
    const catalog = await loadCatalog();
    expect(() =>
      catalog.permissionsForRoles(["seller", "access.memberships.manage"]),
    ).toThrow();
  });

  it("rejects unknown roles", async () => {
    const catalog = await loadCatalog();
    expect(catalog.isRoleCode("administrator")).toBe(false);
    expect(() => catalog.permissionsForRoles(["administrator"])).toThrow();
  });

  it("does not allow seller or inventory_manager to administer access", async () => {
    const catalog = await loadCatalog();
    for (const role of ["seller", "inventory_manager"] as const) {
      const permissions = catalog.permissionsForRoles([role]);
      expect(permissions).not.toContain("access.memberships.manage");
      expect(permissions).not.toContain("access.roles.manage");
    }
  });
});
