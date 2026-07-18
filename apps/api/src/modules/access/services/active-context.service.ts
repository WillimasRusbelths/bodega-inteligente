import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

export interface MembershipChoice {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly roles: readonly string[];
}

export interface MyContextResponse {
  readonly userId: string;
  readonly displayName: string;
  readonly activeContext: MembershipChoice | null;
  readonly memberships: readonly MembershipChoice[];
}

interface MembershipRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly tenant: { readonly name: string };
  readonly membershipRoles: ReadonlyArray<{
    readonly role: { readonly code: string };
  }>;
}

function toChoice(membership: MembershipRecord): MembershipChoice {
  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    tenantName: membership.tenant.name,
    roles: [
      ...new Set(membership.membershipRoles.map(({ role }) => role.code)),
    ].sort(),
  };
}

function activeMembershipQuery(userId: string) {
  return {
    where: {
      userId,
      status: "ACTIVE" as const,
      tenant: { status: "ACTIVE" as const },
    },
    include: {
      tenant: true,
      membershipRoles: { include: { role: true } },
    },
    orderBy: [{ tenantId: "asc" as const }, { id: "asc" as const }],
  };
}

/** Resolves only active Memberships and never merges roles across tenants. */
export class ActiveContextService {
  public constructor(private readonly prisma: PrismaModule) {}

  public listActiveMemberships(
    userId: string,
  ): Promise<readonly MembershipChoice[]> {
    return this.prisma.execute(async (client) => {
      const memberships = await client.membership.findMany(
        activeMembershipQuery(userId),
      );
      return memberships.map(toChoice);
    });
  }

  public getMyContext(
    sessionId: string,
    userId: string,
  ): Promise<MyContextResponse> {
    return this.prisma.transaction(async (transaction) => {
      const user = await transaction.user.findFirst({
        where: { id: userId, status: "ACTIVE" },
        select: { id: true, displayName: true },
      });
      const session = await transaction.session.findFirst({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          absoluteExpiresAt: { gt: new Date() },
        },
      });
      if (user === null || session === null) {
        throw new Error("The session is invalid or expired.");
      }
      const memberships = await transaction.membership.findMany(
        activeMembershipQuery(userId),
      );
      const choices = memberships.map(toChoice);

      let activeMembershipId = session.activeMembershipId;
      let tenantId = session.tenantId;
      if (
        activeMembershipId === null &&
        tenantId === null &&
        memberships.length === 1
      ) {
        const onlyMembership = memberships[0];
        if (onlyMembership !== undefined) {
          const selected = await transaction.session.updateMany({
            where: {
              id: session.id,
              activeMembershipId: null,
              tenantId: null,
            },
            data: {
              activeMembershipId: onlyMembership.id,
              tenantId: onlyMembership.tenantId,
            },
          });
          if (selected.count === 1) {
            activeMembershipId = onlyMembership.id;
            tenantId = onlyMembership.tenantId;
          }
        }
      }

      const activeContext =
        activeMembershipId === null || tenantId === null
          ? null
          : (choices.find(
              (choice) =>
                choice.membershipId === activeMembershipId &&
                choice.tenantId === tenantId,
            ) ?? null);
      return {
        userId: user.id,
        displayName: user.displayName,
        activeContext,
        memberships: choices,
      };
    });
  }
}

export interface MemoryActiveMembership {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly userId: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export function memoryActiveMemberships(
  memberships: readonly MemoryActiveMembership[],
  userId: string,
): readonly MemoryActiveMembership[] {
  return memberships.filter(
    (membership) =>
      membership.userId === userId && membership.status === "ACTIVE",
  );
}

export function memoryMembershipChoice(
  membership: MemoryActiveMembership,
): MembershipChoice {
  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    tenantName: membership.tenantName,
    roles: [...membership.roles],
  };
}
