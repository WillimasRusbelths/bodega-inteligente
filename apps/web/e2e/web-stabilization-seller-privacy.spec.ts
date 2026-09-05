import { expect, test } from "@playwright/test";

test("keeps seller DOM, states and visible responses free of financial fields [T064]", async ({
  page,
}) => {
  await page.route("http://localhost:3000/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/demo/auth/login") {
      await route.fulfill({
        json: {
          data: {
            sessionId: "seller-session",
            user: {
              id: "seller-a",
              displayName: "Vendedor",
              phoneE164: "+51900000003",
            },
            tenant: {
              id: "tenant-a",
              name: "Bodega A",
              locationText: null,
              currencyCode: "PEN",
              referenceSchedule: null,
              status: "ACTIVE",
            },
            membership: {
              id: "membership-seller",
              status: "ACTIVE",
              role: "seller",
            },
          },
        },
      });
      return;
    }
    if (path.endsWith("/products")) {
      const safe = {
        id: "product-a",
        name: "Producto seller",
        sku: "SEL-1",
        barcode: null,
        status: "ACTIVE",
        salePrice: 5,
        availableStock: 8,
      };
      await route.fulfill({
        json: {
          items: [
            {
              ...safe,
              tenantId: "tenant-a",
              category: null,
              unitOfMeasure: {
                id: "unit-a",
                code: "UND",
                name: "Unidad",
                quantityScale: 0,
              },
              minimumStock: 1,
              expiryAlertDays: 1,
              version: 1,
              unitCost: 91.25,
              purchasePrice: 88,
            },
          ],
          data: [{ ...safe, totalCost: 365 }],
        },
      });
      return;
    }
    if (path.endsWith("/sales")) {
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "READ_FAILED",
            correlationId: "corr-seller",
            inventoryValuation: 680.6,
            estimatedLoss: 46.8,
            purchasePrice: 23.4,
          },
        },
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", correlationId: "corr-safe" } },
    });
  });
  await page.goto("http://localhost:5173");
  await page.getByRole("radio", { name: /Vendedor/u }).check();
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByTestId("demo-dashboard")).toHaveAttribute(
    "data-role",
    "seller",
  );
  await expect(page.locator("#quick-sale-product")).toContainText(
    "Producto seller",
  );
  await expect(
    page.locator('[data-resource="sales"][data-state="error"]'),
  ).toContainText("corr-seller");
  await expect(page.getByRole("navigation").getByRole("link")).toHaveText([
    "Inicio",
    "Ventas rapidas",
  ]);
  const html = await page.locator("body").innerHTML();
  expect(html).not.toMatch(
    /unitCost|totalCost|purchasePrice|inventoryValuation|estimatedLoss|91\.25|88|365|680\.6|46\.8|23\.4/iu,
  );
  await expect(
    page.locator("#oltp, #bi, #warehouse, #configuracion, #empleados"),
  ).toHaveCount(0);
});
