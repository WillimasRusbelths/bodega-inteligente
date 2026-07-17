import { TenantResourceNotFoundError } from "./authorization-errors.js";
import type {
  MembershipSnapshot,
  TenantAccessClaims,
  TenantSnapshot,
} from "./guard-types.js";

export class ActiveTenantGuard {
  public assert(
    tenant: TenantSnapshot | null,
    membership: MembershipSnapshot,
    claims: TenantAccessClaims,
    requestedTenantId: string,
  ): TenantSnapshot {
    if (
      tenant === null ||
      tenant.status !== "ACTIVE" ||
      tenant.id !== claims.tenantId ||
      tenant.id !== membership.tenantId ||
      requestedTenantId !== claims.tenantId
    ) {
      throw new TenantResourceNotFoundError();
    }
    return tenant;
  }
}
