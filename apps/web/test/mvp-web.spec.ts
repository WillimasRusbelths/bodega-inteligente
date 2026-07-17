import { describe, expect, it, vi } from "vitest";
import { AuditViewer } from "../src/features/audit/audit-viewer.js";
import { MembershipAdmin } from "../src/features/memberships/membership-admin.js";
import { RoleEditorController } from "../src/features/memberships/RoleEditor.js";
import { StatusEditorController } from "../src/features/memberships/StatusEditor.js";

const membership = {
  id: "00000000-0000-4000-8000-000000000101",
  tenantId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000011",
  displayName: "Propietario Sintético",
  status: "ACTIVE" as const,
  roles: ["owner_admin" as const],
  version: 1,
};

describe("web MVP administration [T113-T116]", () => {
  it("requires an active tenant before membership administration", async () => {
    const admin = new MembershipAdmin(
      { list: vi.fn(), create: vi.fn(), issueActivation: vi.fn() },
      () => null,
    );
    await expect(admin.load()).rejects.toThrow("ACTIVE_TENANT_REQUIRED");
  });

  it("exposes activation QR/manual once and clears the view", async () => {
    const admin = new MembershipAdmin(
      {
        list: vi.fn(),
        create: vi.fn(),
        issueActivation() {
          return Promise.resolve({
            challengeId: "00000000-0000-4000-8000-000000000301",
            qrSecret: "server-only-secret",
            qrPayload: "synthetic-opaque-qr",
            manualCode: "12345678",
            expiresAt: "2026-07-17T18:00:00.000Z",
            maxAttempts: 5,
          });
        },
      },
      () => membership.tenantId,
    );
    await admin.issueActivation({
      membershipId: membership.id,
      purpose: "INITIAL_ACTIVATION",
      idempotencyKey: "synthetic-key",
    });
    expect(admin.oneTimeActivation).toMatchObject({ manualCode: "12345678" });
    expect(JSON.stringify(admin.oneTimeActivation)).not.toContain(
      "server-only-secret",
    );
    admin.leaveActivationView();
    expect(admin.oneTimeActivation).toBeNull();
  });

  it("protects the last owner from visual and functional role removal", async () => {
    const replaceRoles = vi.fn();
    const editor = new RoleEditorController(
      { replaceRoles },
      membership,
      ["access.roles.manage"],
      1,
    );
    await editor.save(["seller"], "Synthetic role change");
    expect(replaceRoles).not.toHaveBeenCalled();
    expect(editor.state).toMatchObject({ status: "BLOCKED" });
  });

  it("sends the current version as If-Match and explains STALE_STATE", async () => {
    const editor = new RoleEditorController(
      {
        replaceRoles(input) {
          expect(input.ifMatch).toBe('"1"');
          return Promise.reject(
            Object.assign(new Error("safe conflict"), {
              code: "STALE_STATE",
            }),
          );
        },
      },
      membership,
      ["access.roles.manage"],
      2,
    );
    await editor.save(["seller"], "Synthetic role change");
    expect(editor.state).toMatchObject({ status: "STALE" });
  });

  it("protects the last active owner from deactivation", async () => {
    const changeStatus = vi.fn();
    const editor = new StatusEditorController(
      { changeStatus },
      membership,
      ["access.memberships.manage"],
      1,
    );
    await editor.save("DISABLED", "Synthetic status change");
    expect(changeStatus).not.toHaveBeenCalled();
    expect(editor.state).toMatchObject({ status: "BLOCKED" });
  });

  it("renders only safe audit columns and supports cursor filters", async () => {
    const list = vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: "00000000-0000-4000-8000-000000000801",
            actorId: membership.userId,
            action: "MEMBERSHIP_CREATED",
            result: "SUCCEEDED" as const,
            occurredAt: "2026-07-17T17:00:00.000Z",
            correlationId: "00000000-0000-4000-8000-000000000901",
            before: { phone: "+51987654321", pinHash: "internal-hash" },
            after: { refreshToken: "raw-refresh" },
          },
        ],
        nextCursor: "opaque-cursor",
      }),
    );
    const viewer = new AuditViewer({ list }, ["owner_admin"]);
    await viewer.load({ action: "MEMBERSHIP_CREATED", result: "SUCCEEDED" });
    expect(viewer.state).toMatchObject({
      status: "READY",
      nextCursor: "opaque-cursor",
    });
    expect(JSON.stringify(viewer.state)).not.toMatch(
      /\+51987654321|internal-hash|raw-refresh|before|after/iu,
    );
    expect(list).toHaveBeenCalledWith({
      action: "MEMBERSHIP_CREATED",
      result: "SUCCEEDED",
    });
  });

  it("hides audit data from non-owner roles", async () => {
    const list = vi.fn();
    const viewer = new AuditViewer({ list }, ["seller"]);
    await viewer.load();
    expect(viewer.state).toEqual({ status: "FORBIDDEN" });
    expect(list).not.toHaveBeenCalled();
  });
});
