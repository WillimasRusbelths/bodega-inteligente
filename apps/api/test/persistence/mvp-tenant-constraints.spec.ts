import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

function loadSchema(): string {
  if (!existsSync(schemaPath)) {
    throw new Error(
      "[T019-T022] prisma/schema.prisma is required to satisfy the persistence constraints.",
    );
  }
  return readFileSync(schemaPath, "utf8");
}

function model(schema: string, name: string): string {
  const match = new RegExp(
    `model\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`,
    "u",
  ).exec(schema);
  if (match?.[1] === undefined)
    throw new Error(`Expected Prisma model ${name}.`);
  return match[1];
}

function enumValues(schema: string, name: string): string {
  const match = new RegExp(
    `enum\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`,
    "u",
  ).exec(schema);
  if (match?.[1] === undefined)
    throw new Error(`Expected Prisma enum ${name}.`);
  return match[1];
}

describe("MVP tenant constraints [T017; FR-014, FR-018, FR-019, FR-020]", () => {
  it.each(["Membership", "MembershipRole", "DeviceProfile", "Session"])(
    "makes %s tenant-scoped",
    (name) =>
      expect(model(loadSchema(), name)).toMatch(/\btenantId\s+String\b/u),
  );

  it("uses a composite Membership identity addressable within its tenant", () => {
    expect(model(loadSchema(), "Membership")).toMatch(
      /@@unique\(\s*\[\s*tenantId\s*,\s*id\s*\]/u,
    );
  });

  it("binds MembershipRole to Membership through tenantId and membershipId", () => {
    const membershipRole = model(loadSchema(), "MembershipRole");
    expect(membershipRole).toMatch(
      /@relation\([^)]*fields:\s*\[\s*tenantId\s*,\s*membershipId\s*\][^)]*references:\s*\[\s*tenantId\s*,\s*id\s*\]/u,
    );
    expect(membershipRole).toMatch(
      /@@unique\(\s*\[\s*tenantId\s*,\s*membershipId\s*,\s*roleId\s*\]/u,
    );
  });

  it("keeps RolePermission as a unique coherent role-permission pair", () => {
    const rolePermission = model(loadSchema(), "RolePermission");
    expect(rolePermission).toMatch(/\brole\s+Role\s+@relation/u);
    expect(rolePermission).toMatch(/\bpermission\s+Permission\s+@relation/u);
    expect(rolePermission).toMatch(
      /@@(id|unique)\(\s*\[\s*roleId\s*,\s*permissionId\s*\]/u,
    );
  });

  it("limits the first MVP migration to PERSONAL devices", () => {
    const values = enumValues(loadSchema(), "DeviceType");
    expect(values).toMatch(/\bPERSONAL\b/u);
    expect(values).not.toMatch(/\bTENANT_SHARED\b/u);
  });

  it("requires a tenant-consistent personal DeviceProfile", () => {
    const profile = model(loadSchema(), "DeviceProfile");
    for (const field of ["deviceId", "userId", "membershipId", "tenantId"]) {
      expect(profile).toMatch(new RegExp(`\\b${field}\\s+String\\b`, "u"));
    }
    expect(profile).toMatch(
      /@relation\([^)]*fields:\s*\[\s*tenantId\s*,\s*membershipId\s*\][^)]*references:\s*\[\s*tenantId\s*,\s*id\s*\]/u,
    );
  });

  it("limits Session to MOBILE in the MVP schema", () => {
    const platforms = enumValues(loadSchema(), "SessionPlatform");
    expect(platforms).toMatch(/\bMOBILE\b/u);
    expect(platforms).not.toMatch(/\bWEB\b/u);
  });

  it("uses composite tenant relations that reject Tenant A/B reference mixing", () => {
    const schema = loadSchema();
    for (const name of ["MembershipRole", "DeviceProfile"]) {
      expect(model(schema, name)).toMatch(
        /fields:\s*\[\s*tenantId\s*,\s*(membershipId|userId)\s*\][^)]*references:\s*\[\s*tenantId\s*,\s*(id|userId)\s*\]/u,
      );
    }
  });
});
