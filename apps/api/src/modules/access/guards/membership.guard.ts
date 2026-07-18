import { TenantResourceNotFoundError } from "./authorization-errors.js";
import type { MembershipSnapshot, TenantAccessClaims } from "./guard-types.js";

export class MembershipGuard {
  public assert(
    membership: MembershipSnapshot | null,
    claims: TenantAccessClaims,
  ): MembershipSnapshot {
    if (
      membership === null ||
      membership.id !== claims.membershipId ||
      membership.userId !== claims.userId ||
      membership.tenantId !== claims.tenantId ||
      membership.status !== "ACTIVE"
    ) {
      throw new TenantResourceNotFoundError();
    }
    return membership;
  }
}
