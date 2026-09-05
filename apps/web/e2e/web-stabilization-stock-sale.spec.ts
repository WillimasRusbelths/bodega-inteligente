import { expect, test } from "@playwright/test";

const webUrl = "http://localhost:5173";
const apiUrl = "http://localhost:3000";
const sessionId = "demo-web-session-owner_admin";

test("keeps backend stock coherent and persists exactly one sale in local PostgreSQL [T062]", async ({
  page,
  request,
}) => {
  let salePosts = 0;
  page.on("request", (outgoing) => {
    if (
      outgoing.method() === "POST" &&
      new URL(outgoing.url()).pathname === "/tenants/current/sales"
    )
      salePosts += 1;
  });

  await page.goto(webUrl);
  await page.locator("#demo-username").fill("propietario");
  await page.locator("#demo-pin").fill("100001");
  const initialLoadStartedAt = performance.now();
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForFunction(() => {
    const stock = document.querySelector<HTMLInputElement>("#quick-sale-stock");
    const operational = document.querySelector("#oltp");
    return (
      stock?.value === "18" &&
      operational?.textContent?.includes("Leche PostgreSQL T062") === true &&
      operational.textContent.includes("18") &&
      document
        .querySelector("#inicio")
        ?.textContent?.includes("Stock disponible18") === true &&
      document
        .querySelector("#bi")
        ?.textContent?.includes("Stock disponible18") === true
    );
  });
  const initialLoadElapsedMs = performance.now() - initialLoadStartedAt;
  console.log(JSON.stringify({ initialLoadElapsedMs }));
  expect(initialLoadElapsedMs).toBeLessThan(2_000);
  await expect(page.getByTestId("demo-dashboard")).toBeVisible();
  await expect(page.locator("#quick-sale-product")).toContainText(
    "Leche PostgreSQL T062",
  );
  await expect(page.locator("#quick-sale-stock")).toHaveValue("18");
  const operationalProducts = page
    .locator("#oltp")
    .getByRole("region", { name: "Productos", exact: true });
  await expect(operationalProducts).toContainText("Leche PostgreSQL T062");
  await expect(operationalProducts).toContainText("18");
  await expect(page.locator("#inicio")).toContainText("Stock disponible18");
  await expect(page.locator("#bi")).toContainText("Stock disponible18");

  const postSaleStartedAt = performance.now();
  await page.getByRole("button", { name: "Registrar venta" }).click();
  await page.waitForFunction(() => {
    const stock = document.querySelector<HTMLInputElement>("#quick-sale-stock");
    const operational = document.querySelector("#oltp");
    const history = document.querySelector(
      '[aria-label="Historial de ventas"]',
    );
    return (
      stock?.value === "17" &&
      operational?.textContent?.includes("17") === true &&
      document
        .querySelector("#inicio")
        ?.textContent?.includes("Stock disponible17") === true &&
      document
        .querySelector("#bi")
        ?.textContent?.includes("Stock disponible17") === true &&
      history?.textContent?.includes("Leche PostgreSQL T062") === true
    );
  });
  const postSaleElapsedMs = performance.now() - postSaleStartedAt;
  console.log(JSON.stringify({ postSaleElapsedMs }));
  expect(postSaleElapsedMs).toBeLessThan(2_000);
  await expect(page.locator("#quick-sale-stock")).toHaveValue("17");
  await expect(operationalProducts).toContainText("17");
  await expect(page.locator("#inicio")).toContainText("Stock disponible17");
  await expect(page.locator("#bi")).toContainText("Stock disponible17");
  await expect(
    page.getByRole("region", { name: "Historial de ventas" }),
  ).toContainText("Leche PostgreSQL T062");
  expect(salePosts).toBe(1);

  const persisted = await request.get(`${apiUrl}/tenants/current/sales`, {
    headers: { "X-Demo-Session": sessionId },
  });
  expect(persisted.ok()).toBe(true);
  const body = (await persisted.json()) as {
    readonly data: readonly {
      readonly items: readonly { readonly productId: string }[];
    }[];
  };
  const matching = body.data.filter((sale) =>
    sale.items.some(
      (item) => item.productId === "00000000-0000-4000-8000-000000000963",
    ),
  );
  expect(matching).toHaveLength(1);
});
