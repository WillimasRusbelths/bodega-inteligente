import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { normalizeE164 } from "../../../common/validation/e164.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import {
  TechnicalAdminGuard,
  type TechnicalActor,
} from "../guards/technical-admin.guard.js";
import { TenantRepository } from "../repositories/tenant.repository.js";

export interface BootstrapCommand {
  readonly tenantName: string;
  readonly owner: { readonly displayName: string; readonly phoneE164: string };
  readonly idempotencyKey: string;
}

export interface BootstrapResult {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
}

interface BootstrapState {
  users: Array<{ id: string; phoneE164: string }>;
  tenants: Array<{ id: string; name: string }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    role: string;
  }>;
  audits: Array<{ tenantId: string; action: string }>;
  idempotency: Array<{
    actorId: string;
    key: string;
    request: string;
    result: BootstrapResult;
  }>;
}

type FailurePoint =
  | "user"
  | "tenant"
  | "membership"
  | "role"
  | "audit"
  | "idempotency";

export interface BootstrapDependencies {
  readonly transaction: <T>(
    work: (state: BootstrapState) => Promise<T>,
  ) => Promise<T>;
  readonly failAt?: FailurePoint;
}

const bootstrapOperation = "CREATE_TENANT_WITH_FIRST_OWNER";
const ownerRoleCode = "owner_admin";
const ownerPermissions = Object.freeze([
  { code: "access.memberships.manage", domain: "access" },
  { code: "access.roles.manage", domain: "access" },
  { code: "access.audit.read", domain: "audit" },
]);

function canonicalRequest(command: BootstrapCommand): string {
  return JSON.stringify({
    tenantName: command.tenantName.trim(),
    owner: {
      displayName: command.owner.displayName.trim(),
      phoneE164: normalizeE164(command.owner.phoneE164),
    },
  });
}

function failAt(
  dependencies: BootstrapDependencies,
  point: FailurePoint,
): void {
  if (dependencies.failAt === point)
    throw new Error(`Synthetic ${point} persistence failure.`);
}

/** Acceptance-test adapter using the same transaction and idempotency semantics as persistence. */
export function createBootstrapTenantService(
  dependencies: BootstrapDependencies,
): {
  execute(
    command: BootstrapCommand,
    actor: TechnicalActor,
  ): Promise<BootstrapResult>;
} {
  const guard = new TechnicalAdminGuard();
  return {
    execute: async (command, actor) => {
      guard.assertAuthorized(actor);
      const request = canonicalRequest(command);
      return dependencies.transaction(async (state) => {
        await Promise.resolve();
        const replay = state.idempotency.find(
          (entry) =>
            entry.actorId === actor.id && entry.key === command.idempotencyKey,
        );
        if (replay !== undefined) {
          if (replay.request !== request)
            throw new Error("The idempotency request conflicts.");
          return replay.result;
        }

        failAt(dependencies, "user");
        const phoneE164 = normalizeE164(command.owner.phoneE164);
        let user = state.users.find(
          (candidate) => candidate.phoneE164 === phoneE164,
        );
        if (user === undefined) {
          user = { id: randomUUID(), phoneE164 };
          state.users.push(user);
        }

        failAt(dependencies, "tenant");
        const tenant = { id: randomUUID(), name: command.tenantName.trim() };
        state.tenants.push(tenant);

        failAt(dependencies, "membership");
        const membership = {
          id: randomUUID(),
          tenantId: tenant.id,
          userId: user.id,
          role: ownerRoleCode,
        };
        state.memberships.push(membership);

        failAt(dependencies, "role");
        failAt(dependencies, "audit");
        state.audits.push({ tenantId: tenant.id, action: "TENANT_CREATED" });

        failAt(dependencies, "idempotency");
        const result = {
          tenantId: tenant.id,
          userId: user.id,
          membershipId: membership.id,
        };
        state.idempotency.push({
          actorId: actor.id,
          key: command.idempotencyKey,
          request,
          result,
        });
        return result;
      });
    },
  };
}

function sha256(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash("sha256").update(value, "utf8").digest());
}

function parseStoredResult(
  value: Prisma.JsonValue | null,
): BootstrapResult | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const source = value as Record<string, Prisma.JsonValue>;
  return typeof source["tenantId"] === "string" &&
    typeof source["userId"] === "string" &&
    typeof source["membershipId"] === "string"
    ? {
        tenantId: source["tenantId"],
        userId: source["userId"],
        membershipId: source["membershipId"],
      }
    : undefined;
}

export class BootstrapTenantService {
  readonly #guard = new TechnicalAdminGuard();

  public constructor(
    private readonly prisma: PrismaModule,
    private readonly users: UserRepository = new UserRepository(),
    private readonly tenants: TenantRepository = new TenantRepository(),
  ) {}

  public async execute(
    command: BootstrapCommand,
    actor: TechnicalActor,
  ): Promise<BootstrapResult> {
    this.#guard.assertAuthorized(actor);
    const request = canonicalRequest(command);
    const keyHash = sha256(command.idempotencyKey);
    const requestHash = sha256(request);

    return this.prisma.transaction(async (transaction) => {
      const previous = await transaction.idempotencyRecord.findFirst({
        where: {
          scopeActorId: actor.id,
          tenantId: null,
          operation: bootstrapOperation,
          idempotencyKeyHash: keyHash,
        },
      });
      if (previous !== null) {
        if (!Buffer.from(previous.requestHash).equals(requestHash)) {
          throw new Error("The idempotency request conflicts.");
        }
        const result = parseStoredResult(previous.responseBodySanitized);
        if (result === undefined)
          throw new Error("The stored idempotency result is unavailable.");
        return result;
      }

      const user = await this.users.findOrCreateGlobalUser(transaction, {
        displayName: command.owner.displayName.trim(),
        phoneE164: command.owner.phoneE164,
      });
      const tenant = await this.tenants.create(transaction, {
        name: command.tenantName.trim(),
        createdByTechnicalAdminId: actor.id,
      });
      const membership = await transaction.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });
      const role = await transaction.role.upsert({
        where: { code: ownerRoleCode },
        update: { name: "Owner administrator", catalogVersion: 1 },
        create: {
          code: ownerRoleCode,
          name: "Owner administrator",
          catalogVersion: 1,
        },
      });
      for (const permissionDefinition of ownerPermissions) {
        const permission = await transaction.permission.upsert({
          where: { code: permissionDefinition.code },
          update: { domain: permissionDefinition.domain },
          create: permissionDefinition,
        });
        await transaction.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
      await transaction.membershipRole.create({
        data: {
          tenantId: tenant.id,
          membershipId: membership.id,
          roleId: role.id,
          assignedByMembershipId: membership.id,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorType: "TECHNICAL_ADMIN",
          actorId: actor.id,
          action: "TENANT_CREATED",
          targetType: "Tenant",
          targetId: tenant.id,
          result: "SUCCEEDED",
          correlationId: randomUUID(),
          afterSanitized: { status: tenant.status },
        },
      });
      const result = {
        tenantId: tenant.id,
        userId: user.id,
        membershipId: membership.id,
      };
      await transaction.idempotencyRecord.create({
        data: {
          scopeActorId: actor.id,
          operation: bootstrapOperation,
          idempotencyKeyHash: keyHash,
          requestHash,
          responseStatus: 201,
          responseBodySanitized: result,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return result;
    });
  }
}
