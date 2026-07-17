export interface TenantAccessClaims {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly authVersion: number;
  readonly contextVersion: number;
}

export interface IdentitySnapshot {
  readonly id: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly authVersion: number;
}

export interface SessionSnapshot {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly contextVersion: number;
  readonly revokedAt: Date | null;
}

export interface MembershipSnapshot {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface TenantSnapshot {
  readonly id: string;
  readonly status: "ACTIVE" | "DISABLED";
}

export interface TenantGuardInput {
  readonly claims: TenantAccessClaims;
  readonly requestedTenantId: string;
  readonly requiredPermission: string;
  readonly identity: IdentitySnapshot;
  readonly session: SessionSnapshot;
  readonly membership: MembershipSnapshot | null;
  readonly tenant: TenantSnapshot | null;
}
