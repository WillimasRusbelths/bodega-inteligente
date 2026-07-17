import { randomUUID } from "node:crypto";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import { TenantResourceNotFoundError } from "../guards/authorization-errors.js";
import type { TokenService } from "../../auth/services/token.service.js";

export interface TenantSelectionResponse {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresInSeconds: number;
  readonly sessionExpiresAt: Date;
  readonly activeTenant: {
    readonly membershipId: string;
    readonly tenantId: string;
    readonly tenantName: string;
    readonly roles: readonly string[];
    readonly capabilities: readonly string[];
  };
  readonly contextVersion: number;
}

/** Atomically replaces active tenant context without touching refresh state. */
export class SelectTenantService {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly tokens: TokenService,
  ) {}

  public select(input: {
    readonly sessionId: string;
    readonly userId: string;
    readonly membershipId: string;
    readonly now?: Date;
  }): Promise<TenantSelectionResponse> {
    const now = input.now ?? new Date();
    return this.prisma.transaction(async (transaction) => {
      const session = await transaction.session.findFirst({
        where: {
          id: input.sessionId,
          userId: input.userId,
          revokedAt: null,
          absoluteExpiresAt: { gt: now },
          user: { status: "ACTIVE" },
        },
      });
      const membership = await transaction.membership.findFirst({
        where: {
          id: input.membershipId,
          userId: input.userId,
          status: "ACTIVE",
          tenant: { status: "ACTIVE" },
        },
        include: {
          tenant: true,
          membershipRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      });
      if (session === null || membership === null) {
        throw new TenantResourceNotFoundError();
      }

      const contextVersion = session.contextVersion + 1;
      const changed = await transaction.session.updateMany({
        where: {
          id: session.id,
          userId: input.userId,
          contextVersion: session.contextVersion,
          revokedAt: null,
          absoluteExpiresAt: { gt: now },
        },
        data: {
          tenantId: membership.tenantId,
          activeMembershipId: membership.id,
          contextVersion,
          lastActivityAt: now,
        },
      });
      if (changed.count !== 1) throw new TenantResourceNotFoundError();

      const roles = [
        ...new Set(membership.membershipRoles.map(({ role }) => role.code)),
      ].sort();
      const capabilities = [
        ...new Set(
          membership.membershipRoles.flatMap(({ role }) =>
            role.rolePermissions.map(({ permission }) => permission.code),
          ),
        ),
      ].sort();
      await transaction.auditEvent.create({
        data: {
          tenantId: membership.tenantId,
          actorType: "USER",
          actorId: input.userId,
          effectiveMembershipId: membership.id,
          sessionId: session.id,
          action: "ACTIVE_TENANT_CHANGED",
          targetType: "Session",
          targetId: session.id,
          result: "SUCCEEDED",
          correlationId: randomUUID(),
          beforeSanitized: {
            tenantId: session.tenantId,
            membershipId: session.activeMembershipId,
            contextVersion: session.contextVersion,
          },
          afterSanitized: {
            tenantId: membership.tenantId,
            membershipId: membership.id,
            contextVersion,
          },
        },
      });

      const access = this.tokens.issueAccessToken({
        sessionId: session.id,
        userId: session.userId,
        authVersion: session.authVersion,
        contextVersion,
        tenantId: membership.tenantId,
        membershipId: membership.id,
        now,
      });
      return {
        accessToken: access.token,
        tokenType: "Bearer",
        expiresInSeconds: Math.floor(
          (access.expiresAt.getTime() - now.getTime()) / 1_000,
        ),
        sessionExpiresAt: session.absoluteExpiresAt,
        activeTenant: {
          membershipId: membership.id,
          tenantId: membership.tenantId,
          tenantName: membership.tenant.name,
          roles,
          capabilities,
        },
        contextVersion,
      };
    });
  }
}
