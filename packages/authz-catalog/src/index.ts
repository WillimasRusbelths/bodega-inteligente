export const ROLE_CODES = Object.freeze([
  "owner_admin",
  "seller",
  "inventory_manager",
] as const);

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = Object.freeze([
  "access.memberships.read",
  "access.memberships.manage",
  "access.roles.read",
  "access.roles.manage",
  "access.audit.read",
  "inventory.products.read",
  "inventory.lots.read",
  "inventory.stock.read",
  "inventory.stock.adjust",
] as const);

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export interface RoleDefinition {
  readonly code: RoleCode;
  readonly permissions: readonly PermissionCode[];
}

function definition(
  code: RoleCode,
  permissions: readonly PermissionCode[],
): RoleDefinition {
  return Object.freeze({ code, permissions: Object.freeze([...permissions]) });
}

export const roleCatalog = Object.freeze({
  owner_admin: definition("owner_admin", [
    "access.memberships.read",
    "access.memberships.manage",
    "access.roles.read",
    "access.roles.manage",
    "access.audit.read",
  ]),
  seller: definition("seller", ["inventory.stock.read"]),
  inventory_manager: definition("inventory_manager", [
    "inventory.products.read",
    "inventory.lots.read",
    "inventory.stock.read",
    "inventory.stock.adjust",
  ]),
}) satisfies Readonly<Record<RoleCode, RoleDefinition>>;

const roleCodes: ReadonlySet<string> = new Set(ROLE_CODES);

export function isRoleCode(value: string): value is RoleCode {
  return roleCodes.has(value);
}

export function permissionsForRoles(
  roles: readonly string[],
): readonly PermissionCode[] {
  const permissions = new Set<PermissionCode>();
  for (const role of roles) {
    if (!isRoleCode(role)) throw new Error("Unknown authorization role.");
    for (const permission of roleCatalog[role].permissions) {
      permissions.add(permission);
    }
  }
  return Object.freeze([...permissions].sort());
}
