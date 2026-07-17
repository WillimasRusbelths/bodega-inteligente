import {
  createTenantContextFromAuthorization,
  type TenantContext,
} from "../context/tenant-context.js";
import { ActiveSessionGuard } from "./active-session.guard.js";
import { ActiveTenantGuard } from "./active-tenant.guard.js";
import type { TenantGuardInput } from "./guard-types.js";
import { IdentityGuard } from "./identity.guard.js";
import { MembershipGuard } from "./membership.guard.js";
import { PermissionGuard } from "./permission.guard.js";

export class TenantGuardChain {
  public constructor(
    private readonly identity = new IdentityGuard(),
    private readonly session = new ActiveSessionGuard(),
    private readonly membership = new MembershipGuard(),
    private readonly tenant = new ActiveTenantGuard(),
    private readonly permission = new PermissionGuard(),
  ) {}

  public authorize(input: TenantGuardInput): TenantContext {
    this.identity.assert(input.identity, input.claims);
    this.session.assert(input.session, input.claims);
    const membership = this.membership.assert(input.membership, input.claims);
    const tenant = this.tenant.assert(
      input.tenant,
      membership,
      input.claims,
      input.requestedTenantId,
    );
    this.permission.assert(membership, input.requiredPermission);
    return createTenantContextFromAuthorization({
      sessionId: input.session.id,
      userId: input.identity.id,
      tenantId: tenant.id,
      membershipId: membership.id,
      contextVersion: input.session.contextVersion,
      roles: membership.roles,
      permissions: membership.permissions,
    });
  }
}

interface HarnessState {
  user: {
    id: string;
    status: "ACTIVE" | "DISABLED";
    authVersion: number;
    globalPermissions: string[];
  };
  session: {
    id: string;
    userId: string;
    tenantId: string;
    membershipId: string;
    contextVersion: number;
    revokedAt: Date | null;
  };
  memberships: Array<{
    id: string;
    userId: string;
    tenantId: string;
    status: "ACTIVE" | "DISABLED";
    roles: string[];
    permissions: string[];
  }>;
  tenants: Array<{ id: string; status: "ACTIVE" | "DISABLED" }>;
  guardOrder: string[];
}

/** Test adapter that records the same ordered guard chain. */
export function createTenantGuardHarness(options: {
  readonly state: HarnessState;
}): {
  authorize(input: {
    readonly claims: TenantGuardInput["claims"];
    readonly requestedTenantId: string;
    readonly requiredPermission: string;
  }): Promise<TenantContext>;
} {
  return {
    async authorize(input) {
      await Promise.resolve();
      const membership =
        options.state.memberships.find(
          ({ id }) => id === input.claims.membershipId,
        ) ?? null;
      const tenant =
        options.state.tenants.find(({ id }) => id === input.claims.tenantId) ??
        null;
      const identity = new IdentityGuard();
      const session = new ActiveSessionGuard();
      const membershipGuard = new MembershipGuard();
      const tenantGuard = new ActiveTenantGuard();
      const permission = new PermissionGuard();

      options.state.guardOrder.push("identity");
      identity.assert(options.state.user, input.claims);
      options.state.guardOrder.push("session");
      session.assert(options.state.session, input.claims);
      options.state.guardOrder.push("membership");
      const activeMembership = membershipGuard.assert(membership, input.claims);
      options.state.guardOrder.push("tenant");
      const activeTenant = tenantGuard.assert(
        tenant,
        activeMembership,
        input.claims,
        input.requestedTenantId,
      );
      options.state.guardOrder.push("permission");
      permission.assert(activeMembership, input.requiredPermission);
      return createTenantContextFromAuthorization({
        sessionId: options.state.session.id,
        userId: options.state.user.id,
        tenantId: activeTenant.id,
        membershipId: activeMembership.id,
        contextVersion: options.state.session.contextVersion,
        roles: activeMembership.roles,
        permissions: activeMembership.permissions,
      });
    },
  };
}
