import { expect, test, type Page } from "@playwright/test";

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
      await route.fulfill({ json: { data: products } });
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

for (const viewport of viewports) {
  test(`keeps login, stock and quick sale usable at ${viewport.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const salesPosted = await mockLocalDemoApi(page);
    await page.goto(baseUrl);
    await expect(page.getByTestId("demo-login")).toBeVisible();
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("demo-dashboard")).toBeVisible();
    await expect(page.getByLabel("Stock disponible")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar venta" })).toBeVisible();

    await page.getByLabel("Cantidad").fill("1");
    await page.getByRole("button", { name: "Registrar venta" }).focus();
    await expect(page.getByRole("button", { name: "Registrar venta" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(salesPosted).toBe(1);
    await expect(page.locator("#ventas")).toContainText("V-LOCAL-001");

    await expect
      .poll(() =>
        page.locator("html").evaluate((element) =>
          element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);
    await expect(page.locator(".sidebar a").first()).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}
