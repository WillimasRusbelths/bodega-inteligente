import { randomUUID } from "node:crypto";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";

const approvedRoles = new Set(["owner_admin", "seller", "inventory_manager"]);

export interface MembershipActorContext {
  readonly userId: string;
  readonly membershipId: string;
  readonly tenantId: string;
  readonly permissions: readonly string[];
}

export interface CreateMembershipCommand {
  readonly displayName: string;
  readonly phoneE164: string;
  readonly role: string;
}

export interface CreatedMembership {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: "PENDING_ACTIVATION";
  readonly roles: readonly string[];
  readonly version: number;
}

export class CreateMembershipService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly users: UserRepository = new UserRepository(),
  ) {}

  public execute(
    command: CreateMembershipCommand,
    actor: MembershipActorContext,
  ): Promise<CreatedMembership> {
    if (!actor.permissions.includes("access.memberships.manage")) {
      throw new Error("The operation is not allowed.");
    }
    if (!approvedRoles.has(command.role)) {
      throw new Error("The request is invalid.");
    }

    return this.prisma.transaction(async (transaction) => {
      const actorMembership = await transaction.membership.findUnique({
        where: {
          tenantId_id: { tenantId: actor.tenantId, id: actor.membershipId },
        },
      });
      if (
        actorMembership === null ||
        actorMembership.userId !== actor.userId ||
        actorMembership.status !== "ACTIVE"
      ) {
        throw new Error("The operation is not allowed.");
      }

      const user = await this.users.findOrCreateGlobalUser(transaction, {
        displayName: command.displayName.trim(),
        phoneE164: command.phoneE164,
      });
      const existing = await transaction.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: actor.tenantId, userId: user.id },
        },
      });
      if (existing !== null)
        throw new Error("The resource changed. Reload and try again.");

      const role = await transaction.role.findUnique({
        where: { code: command.role },
      });
      if (role === null) throw new Error("The request is invalid.");
      const membership = await transaction.membership.create({
        data: {
          tenantId: actor.tenantId,
          userId: user.id,
          status: "PENDING_ACTIVATION",
          createdByMembershipId: actor.membershipId,
        },
      });
      await transaction.membershipRole.create({
        data: {
          tenantId: actor.tenantId,
          membershipId: membership.id,
          roleId: role.id,
          assignedByMembershipId: actor.membershipId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorType: "USER",
          actorId: actor.userId,
          effectiveMembershipId: actor.membershipId,
          action: "MEMBERSHIP_CREATED",
          targetType: "Membership",
          targetId: membership.id,
          result: "SUCCEEDED",
          correlationId: randomUUID(),
          afterSanitized: { status: membership.status, roles: [command.role] },
        },
      });
      return {
        id: membership.id,
        tenantId: actor.tenantId,
        userId: user.id,
        displayName: user.displayName,
        status: "PENDING_ACTIVATION",
        roles: [command.role],
        version: membership.version,
      };
    });
  }
}
