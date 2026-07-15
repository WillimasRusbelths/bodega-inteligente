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

function block(schema: string, kind: "model" | "enum", name: string): string {
  const match = new RegExp(
    `${kind}\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`,
    "u",
  ).exec(schema);
  if (match?.[1] === undefined)
    throw new Error(`Expected Prisma ${kind} ${name}.`);
  return match[1];
}

function expectFields(contents: string, fields: readonly string[]): void {
  for (const field of fields)
    expect(contents).toMatch(new RegExp(`\\b${field}\\s+`, "u"));
}

describe("identity persistence schema [T016; FR-001, FR-002, FR-011, FR-012]", () => {
  it("enforces global uniqueness of normalized E.164 phone", () => {
    const user = block(loadSchema(), "model", "User");
    expect(user).toMatch(/phoneE164\s+String\s+@unique/u);
  });

  it("enforces one Membership per tenant and user", () => {
    const membership = block(loadSchema(), "model", "Membership");
    expect(membership).toMatch(/@@unique\(\s*\[\s*tenantId\s*,\s*userId\s*\]/u);
  });

  it.each([
    ["UserStatus", ["ACTIVE", "DISABLED"]],
    ["TenantStatus", ["ACTIVE", "DISABLED"]],
    ["MembershipStatus", ["PENDING_ACTIVATION", "ACTIVE", "DISABLED"]],
  ] as const)("restricts %s to approved states", (enumName, allowedStates) => {
    const values = block(loadSchema(), "enum", enumName);
    for (const state of allowedStates)
      expect(values).toMatch(new RegExp(`\\b${state}\\b`, "u"));
    expect(values.match(/^\s*[A-Z][A-Z_]*\s*$/gmu)).toHaveLength(
      allowedStates.length,
    );
  });

  it("includes optimistic concurrency versions on identity aggregates", () => {
    const schema = loadSchema();
    for (const model of ["User", "Tenant", "Membership"]) {
      expect(block(schema, "model", model)).toMatch(/\bversion\s+Int\b/u);
    }
  });

  it("requires Membership identity and tenant relations", () => {
    const membership = block(loadSchema(), "model", "Membership");
    expectFields(membership, ["tenantId", "userId", "tenant", "user"]);
    expect(membership).toMatch(/tenant\s+Tenant\s+@relation/u);
    expect(membership).toMatch(/user\s+User\s+@relation/u);
  });

  it("does not expose raw phone fields outside the global User identity", () => {
    const schema = loadSchema();
    for (const model of ["Tenant", "Membership"]) {
      expect(block(schema, "model", model)).not.toMatch(
        /\b(phone|phoneRaw|telephone|telefono)\s+/iu,
      );
    }
  });
});
