import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const snapshotPath = resolve(
  repositoryRoot,
  "packages/api-contract/src/generated/schema.snapshot.json",
);
const generatedPath = resolve(
  repositoryRoot,
  "packages/api-contract/src/generated/index.ts",
);

interface Snapshot {
  paths: Record<string, Record<string, { operationId?: string }>>;
  components: {
    schemas: Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >;
  };
}

async function snapshot(): Promise<Snapshot> {
  return JSON.parse(await readFile(snapshotPath, "utf8")) as Snapshot;
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

describe("shared generated MVP client [T106; FR-005, FR-028, FR-031]", () => {
  it("contains the approved MVP operation subset", async () => {
    const document = await snapshot();
    const operations = Object.values(document.paths)
      .flatMap((item) => Object.values(item))
      .flatMap((operation) =>
        operation.operationId === undefined ? [] : [operation.operationId],
      );
    expect(operations).toHaveLength(22);
    expect(operations).toEqual(
      expect.arrayContaining([
        "activateDeviceProfile",
        "unlockWithPin",
        "rotateRefreshToken",
        "selectActiveTenant",
        "listCurrentTenantAuditEvents",
      ]),
    );
  });

  it("excludes support, pairing, biometric and TENANT_SHARED operations", async () => {
    const serialized = JSON.stringify(await snapshot());
    expect(serialized).not.toMatch(
      /openSupportCase|WebPairing|createBiometricChallenge|createTenantSharedDevice/u,
    );
  });

  it.each([
    [
      "ActivationChallengeIssueResponse",
      ["qrSecret", "manualCode", "expiresAt"],
    ],
    ["ActivationConsumeResponse", ["pinSetupToken", "expiresAt"]],
    ["SessionCreationResponse", ["accessToken", "refreshToken"]],
    ["RefreshRotationResponse", ["accessToken", "refreshToken"]],
  ])("preserves one-time fields for %s", async (schemaName, fields) => {
    const document = await snapshot();
    expect(document.components.schemas[schemaName]?.required).toEqual(
      expect.arrayContaining(fields),
    );
  });

  it("never exposes refreshToken in TenantSelectionResponse", async () => {
    const document = await snapshot();
    const schema = document.components.schemas["TenantSelectionResponse"];
    expect(schema?.required).toContain("accessToken");
    expect(schema?.properties).not.toHaveProperty("refreshToken");
    expect(await readFile(generatedPath, "utf8")).not.toMatch(
      /TenantSelectionResponse[\s\S]{0,900}refreshToken/u,
    );
  });

  it("is generated in one package and consumed by both clients", async () => {
    expect(
      await readFile(
        resolve(repositoryRoot, "apps/mobile/src/api/client.ts"),
        "utf8",
      ),
    ).toContain('from "@bodegia/api-contract"');
    expect(
      await readFile(
        resolve(repositoryRoot, "apps/web/src/api/client.ts"),
        "utf8",
      ),
    ).toContain('from "@bodegia/api-contract"');
    await expect(
      readdir(resolve(repositoryRoot, "apps/mobile/src/generated")),
    ).rejects.toThrow();
    await expect(
      readdir(resolve(repositoryRoot, "apps/web/src/generated")),
    ).rejects.toThrow();
  });

  it("keeps mobile and web free of database SDK imports", async () => {
    const files = [
      ...(await sourceFiles(resolve(repositoryRoot, "apps/mobile/src"))),
      ...(await sourceFiles(resolve(repositoryRoot, "apps/web/src"))),
    ];
    const sources = await Promise.all(
      files.map((file) => readFile(file, "utf8")),
    );
    expect(sources.join("\n")).not.toMatch(
      /from\s+["'](?:@prisma\/client|@supabase\/supabase-js|pg|postgres)["']/u,
    );
  });
});
