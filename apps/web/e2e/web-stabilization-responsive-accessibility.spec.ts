import { expect, test, type Page, type Locator } from "@playwright/test";

const baseUrl = "http://127.0.0.1:5173";
const viewports = [
  { name: "320", width: 320, height: 720 },
  { name: "768", width: 768, height: 900 },
  { name: "1440", width: 1440, height: 1000 },
] as const;

const session = {
  sessionId: "web-stabilization-owner-session",
  user: {
    id: "00000000-0000-4000-8000-000000000101",
    displayName: "Propietario local",
    phoneE164: "+51900000001",
  },
  tenant: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Bodega local",
    locationText: "Ayacucho, Peru",
    currencyCode: "PEN",
    referenceSchedule: null,
    status: "ACTIVE",
  },
  membership: {
    id: "00000000-0000-4000-8000-000000000201",
    status: "ACTIVE",
    role: "owner_admin" as const,
  },
};

const products = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    name: "Leche evaporada",
    sku: "LAC-LEC-001",
    barcode: "7750001000011",
    status: "ACTIVE",
    salePrice: 5.5,
    availableStock: 18,
  },
];

async function mockLocalDemoApi(page: Page): Promise<() => number> {
  let salesPosted = 0;
  const sales: Array<Record<string, unknown>> = [];
  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/demo/auth/login" && request.method() === "POST") {
      await route.fulfill({ json: { data: session } });
      return;
    }
    if (pathname === "/tenants/current/memberships") {
      await route.fulfill({ json: { data: [] } });
      return;
    }
    if (pathname === "/tenants/current/products") {
      // Current dual projection consumed by the real browser (no UI substitution).
      await route.fulfill({ json: { items: products, data: products } });
      return;
    }
    if (pathname === "/tenants/current/sales" && request.method() === "GET") {
      await route.fulfill({ json: { data: sales } });
      return;
    }
    if (pathname === "/tenants/current/sales" && request.method() === "POST") {
      salesPosted += 1;
      sales.push({
        id: "00000000-0000-4000-8000-000000000401",
        saleNumber: "V-LOCAL-001",
        status: "CONFIRMED",
        subtotal: 5.5,
        total: 5.5,
        currency: "PEN",
        createdAt: "2026-08-20T00:00:00.000Z",
        items: [
          {
            id: "00000000-0000-4000-8000-000000000501",
            productId: products[0]?.id,
            productName: "Leche evaporada",
            lotId: null,
            expiresAt: null,
            quantity: 1,
            unitPrice: 5.5,
            lineTotal: 5.5,
          },
        ],
      });
      await route.fulfill({ json: { data: sales[0] } });
      return;
    }
    await route.fulfill({
      status: 404,
      json: {
        error: {
          code: "NOT_FOUND",
          message: "Ruta local no preparada.",
          correlationId: "00000000-0000-4000-8000-000000000999",
        },
      },
    });
  });
  return () => salesPosted;
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let count = 0; count < 70; count += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await expect(target).toBeInViewport();
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

async function assertLayout(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  const clipped = await page
    .locator("input:not([type=radio]), select, button, .sidebar a")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
          );
        })
        .map((element) => element.id || element.textContent),
    );
  expect(clipped).toEqual([]);
  const overlap = await page.locator(".sidebar a").evaluateAll((elements) =>
    elements.some((element, index) =>
      elements.slice(index + 1).some((other) => {
        const a = element.getBoundingClientRect();
        const b = other.getBoundingClientRect();
        return (
          Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
          Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1
        );
      }),
    ),
  );
  expect(overlap).toBe(false);
  const formOverlap = await page.locator("form").evaluateAll((forms) =>
    forms.some((form) => {
      const controls = Array.from(
        form.querySelectorAll("input:not([type=radio]), select, button"),
      );
      return controls.some((control, index) =>
        controls.slice(index + 1).some((other) => {
          const a = control.getBoundingClientRect();
          const b = other.getBoundingClientRect();
          return (
            Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1
          );
        }),
      );
    }),
  );
  expect(formOverlap).toBe(false);
}

for (const viewport of viewports) {
  test(`keyboard, regional scrolling and recoverable errors at ${viewport.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockLocalDemoApi(page);
    await page.route(
      "http://127.0.0.1:3000/tenants/current/settings",
      (route) =>
        route.fulfill({
          status: 409,
          json: {
            error: {
              code: "CONFLICT",
              correlationId: "correlation-" + "x".repeat(90),
              message: "private SQL",
            },
          },
        }),
    );
    await page.goto(baseUrl);
    await expect(page.getByTestId("demo-login")).toBeVisible();
    await assertLayout(page);
    await tabTo(
      page,
      page.getByRole("textbox", { name: "Usuario demo", exact: true }),
    );
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("PIN demo")).toBeFocused();
    await page.keyboard.press("Tab");
    const login = page.getByRole("button", { name: "Iniciar sesión" });
    await expect(login).toBeFocused();
    expect(
      await login.evaluate((element) =>
        parseFloat(getComputedStyle(element).outlineWidth),
      ),
    ).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Enter");
    await expect(
      page.getByLabel("Stock de producto", { exact: true }),
    ).toHaveValue("18");
    await assertLayout(page);
    const inventory = page.locator('.sidebar a[href="#oltp"]');
    await tabTo(page, inventory);
    await page.keyboard.press("Enter");
    await expect(inventory).toHaveAttribute("aria-current", "page");
    const table = page.getByRole("region", { name: "Productos", exact: true });
    await expect(table).toBeVisible();
    await tabTo(page, table);
    await expect(table).toBeFocused();
    const scrollable = await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    if (scrollable) {
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => table.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
    }
    await assertLayout(page);
    const settings = page.locator('.sidebar a[href="#configuracion"]');
    await tabTo(page, settings);
    await page.keyboard.press("Enter");
    await tabTo(page, page.getByLabel("Nombre de bodega"));
    await page
      .getByLabel("Nombre de bodega")
      .fill("Bodega " + "nombre-largo".repeat(10));
    await tabTo(
      page,
      page.getByRole("button", { name: "Guardar configuración" }),
    );
    await page.keyboard.press("Enter");
    const error = page.locator("#settings-result");
    await expect(error).toBeFocused();
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toContainText("correlation-");
    await expect(error).not.toContainText("SQL");
    await expect(page.getByLabel("Nombre de bodega")).toHaveValue(
      "Bodega " + "nombre-largo".repeat(10),
    );
    await assertLayout(page);
  });

  test(`keeps login, stock and quick sale usable at ${viewport.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const salesPosted = await mockLocalDemoApi(page);
    await page.goto(baseUrl);
    await expect(page.getByTestId("demo-login")).toBeVisible();
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("demo-dashboard")).toBeVisible();
    await expect(
      page.getByLabel("Stock de producto", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Stock de producto", { exact: true }),
    ).toHaveValue("18");
    await expect(
      page.getByRole("button", { name: "Registrar venta" }),
    ).toBeVisible();

    await page.getByLabel("Cantidad").fill("1");
    await tabTo(page, page.getByRole("button", { name: "Registrar venta" }));
    await page.getByRole("button", { name: "Registrar venta" }).focus();
    await expect(
      page.getByRole("button", { name: "Registrar venta" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(salesPosted).toBe(1);
    await expect(page.locator("#ventas")).toContainText("V-LOCAL-001");
    await expect(page.locator(".sale-synchronization")).toHaveAttribute(
      "role",
      "status",
    );
    await assertLayout(page);
    await page.screenshot({
      path: test.info().outputPath(`dashboard-${viewport.name}.png`),
      fullPage: true,
    });

    console.log(
      JSON.stringify(
        await page.evaluate(() => ({
          viewport: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          current: document
            .querySelector('.sidebar a[aria-current="page"]')
            ?.getAttribute("href"),
          overflow: Array.from(document.querySelectorAll("body *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.right > innerWidth + 1 && !element.closest(".table-wrap")
              );
            })
            .slice(0, 12)
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
            })),
        })),
      ),
    );

    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
    await expect(page.locator(".sidebar a").first()).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}
