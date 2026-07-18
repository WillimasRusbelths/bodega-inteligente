import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface TenantContextView {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly contextVersion: number;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

interface TenantRepositoryState {
  records: Array<{
    id: string;
    tenantId: string;
    value: string;
    childIds: string[];
  }>;
  filters: unknown[];
}

interface TenantRepositoryHarness {
  findById(
    context: TenantContextView,
    id: string,
  ): Promise<{ readonly id: string; readonly tenantId: string; value: string }>;
  updateById(
    context: TenantContextView,
    id: string,
    value: string,
  ): Promise<void>;
  connectChild(
    context: TenantContextView,
    parentId: string,
    childId: string,
  ): Promise<void>;
  transaction<T>(
    context: TenantContextView,
    work: (
      repository: TenantRepositoryHarness,
      transactionContext: TenantContextView,
    ) => Promise<T>,
  ): Promise<T>;
}

interface TenantRepositoryModule {
  createTenantRepositoryHarness(options: {
    readonly state: TenantRepositoryState;
  }): TenantRepositoryHarness;
}

interface TenantContextModule {
  createTenantContextHarness(input: TenantContextView): TenantContextView;
}

const repositoryPath = resolve(
  process.cwd(),
  "apps/api/src/infrastructure/prisma/tenant-repository.ts",
);
const contextPath = resolve(
  process.cwd(),
  "apps/api/src/modules/access/context/tenant-context.ts",
);

async function loadModules(): Promise<{
  repository: TenantRepositoryModule;
  context: TenantContextModule;
}> {
  if (!existsSync(repositoryPath) || !existsSync(contextPath)) {
    throw new Error(
      "[T064-T065] Immutable TenantContext and tenant-aware Prisma repository are required by T061.",
    );
  }
  const repository = (await import(
    pathToFileURL(repositoryPath).href
  )) as Partial<TenantRepositoryModule>;
  const context = (await import(
    pathToFileURL(contextPath).href
  )) as Partial<TenantContextModule>;
  if (
    repository.createTenantRepositoryHarness === undefined ||
    context.createTenantContextHarness === undefined
  ) {
    throw new Error(
      "[T064-T065] Tenant-aware test boundaries are required by T061.",
    );
  }
  return {
    repository: {
      createTenantRepositoryHarness: repository.createTenantRepositoryHarness,
    },
    context: { createTenantContextHarness: context.createTenantContextHarness },
  };
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const recordA = "00000000-0000-4000-8000-000000000801";
const recordB = "00000000-0000-4000-8000-000000000802";
const missingRecord = "00000000-0000-4000-8000-000000000899";

function contextInput(tenantId = tenantA): TenantContextView {
  return {
    sessionId: "00000000-0000-4000-8000-000000000401",
    userId: "00000000-0000-4000-8000-000000000011",
    tenantId,
    membershipId:
      tenantId === tenantA
        ? "00000000-0000-4000-8000-000000000101"
        : "00000000-0000-4000-8000-000000000102",
    contextVersion: 2,
    roles: ["seller"],
    permissions: ["records.read", "records.write"],
  };
}

function createState(): TenantRepositoryState {
  return {
    records: [
      { id: recordA, tenantId: tenantA, value: "A", childIds: [] },
      { id: recordB, tenantId: tenantB, value: "B", childIds: [] },
    ],
    filters: [],
  };
}

async function setup() {
  const modules = await loadModules();
  const state = createState();
  const repository = modules.repository.createTenantRepositoryHarness({
    state,
  });
  const contextA = modules.context.createTenantContextHarness(contextInput());
  return { state, repository, contextA, contextModule: modules.context };
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected tenant-scoped operation to fail.");
}

describe("tenant-aware repositories [T061; HU-007; FR-018..FR-020]", () => {
  it("requires TenantContext for every tenant-scoped operation", async () => {
    const { repository } = await setup();
    await expect(
      repository.findById(undefined as unknown as TenantContextView, recordA),
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("creates an immutable TenantContext", async () => {
    const { contextA } = await setup();
    expect(Object.isFrozen(contextA)).toBe(true);
    expect(Object.isFrozen(contextA.roles)).toBe(true);
    expect(Object.isFrozen(contextA.permissions)).toBe(true);
  });

  it("always includes tenantId and an approved compound key in filters", async () => {
    const { state, repository, contextA } = await setup();
    await repository.findById(contextA, recordA);
    expect(state.filters).toContainEqual({
      tenantId_id: { tenantId: tenantA, id: recordA },
    });
  });

  it("allows Tenant A to read and update only Tenant A records", async () => {
    const { state, repository, contextA } = await setup();
    await expect(repository.findById(contextA, recordA)).resolves.toMatchObject(
      {
        tenantId: tenantA,
        value: "A",
      },
    );
    await repository.updateById(contextA, recordA, "A-updated");
    expect(state.records.find(({ id }) => id === recordA)?.value).toBe(
      "A-updated",
    );
    expect(state.records.find(({ id }) => id === recordB)?.value).toBe("B");
  });

  it("rejects reads and writes against Tenant B from Tenant A", async () => {
    const { repository, contextA } = await setup();
    await expect(repository.findById(contextA, recordB)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(
      repository.updateById(contextA, recordB, "compromised"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("rejects nested cross-tenant relationships", async () => {
    const { repository, contextA } = await setup();
    await expect(
      repository.connectChild(contextA, recordA, recordB),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("treats a foreign existing ID exactly like a missing ID", async () => {
    const { repository, contextA } = await setup();
    const foreign = await captureFailure(
      repository.findById(contextA, recordB),
    );
    const missing = await captureFailure(
      repository.findById(contextA, missingRecord),
    );
    expect(JSON.stringify(foreign)).toBe(JSON.stringify(missing));
    expect(JSON.stringify([foreign, missing])).not.toMatch(
      /tenant|record|exists|foreign/iu,
    );
  });

  it("does not expose generic unsafe repository methods", async () => {
    const { repository } = await setup();
    expect("findUnique" in repository).toBe(false);
    expect("findMany" in repository).toBe(false);
    expect("update" in repository).toBe(false);
    expect("raw" in repository).toBe(false);
  });

  it("preserves the exact TenantContext through transactions", async () => {
    const { repository, contextA } = await setup();
    await repository.transaction(
      contextA,
      async (transactionRepository, transactionContext) => {
        expect(transactionContext).toBe(contextA);
        await expect(
          transactionRepository.findById(transactionContext, recordA),
        ).resolves.toBeDefined();
      },
    );
  });
});
