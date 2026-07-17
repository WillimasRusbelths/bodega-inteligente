import { TenantSessionInvalidError } from "./authorization-errors.js";
import type { IdentitySnapshot, TenantAccessClaims } from "./guard-types.js";

export class IdentityGuard {
  public assert(identity: IdentitySnapshot, claims: TenantAccessClaims): void {
    if (
      identity.id !== claims.userId ||
      identity.status !== "ACTIVE" ||
      identity.authVersion !== claims.authVersion
    ) {
      throw new TenantSessionInvalidError();
    }
  }
}
