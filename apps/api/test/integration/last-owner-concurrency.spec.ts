import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface OwnerMembership {
  id: string;
  tenantId: string;
  status: "ACTIVE" | "DISABLED";
  roles: string[];
  version: number;
}

interface LastOwnerHarness {
  changeRoles(input: {
    actorMembershipId: string;
    targetMembershipId: string;
    roles: string[];
    expectedVersion: number;
    reason: string;
  }): Promise<OwnerMembership>;
  changeStatus(input: {
    actorMembershipId: string;
    targetMembershipId: string;
    status: "ACTIVE" | "DISABLED";
    expectedVersion: number;
    reason: string;
  }): Promise<OwnerMembership>;
}

interface LastOwnerModule {
  createLastOwnerConcurrencyHarness(options: {
    memberships: OwnerMembership[];
    audits: Array<Record<string, unknown>>;
    isolationLevels: string[];
  }): LastOwnerHarness;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/memberships/services/change-roles.service.ts",
);

async function loadHarness(): Promise<LastOwnerModule> {
  try {
    const module = (await import(
      pathToFileURL(servicePath).href
    )) as Partial<LastOwnerModule>;
    if (module.createLastOwnerConcurrencyHarness === undefined)
      throw new Error("missing export");
    return module as LastOwnerModule;
  } catch {
    throw new Error(
      "[T071-T072] Serializable last-owner protection is required by T069.",
    );
  }
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const ownerOne = "00000000-0000-4000-8000-000000000101";
const ownerTwo = "00000000-0000-4000-8000-000000000102";

function owner(id: string): OwnerMembership {
  return {
    id,
    tenantId: tenantA,
    status: "ACTIVE",
    roles: ["owner_admin"],
    version: 1,
  };
}

async function setup(count = 2) {
  const memberships = [owner(ownerOne)];
  if (count === 2) memberships.push(owner(ownerTwo));
  const audits: Array<Record<string, unknown>> = [];
  const isolationLevels: string[] = [];
  const module = await loadHarness();
  return {
    memberships,
    audits,
    isolationLevels,
    service: module.createLastOwnerConcurrencyHarness({
      memberships,
      audits,
      isolationLevels,
    }),
  };
}

describe("last active owner concurrency [T069; HU-005; FR-022, FR-033; SC-008]", () => {
  it("never leaves an active tenant without an active owner_admin", async () => {
    const { memberships, service } = await setup();
    await Promise.allSettled([
      service.changeRoles({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic concurrent withdrawal one",
      }),
      service.changeRoles({
        actorMembershipId: ownerTwo,
        targetMembershipId: ownerTwo,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic concurrent withdrawal two",
      }),
    ]);
    const activeOwners = memberships.filter(
      ({ status, roles }) =>
        status === "ACTIVE" && roles.includes("owner_admin"),
    );
    expect(activeOwners).toHaveLength(1);
  });

  it("allows one concurrent removal and safely rejects the other", async () => {
    const { service } = await setup();
    const results = await Promise.allSettled([
      service.changeRoles({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic concurrent withdrawal one",
      }),
      service.changeRoles({
        actorMembershipId: ownerTwo,
        targetMembershipId: ownerTwo,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic concurrent withdrawal two",
      }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "LAST_ACTIVE_OWNER" },
    });
  });

  it("uses serializable transactions for each sensitive attempt", async () => {
    const { service, isolationLevels } = await setup();
    await Promise.allSettled([
      service.changeRoles({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic serialized update one",
      }),
      service.changeRoles({
        actorMembershipId: ownerTwo,
        targetMembershipId: ownerTwo,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic serialized update two",
      }),
    ]);
    expect(isolationLevels).toEqual(["Serializable", "Serializable"]);
  });

  it("does not expose an intermediate zero-owner state", async () => {
    const { memberships, service } = await setup();
    const observations: number[] = [];
    const sample = (): number =>
      memberships.filter(
        ({ status, roles }) =>
          status === "ACTIVE" && roles.includes("owner_admin"),
      ).length;
    observations.push(sample());
    await Promise.allSettled([
      service
        .changeRoles({
          actorMembershipId: ownerOne,
          targetMembershipId: ownerOne,
          roles: ["seller"],
          expectedVersion: 1,
          reason: "Synthetic atomic update one",
        })
        .then(() => observations.push(sample())),
      service
        .changeRoles({
          actorMembershipId: ownerTwo,
          targetMembershipId: ownerTwo,
          roles: ["seller"],
          expectedVersion: 1,
          reason: "Synthetic atomic update two",
        })
        .then(
          () => observations.push(sample()),
          () => observations.push(sample()),
        ),
    ]);
    expect(observations.every((value) => value >= 1)).toBe(true);
  });

  it("rejects removing owner_admin from the only active owner", async () => {
    const { service } = await setup(1);
    await expect(
      service.changeRoles({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic forbidden owner removal",
      }),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_OWNER" });
  });

  it("rejects disabling the only active owner", async () => {
    const { service } = await setup(1);
    await expect(
      service.changeStatus({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        status: "DISABLED",
        expectedVersion: 1,
        reason: "Synthetic forbidden owner disable",
      }),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_OWNER" });
  });

  it("allows a change when another active owner remains", async () => {
    const { service } = await setup();
    await expect(
      service.changeRoles({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic allowed owner transition",
      }),
    ).resolves.toMatchObject({ roles: ["seller"], version: 2 });
  });

  it("audits only committed operations", async () => {
    const { service, audits } = await setup();
    await Promise.allSettled([
      service.changeRoles({
        actorMembershipId: ownerOne,
        targetMembershipId: ownerOne,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic audited update one",
      }),
      service.changeRoles({
        actorMembershipId: ownerTwo,
        targetMembershipId: ownerTwo,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic audited update two",
      }),
    ]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "MEMBERSHIP_ROLES_CHANGED",
      result: "SUCCEEDED",
    });
  });
});
