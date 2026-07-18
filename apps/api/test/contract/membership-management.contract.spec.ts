import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface MembershipRecord {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
  status: "ACTIVE" | "DISABLED";
  roles: string[];
  version: number;
}

interface MembershipContractHarness {
  listMembers(actor: Actor): Promise<{ items: MembershipRecord[] }>;
  replaceRoles(
    actor: Actor,
    membershipId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<{ body: MembershipRecord; etag: string }>;
  changeStatus(
    actor: Actor,
    membershipId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<{ body: MembershipRecord; etag: string }>;
}

interface Actor {
  readonly userId: string;
  readonly membershipId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

interface ContractModule {
  createMembershipManagementContractHarness(options: {
    memberships: MembershipRecord[];
  }): MembershipContractHarness;
}

const controllerPath = resolve(
  process.cwd(),
  "apps/api/src/modules/memberships/memberships.controller.ts",
);

async function loadContract(): Promise<ContractModule> {
  try {
    const module = (await import(
      pathToFileURL(controllerPath).href
    )) as Partial<ContractModule>;
    if (module.createMembershipManagementContractHarness === undefined)
      throw new Error("missing export");
    return module as ContractModule;
  } catch {
    throw new Error(
      "[T071-T073] Membership management contract implementation is required by T068.",
    );
  }
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const ownerA = "00000000-0000-4000-8000-000000000101";
const sellerA = "00000000-0000-4000-8000-000000000103";
const ownerB = "00000000-0000-4000-8000-000000000102";

const actorA: Actor = {
  userId: "00000000-0000-4000-8000-000000000011",
  membershipId: ownerA,
  tenantId: tenantA,
  roles: ["owner_admin"],
};

function membership(
  id: string,
  tenantId: string,
  roles: string[],
): MembershipRecord {
  return {
    id,
    tenantId,
    userId: `00000000-0000-4000-8000-${id.slice(-12)}`,
    displayName: `Synthetic ${id.slice(-3)}`,
    status: "ACTIVE",
    roles,
    version: 1,
  };
}

async function setup(): Promise<{
  state: MembershipRecord[];
  contract: MembershipContractHarness;
}> {
  const state = [
    membership(ownerA, tenantA, ["owner_admin"]),
    membership(sellerA, tenantA, ["seller"]),
    membership(ownerB, tenantB, ["owner_admin"]),
  ];
  const module = await loadContract();
  return {
    state,
    contract: module.createMembershipManagementContractHarness({
      memberships: state,
    }),
  };
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail.");
}

describe("membership management contract [T068; HU-005; FR-015..FR-017, FR-022]", () => {
  it("matches the approved OpenAPI operations, If-Match and schemas", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "specs/001-multi-tenant-access/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("operationId: listCurrentTenantMembers");
    expect(openapi).toContain("operationId: replaceMembershipRoles");
    expect(openapi).toContain("operationId: changeMembershipStatus");
    expect(openapi).toContain("#/components/parameters/IfMatch");
    expect(openapi).toContain("#/components/schemas/Membership");
  });

  it("lists only memberships from the active tenant", async () => {
    const { contract } = await setup();
    const page = await contract.listMembers(actorA);
    expect(page.items).toHaveLength(2);
    expect(page.items.every(({ tenantId }) => tenantId === tenantA)).toBe(true);
    expect(page.items.map(({ id }) => id)).not.toContain(ownerB);
  });

  it("returns the current role set without secret fields", async () => {
    const { contract } = await setup();
    const page = await contract.listMembers(actorA);
    expect(page.items.find(({ id }) => id === sellerA)?.roles).toEqual([
      "seller",
    ]);
    expect(JSON.stringify(page)).not.toMatch(
      /pin|phone|accessToken|refreshToken|secret/iu,
    );
  });

  it("replaces roles and increments version and ETag", async () => {
    const { contract } = await setup();
    const result = await contract.replaceRoles(actorA, sellerA, '"1"', {
      roles: ["seller", "inventory_manager"],
      reason: "Synthetic responsibility change",
    });
    expect(result.body.roles).toEqual(["seller", "inventory_manager"]);
    expect(result.body.version).toBe(2);
    expect(result.etag).toBe('"2"');
  });

  it("changes membership state and increments version", async () => {
    const { contract } = await setup();
    const result = await contract.changeStatus(actorA, sellerA, '"1"', {
      status: "DISABLED",
      reason: "Synthetic access withdrawal",
    });
    expect(result.body.status).toBe("DISABLED");
    expect(result.body.version).toBe(2);
    expect(result.etag).toBe('"2"');
  });

  it("requires If-Match for role and status mutations", async () => {
    const { contract } = await setup();
    await expect(
      contract.replaceRoles(actorA, sellerA, undefined, {
        roles: ["seller"],
        reason: "Synthetic reason",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      contract.changeStatus(actorA, sellerA, undefined, {
        status: "DISABLED",
        reason: "Synthetic reason",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns STALE_STATE when If-Match is outdated", async () => {
    const { contract } = await setup();
    await contract.replaceRoles(actorA, sellerA, '"1"', {
      roles: ["inventory_manager"],
      reason: "Synthetic first update",
    });
    await expect(
      contract.replaceRoles(actorA, sellerA, '"1"', {
        roles: ["seller"],
        reason: "Synthetic stale update",
      }),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
  });

  it("rejects unknown roles", async () => {
    const { contract } = await setup();
    await expect(
      contract.replaceRoles(actorA, sellerA, '"1"', {
        roles: ["administrator"],
        reason: "Synthetic invalid role",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects additional or client-supplied permission fields", async () => {
    const { contract } = await setup();
    await expect(
      contract.replaceRoles(actorA, sellerA, '"1"', {
        roles: ["seller"],
        reason: "Synthetic invalid payload",
        permissions: ["access.roles.manage"],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns the same safe response for foreign and missing memberships", async () => {
    const { contract } = await setup();
    const body = {
      roles: ["seller"],
      reason: "Synthetic isolated update",
    };
    const foreign = await capture(
      contract.replaceRoles(actorA, ownerB, '"1"', body),
    );
    const missing = await capture(
      contract.replaceRoles(
        actorA,
        "00000000-0000-4000-8000-000000000999",
        '"1"',
        body,
      ),
    );
    expect(JSON.stringify(foreign)).toBe(JSON.stringify(missing));
    expect(foreign).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("rejects membership administration by non-owner roles", async () => {
    const { contract } = await setup();
    await expect(
      contract.replaceRoles(
        { ...actorA, membershipId: sellerA, roles: ["seller"] },
        sellerA,
        '"1"',
        { roles: ["seller"], reason: "Synthetic unauthorized update" },
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_PERMISSION" });
  });
});
