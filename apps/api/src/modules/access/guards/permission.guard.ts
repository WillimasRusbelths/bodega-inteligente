import { TenantPermissionError } from "./authorization-errors.js";
import type { MembershipSnapshot } from "./guard-types.js";

export class PermissionGuard {
  public assert(
    membership: MembershipSnapshot,
    requiredPermission: string,
  ): void {
    if (!membership.permissions.includes(requiredPermission)) {
      throw new TenantPermissionError();
    }
  }
}
