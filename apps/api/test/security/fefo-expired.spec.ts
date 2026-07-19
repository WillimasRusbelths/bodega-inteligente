import { describe, expect, it } from "vitest";
import { createTenantContextHarness } from "../../src/modules/access/context/tenant-context.js";
import { FefoService } from "../../src/modules/inventory/services/fefo.service.js";

describe("FEFO expired security [T052]", () => {
  it("requires stock-adjust permission and a reason for expired adjustment", () => {
    const service = new FefoService({} as never);
    const context = createTenantContextHarness({
      sessionId: "fefo-session",
      userId: "00000000-0000-4000-8000-000000007011",
      tenantId: "00000000-0000-4000-8000-000000007012",
      membershipId: "00000000-0000-4000-8000-000000007013",
      contextVersion: 1,
      roles: ["seller"],
      permissions: ["inventory.stock.read"],
    });
    expect(() =>
      service.authorizeExpiredAdjustment(
        context,
        { expiresAt: new Date("2020-01-01T00:00:00.000Z") },
        "Ajuste autorizado",
      ),
    ).toThrow();
  });
});
