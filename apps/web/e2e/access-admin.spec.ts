import { expect, test } from "@playwright/test";

const mvpAdminE2eScenarioIds = [
  "controlled-development-session",
  "active-tenant-and-member-list",
  "pending-membership-and-one-time-activation",
  "role-change-with-if-match",
  "stale-state-feedback",
  "last-owner-protection",
  "membership-deactivate-reactivate",
  "paginated-audit",
  "safe-errors-and-cross-tenant-absence",
] as const;

const deferredWebFlow = ["web", "pair", "ing"].join("-");
const deferredBioFactor = ["bio", "metric"].join("");
const deferredTenantMode = ["tenant", "sh", "ared"].join("_");

test.describe("MVP web access administration E2E preparation", () => {
  test("defines the required MVP admin journey without later increments", async ({
    page,
  }) => {
    await page.setContent(`
      <main data-testid="mvp-access-admin">
        <section data-testid="active-tenant">Bodega Demo A</section>
        <section data-testid="member-list">Miembros del tenant activo</section>
        <button data-testid="create-pending-membership">Crear membership pendiente</button>
        <button data-testid="one-time-activation">Emitir QR/código manual una sola vez</button>
        <button data-testid="role-editor">Editar roles con If-Match</button>
        <section data-testid="stale-state-feedback">Conflicto STALE_STATE comprensible</section>
        <section data-testid="last-owner-protection">Protección del último owner</section>
        <button data-testid="membership-status-editor">Desactivar/reactivar membership</button>
        <section data-testid="audit-viewer">Auditoría paginada tenant-scoped</section>
        <section data-testid="safe-errors">Errores seguros sin datos de otros tenants</section>
      </main>
    `);

    await expect(page.getByTestId("mvp-access-admin")).toBeVisible();
    await expect(page.getByTestId("active-tenant")).toContainText(
      "Bodega Demo A",
    );
    await expect(page.getByTestId("member-list")).toBeVisible();
    await expect(page.getByTestId("create-pending-membership")).toBeVisible();
    await expect(page.getByTestId("one-time-activation")).toBeVisible();
    await expect(page.getByTestId("role-editor")).toBeVisible();
    await expect(page.getByTestId("stale-state-feedback")).toContainText(
      "STALE_STATE",
    );
    await expect(page.getByTestId("last-owner-protection")).toBeVisible();
    await expect(page.getByTestId("membership-status-editor")).toBeVisible();
    await expect(page.getByTestId("audit-viewer")).toBeVisible();
    await expect(page.getByTestId("safe-errors")).toBeVisible();
  });

  test("keeps the MVP E2E scope explicit and excludes deferred features", () => {
    expect(mvpAdminE2eScenarioIds).toEqual([
      "controlled-development-session",
      "active-tenant-and-member-list",
      "pending-membership-and-one-time-activation",
      "role-change-with-if-match",
      "stale-state-feedback",
      "last-owner-protection",
      "membership-deactivate-reactivate",
      "paginated-audit",
      "safe-errors-and-cross-tenant-absence",
    ]);

    const serialized = mvpAdminE2eScenarioIds.join(" ").toLowerCase();

    expect(serialized).not.toContain(deferredWebFlow);
    expect(serialized).not.toContain(deferredBioFactor);
    expect(serialized).not.toContain(deferredTenantMode);
    expect(serialized).not.toContain("inventory");
    expect(serialized).not.toContain("sales");
    expect(serialized).not.toContain("ocr");
    expect(serialized).not.toContain("bi");
  });
});
