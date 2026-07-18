import { PrismaClient, type Membership, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import { TenantRepository } from "../../src/infrastructure/prisma/tenant-repository.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { ChangeRolesService } from "../../src/modules/memberships/services/change-roles.service.js";
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
  if (value === undefined) throw new Error("T129 requires DATABASE_URL.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    database !== "bodegia_test"
  ) {
    throw new Error(
      "T129 refuses non-local or non-exclusive databases; expected local bodegia_test.",
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

async function bootstrap(suffix: "A" | "B") {
  return new BootstrapTenantService(prisma).execute(
    {
      tenantName: `Synthetic constraint tenant ${suffix}`,
      owner: {
        displayName: `Synthetic constraint owner ${suffix}`,
        phoneE164: suffix === "A" ? "+51900000301" : "+51900000302",
      },
      idempotencyKey: `00000000-0000-4000-8000-00000000020${suffix === "A" ? "1" : "2"}`,
    },
    technicalActor,
  );
}

function contextFor(
  tenantId: string,
  membershipId: string,
  userId: string,
): TenantContext {
  return createTenantContextHarness({
    sessionId: `session-${tenantId}`,
    userId,
    tenantId,
    membershipId,
    contextVersion: 1,
    roles: ["owner_admin"],
    permissions: [...ownerPermissions],
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
  const [row] = identity;
  expect(row).toBeDefined();
  if (row === undefined) throw new Error("PostgreSQL identity row is missing.");
  expect(row.database).toBe("bodegia_test");
  expect(row.user).toBe("bodegia_test");
  expect(row.version).toMatch(/^16\.14\b/u);
});

beforeEach(async () => truncateFunctionalTables());

afterAll(async () => {
  if (client !== undefined) {
    await truncateFunctionalTables();
    await client.$disconnect();
  }
});

describe("cross-tenant persistence constraints [T129; HU-007; FR-018..FR-020]", () => {
  it("enforces tenant-scoped unique keys and compound membership relations", async () => {
    const tenantA = await bootstrap("A");
    const tenantB = await bootstrap("B");
    const sharedUser = await client.user.create({
      data: {
        displayName: "Synthetic shared identity",
        phoneE164: "+51900000303",
      },
    });
    const membershipB = await client.membership.create({
      data: {
        tenantId: tenantB.tenantId,
        userId: sharedUser.id,
        status: "ACTIVE",
      },
    });
    await expect(
      client.membership.create({
        data: {
          tenantId: tenantA.tenantId,
          userId: sharedUser.id,
          status: "ACTIVE",
        },
      }),
    ).resolves.toBeDefined();
    await expect(
      client.membership.create({
        data: {
          tenantId: tenantA.tenantId,
          userId: sharedUser.id,
          status: "ACTIVE",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const role = await client.role.upsert({
      where: { code: "seller" },
      update: { name: "Seller", catalogVersion: 1 },
      create: { code: "seller", name: "Seller", catalogVersion: 1 },
    });
    await expect(
      client.membershipRole.create({
        data: {
          tenantId: tenantA.tenantId,
          membershipId: membershipB.id,
          roleId: role.id,
          assignedByMembershipId: tenantA.membershipId,
        },
      }),
    ).rejects.toBeDefined();
    expect(
      await client.membershipRole.count({
        where: { tenantId: tenantA.tenantId, membershipId: membershipB.id },
      }),
    ).toBe(0);
  });

  it("does not read or mutate Tenant B rows from Tenant A queries", async () => {
    const tenantA = await bootstrap("A");
    const tenantB = await bootstrap("B");
    const before = await client.membership.findUnique({
      where: {
        tenantId_id: { tenantId: tenantB.tenantId, id: tenantB.membershipId },
      },
    });
    expect(before).not.toBeNull();
    const visible = await client.membership.findMany({
      where: { tenantId: tenantA.tenantId },
    });
    expect(visible.every(({ tenantId }) => tenantId === tenantA.tenantId)).toBe(
      true,
    );
    await expect(
      client.membership.findFirst({
        where: { tenantId: tenantA.tenantId, id: tenantB.membershipId },
      }),
    ).resolves.toBeNull();
    await expect(
      client.membership.updateMany({
        where: { tenantId: tenantA.tenantId, id: tenantB.membershipId },
        data: { version: { increment: 1 } },
      }),
    ).resolves.toMatchObject({ count: 0 });
    const after = await client.membership.findUnique({
      where: {
        tenantId_id: { tenantId: tenantB.tenantId, id: tenantB.membershipId },
      },
    });
    expect(after).toEqual(before);

    await expect(
      new ChangeRolesService(prisma).execute(
        {
          membershipId: tenantB.membershipId,
          roles: ["seller"],
          expectedVersion: 1,
          reason: "Synthetic cross tenant attempt",
        },
        {
          userId: tenantA.userId,
          membershipId: tenantA.membershipId,
          tenantId: tenantA.tenantId,
          permissions: ownerPermissions,
        },
      ),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("rolls back a nested cross-tenant relation and requires TenantContext", async () => {
    const tenantA = await bootstrap("A");
    const tenantB = await bootstrap("B");
    const seller = await client.role.upsert({
      where: { code: "seller" },
      update: { name: "Seller", catalogVersion: 1 },
      create: { code: "seller", name: "Seller", catalogVersion: 1 },
    });
    const before = await client.membershipRole.count();
    await expect(
      prisma.transaction(async (transaction) => {
        await transaction.membershipRole.create({
          data: {
            tenantId: tenantA.tenantId,
            membershipId: tenantA.membershipId,
            roleId: seller.id,
            assignedByMembershipId: tenantA.membershipId,
          },
        });
        await transaction.membershipRole.create({
          data: {
            tenantId: tenantA.tenantId,
            membershipId: tenantB.membershipId,
            roleId: seller.id,
            assignedByMembershipId: tenantA.membershipId,
          },
        });
      }),
    ).rejects.toBeDefined();
    expect(await client.membershipRole.count()).toBe(before);

    const repository = new TenantRepository<
      Membership,
      Prisma.MembershipUpdateManyMutationInput
    >(prisma, (connection) => connection.membership);
    expect(() =>
      repository.findById(
        undefined as unknown as TenantContext,
        tenantA.membershipId,
      ),
    ).toThrow("The session is invalid or expired.");
    const contextA = contextFor(
      tenantA.tenantId,
      tenantA.membershipId,
      tenantA.userId,
    );
    await expect(
      repository.findById(contextA, tenantB.membershipId),
    ).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});
