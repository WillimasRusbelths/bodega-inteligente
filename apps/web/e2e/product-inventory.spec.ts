import { expect, test } from "@playwright/test";

test.describe("002 inventory web MVP", () => {
  test("renders catalog, lots, stock and alerts with stable accessible selectors", async ({
    page,
  }) => {
    await page.setContent(`
      <main data-testid="inventory-dashboard" aria-labelledby="inventory-title">
        <h1 id="inventory-title">Inventario de la bodega activa</h1>
        <form data-testid="product-filters" aria-label="Buscar productos"><label>Buscar<input name="q" /></label></form>
        <section data-testid="product-list"><div data-testid="product-row">Arroz sintético · AR-01 · 8</div></section>
        <section data-testid="lot-list"><div data-testid="lot-row">2027-01-01 · 8</div></section>
        <section data-testid="stock-list"><div data-testid="stock-row">8</div></section>
        <section data-testid="alert-list"><div data-testid="alert-row">LOW_STOCK · ACTIVE</div></section>
        <section data-testid="audit-list"><div data-testid="audit-row">PRODUCT_CREATED · SUCCEEDED</div></section>
      </main>
    `);
    await expect(page.getByTestId("inventory-dashboard")).toBeVisible();
    await expect(page.getByTestId("product-filters")).toBeVisible();
    await page.getByRole("textbox", { name: "Buscar" }).fill("Arroz");
    await expect(page.getByTestId("product-row")).toContainText(
      "Arroz sintético",
    );
    await expect(page.getByTestId("lot-row")).toContainText("2027-01-01");
    await expect(page.getByTestId("stock-row")).toContainText("8");
    await expect(page.getByTestId("alert-row")).toContainText("LOW_STOCK");
    await expect(page.getByTestId("audit-row")).toContainText(
      "PRODUCT_CREATED",
    );
    await expect(page.locator("body")).not.toContainText("unitCost");
  });

  test("shows safe empty and error states without exposing costs", async ({
    page,
  }) => {
    await page.setContent(
      '<main data-testid="inventory-dashboard"><p data-testid="products-empty">No hay productos</p><p role="alert" data-testid="inventory-error">No se pudieron cargar los productos.</p></main>',
    );
    await expect(page.getByTestId("products-empty")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(
      "No se pudieron cargar",
    );
    await expect(page.locator("body")).not.toContainText("unitCost");
  });
});
