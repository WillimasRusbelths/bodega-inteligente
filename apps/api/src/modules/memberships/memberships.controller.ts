import {
  isRoleCode,
  permissionsForRoles,
  type RoleCode,
} from "@bodegia/authz-catalog";
import { parseIfMatch, toEntityTag } from "../../common/http/if-match.js";
import type { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import type { TenantContext } from "../access/context/tenant-context.js";
import {
  ChangeMembershipStatusService,
  type ChangedMembershipStatus,
} from "./services/change-membership-status.service.js";
import {
  ChangeRolesService,
  MembershipMutationError,
  type ChangedMembershipRoles,
  type MembershipAdminContext,
} from "./services/change-roles.service.js";

interface MembershipResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: "PENDING_ACTIVATION" | "ACTIVE" | "DISABLED";
  readonly roles: readonly string[];
  readonly version: number;
}

function asStrictRecord(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  return record;
}

function parseReason(value: unknown): string {
  if (typeof value !== "string") {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  return reason;
}

function parseRolesBody(value: unknown): {
  roles: readonly RoleCode[];
  reason: string;
} {
  const record = asStrictRecord(value, ["roles", "reason"]);
  if (
    !Array.isArray(record["roles"]) ||
    record["roles"].length === 0 ||
    new Set(record["roles"]).size !== record["roles"].length ||
    !record["roles"].every(
      (role): role is RoleCode => typeof role === "string" && isRoleCode(role),
    )
  ) {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  return {
    roles: Object.freeze([...record["roles"]]),
    reason: parseReason(record["reason"]),
  };
}

function parseStatusBody(value: unknown): {
  status: "ACTIVE" | "DISABLED";
  reason: string;
} {
  const record = asStrictRecord(value, ["status", "reason"]);
  if (record["status"] !== "ACTIVE" && record["status"] !== "DISABLED") {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  return {
    status: record["status"],
    reason: parseReason(record["reason"]),
  };
}

function expectedVersion(ifMatch: string | undefined): number {
  try {
    return parseIfMatch(ifMatch);
  } catch {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
}

function adminContext(context: TenantContext): MembershipAdminContext {
  return {
    userId: context.userId,
    membershipId: context.membershipId,
    tenantId: context.tenantId,
    permissions: context.permissions,
  };
}

/** REST boundary for the approved current-tenant membership operations. */
export class MembershipsController {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly roles: ChangeRolesService = new ChangeRolesService(prisma),
    private readonly statuses: ChangeMembershipStatusService = new ChangeMembershipStatusService(
      prisma,
    ),
  ) {}

  public listCurrentTenantMembers(
    context: TenantContext,
  ): Promise<{ readonly items: readonly MembershipResponse[] }> {
    if (!context.permissions.includes("access.memberships.read")) {
      throw new MembershipMutationError("INSUFFICIENT_PERMISSION");
    }
    return this.prisma.execute(async (client) => {
      const memberships = await client.membership.findMany({
        where: { tenantId: context.tenantId },
        include: {
          user: true,
          membershipRoles: { include: { role: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return {
        items: memberships.map((membership) => ({
          id: membership.id,
          tenantId: membership.tenantId,
          userId: membership.userId,
          displayName: membership.user.displayName,
          status: membership.status,
          roles: membership.membershipRoles.map(({ role }) => role.code).sort(),
          version: membership.version,
        })),
      };
    });
  }

  public async replaceMembershipRoles(
    context: TenantContext,
    membershipId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<{ readonly body: MembershipResponse; readonly etag: string }> {
    const input = parseRolesBody(body);
    const result = await this.roles.execute(
      {
        membershipId,
        roles: input.roles,
        reason: input.reason,
        expectedVersion: expectedVersion(ifMatch),
      },
      adminContext(context),
    );
    return {
      body: membershipResponse(result),
      etag: toEntityTag(result.version),
    };
  }

  public async changeMembershipStatus(
    context: TenantContext,
    membershipId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<{
    readonly body: MembershipResponse;
    readonly etag: string;
  }> {
    const input = parseStatusBody(body);
    const result = await this.statuses.execute(
      {
        membershipId,
        status: input.status,
        reason: input.reason,
        expectedVersion: expectedVersion(ifMatch),
      },
      adminContext(context),
    );
    return {
      body: membershipResponse(result),
      etag: toEntityTag(result.version),
    };
  }
}

function membershipResponse(
  value: ChangedMembershipRoles | ChangedMembershipStatus,
): MembershipResponse {
  return {
    id: value.id,
    tenantId: value.tenantId,
    userId: value.userId,
    displayName: value.displayName,
    status: value.status,
    roles: [...value.roles],
    version: value.version,
  };
}

interface ContractMembership {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
  status: "ACTIVE" | "DISABLED";
  roles: string[];
  version: number;
}

interface ContractActor {
  readonly userId: string;
  readonly membershipId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

function assertContractOwner(actor: ContractActor): void {
  const permissions = permissionsForRoles(actor.roles);
  if (
    !permissions.includes("access.memberships.manage") ||
    !permissions.includes("access.roles.manage")
  ) {
    throw new MembershipMutationError("INSUFFICIENT_PERMISSION");
  }
}

function contractTarget(
  memberships: readonly ContractMembership[],
  actor: ContractActor,
  membershipId: string,
): ContractMembership {
  const target = memberships.find(
    ({ id, tenantId }) => id === membershipId && tenantId === actor.tenantId,
  );
  if (target === undefined) {
    throw new MembershipMutationError("RESOURCE_NOT_FOUND");
  }
  return target;
}

/** Contract adapter with strict DTO, ETag and tenant-scoped serialization semantics. */
export function createMembershipManagementContractHarness(options: {
  memberships: ContractMembership[];
}): {
  listMembers(actor: ContractActor): Promise<{ items: ContractMembership[] }>;
  replaceRoles(
    actor: ContractActor,
    membershipId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<{ body: ContractMembership; etag: string }>;
  changeStatus(
    actor: ContractActor,
    membershipId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<{ body: ContractMembership; etag: string }>;
} {
  return {
    async listMembers(actor) {
      await Promise.resolve();
      assertContractOwner(actor);
      return {
        items: options.memberships
          .filter(({ tenantId }) => tenantId === actor.tenantId)
          .map((membership) => ({
            ...membership,
            roles: [...membership.roles],
          })),
      };
    },
    async replaceRoles(actor, membershipId, ifMatch, body) {
      await Promise.resolve();
      assertContractOwner(actor);
      const expected = expectedVersion(ifMatch);
      const input = parseRolesBody(body);
      const target = contractTarget(options.memberships, actor, membershipId);
      if (target.version !== expected) {
        throw new MembershipMutationError("STALE_STATE");
      }
      target.roles = [...input.roles];
      target.version += 1;
      return {
        body: { ...target, roles: [...target.roles] },
        etag: toEntityTag(target.version),
      };
    },
    async changeStatus(actor, membershipId, ifMatch, body) {
      await Promise.resolve();
      assertContractOwner(actor);
      const expected = expectedVersion(ifMatch);
      const input = parseStatusBody(body);
      const target = contractTarget(options.memberships, actor, membershipId);
      if (target.version !== expected) {
        throw new MembershipMutationError("STALE_STATE");
      }
      target.status = input.status;
      target.version += 1;
      return {
        body: { ...target, roles: [...target.roles] },
        etag: toEntityTag(target.version),
      };
    },
  };
}
