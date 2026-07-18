import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface AppendOnlyHarness {
  append(input: {
    tenantId: string;
    action: string;
    targetId: string;
  }): Promise<Readonly<Record<string, unknown>>>;
  disableSubject(targetId: string): void;
  list(): readonly Readonly<Record<string, unknown>>[];
}

interface AuditServiceModule {
  AuditService: new (...args: never[]) => object;
  createAuditAppendOnlyHarness(): AppendOnlyHarness;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/audit/services/audit.service.ts",
);
const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/0001_identity_access_mvp/migration.sql",
);

async function loadModule(): Promise<AuditServiceModule> {
  try {
    const module = (await import(
      pathToFileURL(servicePath).href
    )) as Partial<AuditServiceModule>;
    if (
      module.AuditService === undefined ||
      module.createAuditAppendOnlyHarness === undefined
    ) {
      throw new Error("missing audit service exports");
    }
    return module as AuditServiceModule;
  } catch {
    throw new Error("[T077] The append-only AuditService is not implemented.");
  }
}

describe("append-only audit persistence [T075; HU-008; FR-025; SC-010]", () => {
  it("allows application runtime insertion through the append-only service", async () => {
    const module = await loadModule();
    const harness = module.createAuditAppendOnlyHarness();
    const event = await harness.append({
      tenantId: "00000000-0000-4000-8000-000000000001",
      action: "MEMBERSHIP_DISABLED",
      targetId: "00000000-0000-4000-8000-000000000101",
    });
    expect(event).toMatchObject({ action: "MEMBERSHIP_DISABLED" });
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("exposes no runtime update or delete operation", async () => {
    const module = await loadModule();
    const service = module.AuditService.prototype as Record<string, unknown>;
    expect(service).not.toHaveProperty("update");
    expect(service).not.toHaveProperty("delete");
    expect(service).not.toHaveProperty("remove");
  });

  it("denies UPDATE and DELETE at the PostgreSQL boundary", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/prevent_audit_event_mutation/iu);
    expect(sql).toMatch(/BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+"AuditEvent"/iu);
    expect(sql).toMatch(/AuditEvent is append-only/iu);
  });

  it("preserves historical identifiers with restrictive relations", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const model = schema.match(/model AuditEvent \{[\s\S]*?\n\}/u)?.[0] ?? "";
    expect(model).toMatch(/tenantId\s+String\?/u);
    expect(model).toMatch(/effectiveMembershipId\s+String\?/u);
    expect(model).toMatch(/onDelete:\s*Restrict/gu);
    expect(model).not.toMatch(/onDelete:\s*Cascade/iu);
  });

  it("retains history after a related user, tenant or membership is disabled", async () => {
    const module = await loadModule();
    const harness = module.createAuditAppendOnlyHarness();
    const targetId = "00000000-0000-4000-8000-000000000101";
    await harness.append({
      tenantId: "00000000-0000-4000-8000-000000000001",
      action: "MEMBERSHIP_DISABLED",
      targetId,
    });
    harness.disableSubject(targetId);
    expect(harness.list()).toHaveLength(1);
    expect(harness.list()[0]).toMatchObject({ targetId });
  });

  it("keeps destructive maintenance outside the application service", async () => {
    const source = await readFile(servicePath, "utf8");
    expect(source).not.toMatch(
      /auditEvent\.(?:update|updateMany|delete|deleteMany)/u,
    );
    expect(source).not.toMatch(/\$executeRaw/u);
    expect(source).not.toMatch(/supabase/iu);
  });
});
