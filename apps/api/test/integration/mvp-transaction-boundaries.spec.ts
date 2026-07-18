import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import { createPhoneBindingService } from "../../src/modules/activation/crypto/phone-binding.service.js";
import { ConsumeActivationService } from "../../src/modules/activation/services/consume-activation.service.js";
import { IssueActivationService } from "../../src/modules/activation/services/issue-activation.service.js";
import { ChangeMembershipStatusService } from "../../src/modules/memberships/services/change-membership-status.service.js";
import { ChangeRolesService } from "../../src/modules/memberships/services/change-roles.service.js";
import { CreateMembershipService } from "../../src/modules/memberships/services/create-membership.service.js";
import { BootstrapTenantService } from "../../src/modules/tenants/services/bootstrap-tenant.service.js";

const databaseUrl = process.env["DATABASE_URL"];
const technicalActor = {
  id: "00000000-0000-4000-8000-000000000901",
  technicalAdmin: true,
} as const;
const ownerPermissions = [
  "access.memberships.manage",
  "access.roles.manage",
] as const;

let client: PrismaClient;
let prisma: PrismaModule;

function assertExclusiveLocalTestDatabase(value: string | undefined): string {
  if (value === undefined) throw new Error("T120 requires DATABASE_URL.");
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (!local || database !== "bodegia_test") {
    throw new Error(
      "T120 refuses non-local or non-exclusive databases; expected local bodegia_test.",
    );
  }
  return value;
}

async function truncateFunctionalTables(): Promise<void> {
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshCredential", "Session", "ActivationManualAlias",
      "ActivationChallenge", "DeviceProfile", "Device", "AuditEvent",
      "IdempotencyRecord", "MembershipRole", "RolePermission", "Permission",
      "Role", "Membership", "Tenant", "User"
    RESTART IDENTITY CASCADE
  `);
}

async function bootstrap(
  suffix: "A" | "B",
  phone: string,
): Promise<{ tenantId: string; userId: string; membershipId: string }> {
  return new BootstrapTenantService(prisma).execute(
    {
      tenantName: `Synthetic PostgreSQL Tenant ${suffix}`,
      owner: {
        displayName: `Synthetic PostgreSQL Owner ${suffix}`,
        phoneE164: phone,
      },
      idempotencyKey: `00000000-0000-4000-8000-00000000010${suffix === "A" ? "1" : "2"}`,
    },
    technicalActor,
  );
}

async function seedRole(code: "inventory_manager" | "seller"): Promise<void> {
  await client.role.upsert({
    where: { code },
    update: { name: code, catalogVersion: 1 },
    create: { code, name: code, catalogVersion: 1 },
  });
}

beforeAll(async () => {
  const safeUrl = assertExclusiveLocalTestDatabase(databaseUrl);
  client = new PrismaClient({ datasources: { db: { url: safeUrl } } });
  prisma = new PrismaModule(client);
  const identity = await client.$queryRaw<
    Array<{ database: string; user: string; version: string }>
  >`
    SELECT current_database() AS database, current_user AS user,
           current_setting('server_version') AS version
  `;
  expect(identity).toEqual([
    expect.objectContaining({
      database: "bodegia_test",
      user: "bodegia_test",
      version: "16.14",
    }),
  ]);
});

beforeEach(async () => {
  await truncateFunctionalTables();
});

afterAll(async () => {
  if (client !== undefined) {
    await truncateFunctionalTables();
    await client.$disconnect();
  }
});

describe("MVP PostgreSQL transaction boundaries [T120]", () => {
  it("bootstraps Tenant and first owner with RBAC, audit and idempotency atomically", async () => {
    const result = await bootstrap("A", "+51900000101");
    const tenant = await client.tenant.findUnique({
      where: { id: result.tenantId },
    });
    const membership = await client.membership.findUnique({
      where: {
        tenantId_id: { tenantId: result.tenantId, id: result.membershipId },
      },
      include: { membershipRoles: { include: { role: true } } },
    });
    expect(tenant).toMatchObject({ status: "ACTIVE" });
    expect(membership).toMatchObject({
      userId: result.userId,
      status: "ACTIVE",
    });
    expect(membership?.membershipRoles.map(({ role }) => role.code)).toEqual([
      "owner_admin",
    ]);
    expect(
      await client.auditEvent.count({
        where: { tenantId: result.tenantId, action: "TENANT_CREATED" },
      }),
    ).toBe(1);
    expect(
      await client.idempotencyRecord.count({
        where: { scopeActorId: technicalActor.id },
      }),
    ).toBe(1);
  });

  it("issues and consumes one activation with one Device/Profile and transactional audits", async () => {
    const owner = await bootstrap("A", "+51900000102");
    const phoneBinding = createPhoneBindingService({
      currentVersion: "test-v1",
      keys: new Map([
        ["test-v1", Buffer.from("synthetic-phone-binding-key-32b")],
      ]),
    });
    const issued = await new IssueActivationService(
      prisma,
      phoneBinding,
    ).execute({
      tenantId: owner.tenantId,
      membershipId: owner.membershipId,
      issuedByMembershipId: owner.membershipId,
      phoneE164: "+51900000102",
      purpose: "DEVICE_REACTIVATION",
    });
    const consumer = new ConsumeActivationService(prisma, phoneBinding);
    const results = await Promise.allSettled([
      consumer.execute({
        phoneE164: "+51900000102",
        credential: { type: "QR_SECRET", value: issued.qrSecret },
        installationId: "synthetic-installation-a",
        platform: "ANDROID",
        appVersion: "0.0.0-test",
        deviceCredential: "synthetic-device-credential-a",
        requestContext: { ip: "127.0.0.1" },
      }),
      consumer.execute({
        phoneE164: "+51900000102",
        credential: { type: "MANUAL_CODE", value: issued.manualCode },
        installationId: "synthetic-installation-b",
        platform: "ANDROID",
        appVersion: "0.0.0-test",
        deviceCredential: "synthetic-device-credential-b",
        requestContext: { ip: "127.0.0.2" },
      }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(await client.device.count()).toBe(1);
    expect(await client.deviceProfile.count()).toBe(1);
    expect(
      await client.activationChallenge.count({ where: { status: "CONSUMED" } }),
    ).toBe(1);
    expect(
      await client.auditEvent.count({
        where: {
          tenantId: owner.tenantId,
          action: { in: ["ACTIVATION_ISSUED", "ACTIVATION_CONSUMED"] },
        },
      }),
    ).toBe(2);
  });

  it("commits role change and membership revocation with their AuditEvent", async () => {
    const owner = await bootstrap("A", "+51900000103");
    await seedRole("seller");
    await seedRole("inventory_manager");
    const target = await new CreateMembershipService(prisma).execute(
      {
        displayName: "Synthetic Seller",
        phoneE164: "+51900000104",
        role: "seller",
      },
      {
        userId: owner.userId,
        membershipId: owner.membershipId,
        tenantId: owner.tenantId,
        permissions: ownerPermissions,
      },
    );
    const actor = {
      userId: owner.userId,
      membershipId: owner.membershipId,
      tenantId: owner.tenantId,
      permissions: ownerPermissions,
    };
    const changed = await new ChangeRolesService(prisma).execute(
      {
        membershipId: target.id,
        roles: ["inventory_manager"],
        expectedVersion: 1,
        reason: "Synthetic approved role change",
      },
      actor,
    );
    const disabled = await new ChangeMembershipStatusService(prisma).execute(
      {
        membershipId: target.id,
        status: "DISABLED",
        expectedVersion: changed.version,
        reason: "Synthetic access revoked",
      },
      actor,
    );
    expect(disabled).toMatchObject({ status: "DISABLED", version: 3 });
    expect(
      await client.auditEvent.count({
        where: {
          tenantId: owner.tenantId,
          action: { in: ["MEMBERSHIP_ROLES_CHANGED", "MEMBERSHIP_DISABLED"] },
        },
      }),
    ).toBe(2);
  });

  it("protects the last owner and rejects cross-tenant mutations without partial writes", async () => {
    const tenantA = await bootstrap("A", "+51900000105");
    const tenantB = await bootstrap("B", "+51900000106");
    const actorA = {
      userId: tenantA.userId,
      membershipId: tenantA.membershipId,
      tenantId: tenantA.tenantId,
      permissions: ownerPermissions,
    };
    const service = new ChangeRolesService(prisma);
    await expect(
      service.execute(
        {
          membershipId: tenantA.membershipId,
          roles: ["seller"],
          expectedVersion: 1,
          reason: "Synthetic forbidden last owner removal",
        },
        actorA,
      ),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_OWNER" });
    await expect(
      service.execute(
        {
          membershipId: tenantB.membershipId,
          roles: ["seller"],
          expectedVersion: 1,
          reason: "Synthetic cross tenant attempt",
        },
        actorA,
      ),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    const memberships = await client.membership.findMany({
      orderBy: { tenantId: "asc" },
    });
    expect(memberships).toHaveLength(2);
    expect(
      memberships.every(
        ({ status, version }) => status === "ACTIVE" && version === 1,
      ),
    ).toBe(true);
    expect(
      await client.auditEvent.count({
        where: { action: "MEMBERSHIP_ROLES_CHANGED" },
      }),
    ).toBe(0);
  });

  it("rolls back all business rows when AuditEvent insertion fails", async () => {
    await expect(
      prisma.transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            displayName: "Synthetic Rollback User",
            phoneE164: "+51900000107",
          },
        });
        const tenant = await transaction.tenant.create({
          data: {
            name: "Synthetic Rollback Tenant",
            createdByTechnicalAdminId: technicalActor.id,
          },
        });
        await transaction.membership.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: tenant.id,
            actorType: "TECHNICAL_ADMIN",
            action: "SYNTHETIC_AUDIT_FAILURE",
            targetType: "Tenant",
            result: "SUCCEEDED",
            correlationId: "not-a-uuid",
          },
        });
      }),
    ).rejects.toBeDefined();
    expect(await client.user.count()).toBe(0);
    expect(await client.tenant.count()).toBe(0);
    expect(await client.membership.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });

  it("rolls back an explicitly induced mid-transaction failure", async () => {
    await expect(
      prisma.transaction(async (transaction) => {
        await transaction.tenant.create({
          data: {
            name: "Synthetic Induced Failure",
            createdByTechnicalAdminId: technicalActor.id,
          },
        });
        throw new Error("Synthetic induced transaction failure.");
      }),
    ).rejects.toThrow("Synthetic induced transaction failure");
    expect(await client.tenant.count()).toBe(0);
  });
});
