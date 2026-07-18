import {
  isRoleCode,
  permissionsForRoles,
  type PermissionCode,
  type RoleCode,
} from "@bodegia/authz-catalog";

export interface PermissionMembership {
  readonly tenantId: string;
  readonly status: "PENDING_ACTIVATION" | "ACTIVE" | "DISABLED";
  readonly roles: readonly string[];
}

export class PermissionService {
  public validateRoles(roles: readonly string[]): readonly RoleCode[] {
    if (roles.length === 0 || new Set(roles).size !== roles.length) {
      throw new Error("At least one unique approved role is required.");
    }
    if (!roles.every(isRoleCode)) throw new Error("Unknown role.");
    return Object.freeze([...roles]);
  }

  public forActiveMembership(
    membership: PermissionMembership,
    activeTenantId: string,
  ): readonly PermissionCode[] {
    if (
      membership.status !== "ACTIVE" ||
      membership.tenantId !== activeTenantId
    ) {
      throw new Error("The active membership is not available.");
    }
    return permissionsForRoles(this.validateRoles(membership.roles));
  }
}
