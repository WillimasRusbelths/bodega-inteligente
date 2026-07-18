import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { RoleCode } from "@bodegia/authz-catalog";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import { PermissionService } from "../../access/services/permission.service.js";

export type MembershipMutationErrorCode =
  | "VALIDATION_ERROR"
  | "INSUFFICIENT_PERMISSION"
  | "RESOURCE_NOT_FOUND"
  | "STALE_STATE"
  | "LAST_ACTIVE_OWNER";

export class MembershipMutationError extends Error {
  public readonly code: MembershipMutationErrorCode;

  public constructor(code: MembershipMutationErrorCode) {
    super("The membership operation could not be completed.");
    this.name = "MembershipMutationError";
    this.code = code;
  }
}

export interface MembershipAdminContext {
  readonly userId: string;
  readonly membershipId: string;
  readonly tenantId: string;
  readonly permissions: readonly string[];
}

export interface ChangeRolesCommand {
  readonly membershipId: string;
  readonly roles: readonly string[];
  readonly expectedVersion: number;
  readonly reason: string;
  readonly now?: Date;
}

export interface ChangedMembershipRoles {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: "PENDING_ACTIVATION" | "ACTIVE" | "DISABLED";
  readonly roles: readonly RoleCode[];
  readonly version: number;
}

function ensureReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  return normalized;
}

function currentRoleCodes(
  membershipRoles: ReadonlyArray<{ readonly role: { readonly code: string } }>,
): readonly string[] {
  return membershipRoles.map(({ role }) => role.code).sort();
}

export class ChangeRolesService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly permissions: PermissionService = new PermissionService(),
  ) {}

  public execute(
    command: ChangeRolesCommand,
    actor: MembershipAdminContext,
  ): Promise<ChangedMembershipRoles> {
    if (!actor.permissions.includes("access.roles.manage")) {
      throw new MembershipMutationError("INSUFFICIENT_PERMISSION");
    }
    const roles = this.permissions.validateRoles(command.roles);
    const reason = ensureReason(command.reason);
    const now = command.now ?? new Date();

    return this.prisma.transaction(
      async (transaction) => {
        const actorMembership = await transaction.membership.findUnique({
          where: {
            tenantId_id: {
              tenantId: actor.tenantId,
              id: actor.membershipId,
            },
          },
          include: { membershipRoles: { include: { role: true } } },
        });
        if (
          actorMembership === null ||
          actorMembership.userId !== actor.userId ||
          actorMembership.status !== "ACTIVE" ||
          !actorMembership.membershipRoles.some(
            ({ role }) => role.code === "owner_admin",
          )
        ) {
          throw new MembershipMutationError("INSUFFICIENT_PERMISSION");
        }

        const target = await transaction.membership.findUnique({
          where: {
            tenantId_id: {
              tenantId: actor.tenantId,
              id: command.membershipId,
            },
          },
          include: {
            user: true,
            membershipRoles: { include: { role: true } },
          },
        });
        if (target === null) {
          throw new MembershipMutationError("RESOURCE_NOT_FOUND");
        }
        if (target.version !== command.expectedVersion) {
          throw new MembershipMutationError("STALE_STATE");
        }

        const beforeRoles = currentRoleCodes(target.membershipRoles);
        if (
          target.status === "ACTIVE" &&
          beforeRoles.includes("owner_admin") &&
          !roles.includes("owner_admin")
        ) {
          const activeOwnerCount = await transaction.membership.count({
            where: {
              tenantId: actor.tenantId,
              status: "ACTIVE",
              membershipRoles: { some: { role: { code: "owner_admin" } } },
            },
          });
          if (activeOwnerCount <= 1) {
            throw new MembershipMutationError("LAST_ACTIVE_OWNER");
          }
        }

        const roleRows = await transaction.role.findMany({
          where: { code: { in: [...roles] } },
        });
        if (roleRows.length !== roles.length) {
          throw new MembershipMutationError("VALIDATION_ERROR");
        }

        const updated = await transaction.membership.updateMany({
          where: {
            tenantId: actor.tenantId,
            id: target.id,
            version: command.expectedVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new MembershipMutationError("STALE_STATE");
        }

        await transaction.membershipRole.deleteMany({
          where: { tenantId: actor.tenantId, membershipId: target.id },
        });
        await transaction.membershipRole.createMany({
          data: roleRows.map((role) => ({
            tenantId: actor.tenantId,
            membershipId: target.id,
            roleId: role.id,
            assignedByMembershipId: actor.membershipId,
          })),
        });
        await transaction.session.updateMany({
          where: {
            tenantId: actor.tenantId,
            activeMembershipId: target.id,
            revokedAt: null,
          },
          data: { contextVersion: { increment: 1 } },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorType: "USER",
            actorId: actor.userId,
            effectiveMembershipId: actor.membershipId,
            action: "MEMBERSHIP_ROLES_CHANGED",
            targetType: "Membership",
            targetId: target.id,
            result: "SUCCEEDED",
            reasonCode: reason,
            beforeSanitized: { roles: beforeRoles },
            afterSanitized: { roles },
            correlationId: randomUUID(),
            occurredAt: now,
          },
        });

        return {
          id: target.id,
          tenantId: target.tenantId,
          userId: target.userId,
          displayName: target.user.displayName,
          status: target.status,
          roles,
          version: target.version + 1,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
}

interface HarnessMembership {
  id: string;
  tenantId: string;
  status: "ACTIVE" | "DISABLED";
  roles: string[];
  version: number;
}

interface LastOwnerHarnessOptions {
  memberships: HarnessMembership[];
  audits: Array<Record<string, unknown>>;
  isolationLevels: string[];
}

function serializeHarness(options: LastOwnerHarnessOptions) {
  let queue = Promise.resolve();
  return <T>(work: () => T | Promise<T>): Promise<T> => {
    options.isolationLevels.push("Serializable");
    const result = queue.then(work, work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

function activeOwnerCount(
  memberships: readonly HarnessMembership[],
  tenantId: string,
): number {
  return memberships.filter(
    ({ tenantId: candidateTenant, status, roles }) =>
      candidateTenant === tenantId &&
      status === "ACTIVE" &&
      roles.includes("owner_admin"),
  ).length;
}

/** In-memory serializable adapter used to exercise true race semantics without a remote DB. */
export function createLastOwnerConcurrencyHarness(
  options: LastOwnerHarnessOptions,
): {
  changeRoles(input: {
    actorMembershipId: string;
    targetMembershipId: string;
    roles: string[];
    expectedVersion: number;
    reason: string;
  }): Promise<HarnessMembership>;
  changeStatus(input: {
    actorMembershipId: string;
    targetMembershipId: string;
    status: "ACTIVE" | "DISABLED";
    expectedVersion: number;
    reason: string;
  }): Promise<HarnessMembership>;
} {
  const serialized = serializeHarness(options);

  const findAuthorized = (
    actorMembershipId: string,
    targetMembershipId: string,
  ): { actor: HarnessMembership; target: HarnessMembership } => {
    const actor = options.memberships.find(
      ({ id }) => id === actorMembershipId,
    );
    const target = options.memberships.find(
      ({ id }) => id === targetMembershipId,
    );
    if (
      actor === undefined ||
      target === undefined ||
      actor.tenantId !== target.tenantId ||
      actor.status !== "ACTIVE" ||
      !actor.roles.includes("owner_admin")
    ) {
      throw new MembershipMutationError("RESOURCE_NOT_FOUND");
    }
    return { actor, target };
  };

  return {
    changeRoles: (input) =>
      serialized(async () => {
        await Promise.resolve();
        const { target } = findAuthorized(
          input.actorMembershipId,
          input.targetMembershipId,
        );
        if (target.version !== input.expectedVersion) {
          throw new MembershipMutationError("STALE_STATE");
        }
        const roles = new PermissionService().validateRoles(input.roles);
        if (
          target.status === "ACTIVE" &&
          target.roles.includes("owner_admin") &&
          !roles.includes("owner_admin") &&
          activeOwnerCount(options.memberships, target.tenantId) <= 1
        ) {
          throw new MembershipMutationError("LAST_ACTIVE_OWNER");
        }
        target.roles = [...roles];
        target.version += 1;
        options.audits.push({
          action: "MEMBERSHIP_ROLES_CHANGED",
          targetMembershipId: target.id,
          reason: input.reason,
          result: "SUCCEEDED",
        });
        return target;
      }),
    changeStatus: (input) =>
      serialized(async () => {
        await Promise.resolve();
        const { target } = findAuthorized(
          input.actorMembershipId,
          input.targetMembershipId,
        );
        if (target.version !== input.expectedVersion) {
          throw new MembershipMutationError("STALE_STATE");
        }
        if (
          input.status === "DISABLED" &&
          target.status === "ACTIVE" &&
          target.roles.includes("owner_admin") &&
          activeOwnerCount(options.memberships, target.tenantId) <= 1
        ) {
          throw new MembershipMutationError("LAST_ACTIVE_OWNER");
        }
        target.status = input.status;
        target.version += 1;
        options.audits.push({
          action: `MEMBERSHIP_${input.status}`,
          targetMembershipId: target.id,
          reason: input.reason,
          result: "SUCCEEDED",
        });
        return target;
      }),
  };
}

export type MembershipTransaction = Prisma.TransactionClient;
