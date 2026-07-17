import { randomUUID } from "node:crypto";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  MembershipMutationError,
  type MembershipAdminContext,
} from "./change-roles.service.js";

export interface ChangeMembershipStatusCommand {
  readonly membershipId: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly expectedVersion: number;
  readonly reason: string;
  readonly now?: Date;
}

export interface ChangedMembershipStatus {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly roles: readonly string[];
  readonly version: number;
  readonly requiresActivation: boolean;
}

function validatedReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw new MembershipMutationError("VALIDATION_ERROR");
  }
  return value;
}

export class ChangeMembershipStatusService {
  public constructor(private readonly prisma: PrismaModule) {}

  public execute(
    command: ChangeMembershipStatusCommand,
    actor: MembershipAdminContext,
  ): Promise<ChangedMembershipStatus> {
    if (!actor.permissions.includes("access.memberships.manage")) {
      throw new MembershipMutationError("INSUFFICIENT_PERMISSION");
    }
    const reason = validatedReason(command.reason);
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

        const roles = target.membershipRoles
          .map(({ role }) => role.code)
          .sort();
        if (
          command.status === "DISABLED" &&
          target.status === "ACTIVE" &&
          roles.includes("owner_admin")
        ) {
          const owners = await transaction.membership.count({
            where: {
              tenantId: actor.tenantId,
              status: "ACTIVE",
              membershipRoles: { some: { role: { code: "owner_admin" } } },
            },
          });
          if (owners <= 1) {
            throw new MembershipMutationError("LAST_ACTIVE_OWNER");
          }
        }

        const before = { status: target.status, roles };
        const updated = await transaction.membership.updateMany({
          where: {
            tenantId: actor.tenantId,
            id: target.id,
            version: command.expectedVersion,
          },
          data:
            command.status === "DISABLED"
              ? {
                  status: "DISABLED",
                  disabledAt: now,
                  disabledReason: reason,
                  disabledByMembershipId: actor.membershipId,
                  version: { increment: 1 },
                }
              : {
                  status: "ACTIVE",
                  disabledAt: null,
                  disabledReason: null,
                  disabledByMembershipId: null,
                  version: { increment: 1 },
                },
        });
        if (updated.count !== 1) {
          throw new MembershipMutationError("STALE_STATE");
        }

        if (command.status === "DISABLED") {
          const profiles = await transaction.deviceProfile.findMany({
            where: { tenantId: actor.tenantId, membershipId: target.id },
            select: { id: true, deviceId: true },
          });
          const sessions = await transaction.session.findMany({
            where: {
              revokedAt: null,
              OR: [
                {
                  tenantId: actor.tenantId,
                  activeMembershipId: target.id,
                },
                {
                  deviceProfileId: {
                    in: profiles.map(({ id }) => id),
                  },
                },
              ],
            },
            select: { id: true },
          });
          const sessionIds = sessions.map(({ id }) => id);
          await transaction.refreshCredential.updateMany({
            where: { sessionId: { in: sessionIds }, revokedAt: null },
            data: { revokedAt: now },
          });
          await transaction.session.updateMany({
            where: { id: { in: sessionIds }, revokedAt: null },
            data: { revokedAt: now, revokeReason: "MEMBERSHIP_DISABLED" },
          });
          await transaction.deviceProfile.updateMany({
            where: { tenantId: actor.tenantId, membershipId: target.id },
            data: { status: "REVOKED", revokedAt: now, pinHash: null },
          });
          await transaction.device.updateMany({
            where: { id: { in: profiles.map(({ deviceId }) => deviceId) } },
            data: {
              status: "REVOKED",
              revokedAt: now,
              revokedByMembershipId: actor.membershipId,
              revokeReason: reason,
            },
          });
          await transaction.activationChallenge.updateMany({
            where: {
              tenantId: actor.tenantId,
              membershipId: target.id,
              consumedAt: null,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });
        }

        await transaction.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorType: "USER",
            actorId: actor.userId,
            effectiveMembershipId: actor.membershipId,
            action:
              command.status === "DISABLED"
                ? "MEMBERSHIP_DISABLED"
                : "MEMBERSHIP_REACTIVATED",
            targetType: "Membership",
            targetId: target.id,
            result: "SUCCEEDED",
            reasonCode: reason,
            beforeSanitized: before,
            afterSanitized: { status: command.status, roles },
            correlationId: randomUUID(),
            occurredAt: now,
          },
        });

        return {
          id: target.id,
          tenantId: target.tenantId,
          userId: target.userId,
          displayName: target.user.displayName,
          status: command.status,
          roles,
          version: target.version + 1,
          requiresActivation: command.status === "ACTIVE",
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
}

interface LifecycleState {
  users: Array<{ id: string }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
    roles: string[];
    version: number;
    disabledAt: Date | null;
    disabledReason: string | null;
    disabledByMembershipId: string | null;
  }>;
  deviceProfiles: Array<{
    id: string;
    membershipId: string;
    status: "ACTIVE" | "REVOKED";
    pinHash: string | null;
  }>;
  sessions: Array<{
    id: string;
    membershipId: string;
    revokedAt: Date | null;
  }>;
  refreshCredentials: Array<{
    id: string;
    sessionId: string;
    tokenHash: string;
    revokedAt: Date | null;
  }>;
  challenges: Array<{
    id: string;
    membershipId: string;
    revokedAt: Date | null;
  }>;
  audits: Array<Record<string, unknown>>;
}

/** Test adapter for the transactional lifecycle and cross-tenant revocation boundary. */
export function createMembershipLifecycleHarness(options: {
  state: LifecycleState;
}): {
  changeStatus(input: {
    actorMembershipId: string;
    actorTenantId: string;
    targetMembershipId: string;
    expectedVersion: number;
    status: "ACTIVE" | "DISABLED";
    reason: string;
    now: Date;
  }): Promise<{
    membership: LifecycleState["memberships"][number];
    requiresActivation: boolean;
  }>;
} {
  return {
    async changeStatus(input) {
      await Promise.resolve();
      const actor = options.state.memberships.find(
        ({ id, tenantId }) =>
          id === input.actorMembershipId && tenantId === input.actorTenantId,
      );
      const target = options.state.memberships.find(
        ({ id, tenantId }) =>
          id === input.targetMembershipId && tenantId === input.actorTenantId,
      );
      if (
        actor === undefined ||
        actor.status !== "ACTIVE" ||
        !actor.roles.includes("owner_admin")
      ) {
        throw new MembershipMutationError("INSUFFICIENT_PERMISSION");
      }
      if (target === undefined) {
        throw new MembershipMutationError("RESOURCE_NOT_FOUND");
      }
      if (target.version !== input.expectedVersion) {
        throw new MembershipMutationError("STALE_STATE");
      }
      if (validatedReason(input.reason) !== input.reason.trim()) {
        throw new MembershipMutationError("VALIDATION_ERROR");
      }
      if (
        input.status === "DISABLED" &&
        target.status === "ACTIVE" &&
        target.roles.includes("owner_admin")
      ) {
        const owners = options.state.memberships.filter(
          ({ tenantId, status, roles }) =>
            tenantId === input.actorTenantId &&
            status === "ACTIVE" &&
            roles.includes("owner_admin"),
        ).length;
        if (owners <= 1) {
          throw new MembershipMutationError("LAST_ACTIVE_OWNER");
        }
      }

      target.status = input.status;
      target.version += 1;
      if (input.status === "DISABLED") {
        target.disabledAt = input.now;
        target.disabledReason = input.reason;
        target.disabledByMembershipId = input.actorMembershipId;
        for (const profile of options.state.deviceProfiles) {
          if (profile.membershipId === target.id) {
            profile.status = "REVOKED";
            profile.pinHash = null;
          }
        }
        const sessionIds = new Set<string>();
        for (const session of options.state.sessions) {
          if (session.membershipId === target.id) {
            session.revokedAt = input.now;
            sessionIds.add(session.id);
          }
        }
        for (const credential of options.state.refreshCredentials) {
          if (sessionIds.has(credential.sessionId)) {
            credential.revokedAt = input.now;
          }
        }
        for (const challenge of options.state.challenges) {
          if (challenge.membershipId === target.id) {
            challenge.revokedAt = input.now;
          }
        }
      } else {
        target.disabledAt = null;
        target.disabledReason = null;
        target.disabledByMembershipId = null;
      }
      options.state.audits.push({
        action:
          input.status === "DISABLED"
            ? "MEMBERSHIP_DISABLED"
            : "MEMBERSHIP_REACTIVATED",
        actorMembershipId: input.actorMembershipId,
        targetMembershipId: target.id,
        reason: input.reason,
        result: "SUCCEEDED",
        occurredAt: input.now.toISOString(),
      });
      return {
        membership: target,
        requiresActivation: input.status === "ACTIVE",
      };
    },
  };
}
