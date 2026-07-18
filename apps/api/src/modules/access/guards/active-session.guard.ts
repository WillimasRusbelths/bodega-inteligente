import { TenantSessionInvalidError } from "./authorization-errors.js";
import type { SessionSnapshot, TenantAccessClaims } from "./guard-types.js";

export class ActiveSessionGuard {
  public assert(session: SessionSnapshot, claims: TenantAccessClaims): void {
    if (
      session.id !== claims.sessionId ||
      session.userId !== claims.userId ||
      session.tenantId !== claims.tenantId ||
      session.membershipId !== claims.membershipId ||
      session.contextVersion !== claims.contextVersion ||
      session.revokedAt !== null
    ) {
      throw new TenantSessionInvalidError();
    }
  }
}
