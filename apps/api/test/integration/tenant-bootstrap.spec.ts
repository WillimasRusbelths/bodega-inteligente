import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface BootstrapCommand {
  readonly tenantName: string;
  readonly owner: { readonly displayName: string; readonly phoneE164: string };
  readonly idempotencyKey: string;
}

interface TechnicalActor {
  readonly id: string;
  readonly technicalAdmin: boolean;
}

interface BootstrapResult {
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

interface BootstrapDependencies {
  readonly transaction: <T>(
    work: (state: BootstrapState) => Promise<T>,
  ) => Promise<T>;
  readonly failAt?: FailurePoint;
}

interface BootstrapService {
  execute(
    command: BootstrapCommand,
    actor: TechnicalActor,
  ): Promise<BootstrapResult>;
}

interface BootstrapModule {
  createBootstrapTenantService(
    dependencies: BootstrapDependencies,
  ): BootstrapService;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/tenants/services/bootstrap-tenant.service.ts",
);

async function loadBootstrapModule(): Promise<BootstrapModule> {
  if (!existsSync(servicePath)) {
    throw new Error(
      "[T027-T028] bootstrap repositories and service are required for this integration suite.",
    );
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<BootstrapModule>;
  if (module.createBootstrapTenantService === undefined) {
    throw new Error(
      "[T028] createBootstrapTenantService export is required by the integration suite.",
    );
  }
  return { createBootstrapTenantService: module.createBootstrapTenantService };
}

function createTransactionHarness(
  seed?: Partial<BootstrapState>,
  failAt?: FailurePoint,
) {
  const state: BootstrapState = {
    users: [],
    tenants: [],
    memberships: [],
    audits: [],
    idempotency: [],
    ...structuredClone(seed ?? {}),
  };
  const dependencies: BootstrapDependencies = {
    ...(failAt === undefined ? {} : { failAt }),
    transaction: async <T>(work: (draft: BootstrapState) => Promise<T>) => {
      const draft = structuredClone(state);
      const result = await work(draft);
      Object.assign(state, draft);
      return result;
    },
  };
  return { state, dependencies };
}

const commandA: BootstrapCommand = {
  tenantName: "Synthetic Tenant A",
  owner: { displayName: "Synthetic Owner A", phoneE164: "+51900000001" },
  idempotencyKey: "synthetic-bootstrap-key-a",
};
const technicalActor: TechnicalActor = {
  id: "00000000-0000-4000-8000-000000000901",
  technicalAdmin: true,
};

async function setup(seed?: Partial<BootstrapState>, failAt?: FailurePoint) {
  const harness = createTransactionHarness(seed, failAt);
  const service = (await loadBootstrapModule()).createBootstrapTenantService(
    harness.dependencies,
  );
  return { ...harness, service };
}

describe("tenant bootstrap integration [T025; HU-001; FR-001, FR-002, FR-023; SC-002]", () => {
  it("creates Tenant, owner Membership and AuditEvent atomically", async () => {
    const { service, state } = await setup();
    await service.execute(commandA, technicalActor);
    expect(state.tenants).toHaveLength(1);
    expect(state.memberships).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
  });

  it("creates the global User when the normalized phone does not exist", async () => {
    const { service, state } = await setup();
    await service.execute(commandA, technicalActor);
    expect(state.users).toEqual([
      expect.objectContaining({ phoneE164: commandA.owner.phoneE164 }),
    ]);
  });

  it("reuses an existing global User without duplicating it", async () => {
    const existing = {
      id: "00000000-0000-4000-8000-000000000111",
      phoneE164: commandA.owner.phoneE164,
    };
    const { service, state } = await setup({ users: [existing] });
    const result = await service.execute(commandA, technicalActor);
    expect(state.users).toHaveLength(1);
    expect(result.userId).toBe(existing.id);
  });

  it("creates exactly one owner_admin Membership in the new tenant", async () => {
    const { service, state } = await setup();
    const result = await service.execute(commandA, technicalActor);
    expect(state.memberships).toEqual([
      expect.objectContaining({
        tenantId: result.tenantId,
        userId: result.userId,
        role: "owner_admin",
      }),
    ]);
  });

  it("does not assign unapproved bootstrap roles or permissions", async () => {
    const { service, state } = await setup();
    await service.execute(commandA, technicalActor);
    expect(state.memberships.flatMap((membership) => membership.role)).toEqual([
      "owner_admin",
    ]);
  });

  it("stores a sanitized TENANT_CREATED audit in the transaction", async () => {
    const { service, state } = await setup();
    const result = await service.execute(commandA, technicalActor);
    expect(state.audits).toEqual([
      { tenantId: result.tenantId, action: "TENANT_CREATED" },
    ]);
    expect(JSON.stringify(state.audits)).not.toContain(
      commandA.owner.phoneE164,
    );
  });

  it("stores the idempotent request scope and replayable result", async () => {
    const { service, state } = await setup();
    const result = await service.execute(commandA, technicalActor);
    expect(state.idempotency).toEqual([
      expect.objectContaining({
        actorId: technicalActor.id,
        key: commandA.idempotencyKey,
        result,
      }),
    ]);
  });

  it.each([
    "user",
    "tenant",
    "membership",
    "role",
    "audit",
    "idempotency",
  ] as const)(
    "rolls back every write when %s persistence fails",
    async (failurePoint) => {
      const { service, state } = await setup(undefined, failurePoint);
      await expect(
        service.execute(commandA, technicalActor),
      ).rejects.toBeDefined();
      expect(state).toEqual({
        users: [],
        tenants: [],
        memberships: [],
        audits: [],
        idempotency: [],
      });
    },
  );

  it("never leaves a Tenant without its first owner", async () => {
    const { service, state } = await setup(undefined, "membership");
    await expect(
      service.execute(commandA, technicalActor),
    ).rejects.toBeDefined();
    expect(state.tenants).toHaveLength(0);
  });

  it("rejects an actor that is not an authorized technical administrator", async () => {
    const { service, state } = await setup();
    await expect(
      service.execute(commandA, { ...technicalActor, technicalAdmin: false }),
    ).rejects.toBeDefined();
    expect(state.tenants).toHaveLength(0);
  });

  it("returns an equivalent result for an identical idempotent replay", async () => {
    const { service, state } = await setup();
    const first = await service.execute(commandA, technicalActor);
    const replay = await service.execute(commandA, technicalActor);
    expect(replay).toEqual(first);
    expect(state.tenants).toHaveLength(1);
  });

  it("rejects the same idempotency key with a different payload", async () => {
    const { service } = await setup();
    await service.execute(commandA, technicalActor);
    await expect(
      service.execute(
        { ...commandA, tenantName: "Synthetic Tenant Changed" },
        technicalActor,
      ),
    ).rejects.toBeDefined();
  });

  it("keeps Tenant A and Tenant B memberships isolated", async () => {
    const { service, state } = await setup();
    const resultA = await service.execute(commandA, technicalActor);
    const resultB = await service.execute(
      {
        ...commandA,
        tenantName: "Synthetic Tenant B",
        idempotencyKey: "synthetic-bootstrap-key-b",
      },
      technicalActor,
    );
    expect(resultA.tenantId).not.toBe(resultB.tenantId);
    expect(
      state.memberships.filter(({ tenantId }) => tenantId === resultA.tenantId),
    ).toHaveLength(1);
    expect(
      state.memberships.filter(({ tenantId }) => tenantId === resultB.tenantId),
    ).toHaveLength(1);
  });
});
