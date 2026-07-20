import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PERMISSION_CODES,
  ROLE_CODES,
  permissionsForRoles,
} from "@bodegia/authz-catalog";
import { describe, expect, it } from "vitest";
import { errorCatalog } from "../../src/common/errors/error-catalog.js";
import {
  REDACTED_VALUE,
  redactLogValue,
} from "../../src/common/logging/redaction.js";
import {
  createTenantContextFromAuthorization,
  isTenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import { createActivationSecretService } from "../../src/modules/activation/services/issue-activation.service.js";
import { createPinAttemptService } from "../../src/modules/auth/services/pin.service.js";
import {
  ACCESS_TOKEN_TTL_MILLISECONDS,
  SESSION_ABSOLUTE_TTL_MILLISECONDS,
} from "../../src/modules/auth/services/token.service.js";

const schema = readFileSync(
  resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);
const now = new Date("2026-01-01T00:00:00.000Z");

function enumValues(name: string): readonly string[] {
  const match = new RegExp(`enum\\s+${name}\\s*\\{(?<body>[^}]*)\\}`, "u").exec(
    schema,
  );
  if (match?.groups?.["body"] === undefined) {
    throw new Error(`Missing Prisma enum ${name}.`);
  }
  return match.groups["body"]
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/u.test(line));
}

describe("MVP access unit regression [T119]", () => {
  it("keeps the approved Membership lifecycle and PERSONAL-only MVP device type", () => {
    expect(enumValues("MembershipStatus")).toEqual([
      "PENDING_ACTIVATION",
      "ACTIVE",
      "DISABLED",
    ]);
    expect(enumValues("DeviceType")).toEqual(["PERSONAL"]);
  });

  it("issues activation credentials with an exact fifteen-minute server TTL", async () => {
    const state = { challenges: [], aliases: [], logs: [], audits: [] };
    const issued = await createActivationSecretService(state).issue(now, state);
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(15 * 60 * 1_000);
    expect(state.challenges).toHaveLength(1);
    expect(state.aliases).toHaveLength(1);
  });

  it("locks a PIN profile on the fifth failure for exactly fifteen minutes", async () => {
    const state: {
      profile: {
        status: "ACTIVE" | "LOCKED" | "REVOKED";
        membershipStatus: "ACTIVE" | "DISABLED";
        failedPinAttempts: number;
        lockedUntil: Date | null;
        pinHash: string;
      };
      audits: Array<Record<string, unknown>>;
    } = {
      profile: {
        status: "ACTIVE",
        membershipStatus: "ACTIVE",
        failedPinAttempts: 4,
        lockedUntil: null,
        pinHash: "synthetic-hash",
      },
      audits: [],
    };
    const service = createPinAttemptService({
      state,
      verifyHash: () => Promise.resolve(false),
      transaction: async (work) => {
        const draft = structuredClone(state);
        const result = await work(draft);
        Object.assign(state, draft);
        return result;
      },
    });
    await expect(
      service.attempt({ pin: "000000", serverNow: now }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
    expect(state.profile.status).toBe("LOCKED");
    expect(state.profile.failedPinAttempts).toBe(5);
    expect(state.profile.lockedUntil?.getTime()).toBe(
      now.getTime() + 15 * 60 * 1_000,
    );
  });

  it("keeps the approved RBAC catalog closed and deterministic", () => {
    expect(ROLE_CODES).toEqual(["owner_admin", "seller", "inventory_manager"]);
    expect(PERMISSION_CODES).toEqual([
      "access.memberships.read",
      "access.memberships.manage",
      "access.roles.read",
      "access.roles.manage",
      "access.audit.read",
      "inventory.products.read",
      "inventory.products.write",
      "inventory.lots.read",
      "inventory.lots.write",
      "inventory.stock.read",
      "inventory.stock.adjust",
      "inventory.movements.read",
      "inventory.movements.write",
      "inventory.alerts.read",
      "inventory.alerts.write",
      "sales.read",
      "sales.write",
    ]);
    expect(permissionsForRoles(["seller"])).toEqual([
      "inventory.products.read",
      "inventory.stock.read",
      "sales.read",
      "sales.write",
    ]);
    expect(permissionsForRoles(["inventory_manager"])).toEqual([
      "inventory.alerts.read",
      "inventory.alerts.write",
      "inventory.lots.read",
      "inventory.lots.write",
      "inventory.movements.read",
      "inventory.movements.write",
      "inventory.products.read",
      "inventory.products.write",
      "inventory.stock.adjust",
      "inventory.stock.read",
      "sales.read",
      "sales.write",
    ]);
    expect(permissionsForRoles(["owner_admin"])).toEqual([
      "access.audit.read",
      "access.memberships.manage",
      "access.memberships.read",
      "access.roles.manage",
      "access.roles.read",
      "inventory.alerts.read",
      "inventory.alerts.write",
      "inventory.lots.read",
      "inventory.lots.write",
      "inventory.movements.read",
      "inventory.movements.write",
      "inventory.products.read",
      "inventory.products.write",
      "inventory.stock.adjust",
      "inventory.stock.read",
      "sales.read",
      "sales.write",
    ]);
    expect(permissionsForRoles(["seller", "inventory_manager"])).toEqual([
      "inventory.alerts.read",
      "inventory.alerts.write",
      "inventory.lots.read",
      "inventory.lots.write",
      "inventory.movements.read",
      "inventory.movements.write",
      "inventory.products.read",
      "inventory.products.write",
      "inventory.stock.adjust",
      "inventory.stock.read",
      "sales.read",
      "sales.write",
    ]);
    const sellerPermissions = permissionsForRoles(["seller"]);
    expect(
      sellerPermissions.some(
        (permission) =>
          permission.startsWith("inventory.") && permission.endsWith(".write"),
      ),
    ).toBe(false);
    expect(
      sellerPermissions.some((permission) =>
        /cost|margin|price/iu.test(permission),
      ),
    ).toBe(false);
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length);
    expect(() => permissionsForRoles(["unknown-role"])).toThrow(
      "Unknown authorization role",
    );
  });

  it("sanitizes nested secrets without mutating the source", () => {
    const source = {
      operation: "SESSION_STARTED",
      nested: [{ pin: "123456", phone: "+51987654321" }],
      refreshToken: "raw-refresh",
    };
    const snapshot = structuredClone(source);
    const redacted = redactLogValue(source);
    expect(source).toEqual(snapshot);
    expect(redacted).toEqual({
      operation: "SESSION_STARTED",
      nested: [{ pin: REDACTED_VALUE, phone: REDACTED_VALUE }],
      refreshToken: REDACTED_VALUE,
    });
  });

  it("publishes only uniform safe errors with no hidden-state details", () => {
    const serialized = JSON.stringify(errorCatalog);
    expect(
      Object.values(errorCatalog).every(({ status }) => status >= 400),
    ).toBe(true);
    expect(serialized).not.toMatch(
      /phoneE164|pinHash|tokenHash|pepper|membershipId|deviceProfileId/iu,
    );
    expect(errorCatalog.RESOURCE_NOT_FOUND.message).toBe(
      "The requested resource is not available.",
    );
  });

  it("fixes access-token and absolute session lifetimes at ten minutes and eight hours", () => {
    expect(ACCESS_TOKEN_TTL_MILLISECONDS).toBe(10 * 60 * 1_000);
    expect(SESSION_ABSOLUTE_TTL_MILLISECONDS).toBe(8 * 60 * 60 * 1_000);
  });

  it("creates an immutable server-authorized TenantContext with contextVersion", () => {
    const context = createTenantContextFromAuthorization({
      sessionId: "session-a",
      userId: "user-a",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      contextVersion: 3,
      roles: ["owner_admin", "owner_admin"],
      permissions: ["access.roles.manage"],
    });
    expect(isTenantContext(context)).toBe(true);
    expect(context.contextVersion).toBe(3);
    expect(context.roles).toEqual(["owner_admin"]);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.roles)).toBe(true);
  });

  it("rejects missing or non-positive contextVersion values", () => {
    expect(() =>
      createTenantContextFromAuthorization({
        sessionId: "session-a",
        userId: "user-a",
        tenantId: "tenant-a",
        membershipId: "membership-a",
        contextVersion: 0,
        roles: ["seller"],
        permissions: [],
      }),
    ).toThrow("authorized tenant context is invalid");
  });
});
