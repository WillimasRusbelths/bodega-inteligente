import { expect, test } from "@playwright/test";

test("renders loading, empty, error, post-sale stale and GET-only recovery [T065]", async ({
  page,
}) => {
  let salePosts = 0;
  let alertGets = 0;
  let movementGets = 0;
  const sale = {
    id: "sale-a",
    saleNumber: "V-REC-001",
    status: "COMPLETED",
    subtotal: 5,
    total: 5,
    currency: "PEN",
    createdAt: "2026-09-04T00:00:00Z",
    items: [
      {
        id: "item-a",
        productId: "product-a",
        productName: "Producto recuperable",
        lotId: null,
        expiresAt: null,
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      },
    ],
  };
  await page.route("http://localhost:3000/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/demo/auth/login") {
      await route.fulfill({
        json: {
          data: {
            sessionId: "owner-session",
            user: {
              id: "owner-a",
              displayName: "Propietario",
              phoneE164: "+51900000001",
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
              id: "membership-owner",
              status: "ACTIVE",
              role: "owner_admin",
            },
          },
        },
      });
      return;
    }
    if (path.endsWith("/memberships")) {
      await route.fulfill({ json: { data: [] } });
      return;
    }
    if (path.endsWith("/sales") && request.method() === "POST") {
      salePosts += 1;
      await route.fulfill({ json: { data: sale } });
      return;
    }
    if (path.endsWith("/products")) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const stock = salePosts === 0 ? 8 : 7;
      const product = {
        id: "product-a",
        name: "Producto recuperable",
        sku: "REC-1",
        barcode: null,
        status: "ACTIVE",
        salePrice: 5,
        availableStock: stock,
      };
      await route.fulfill({
        json: {
          items: [
            {
              ...product,
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
            },
          ],
          data: [product],
        },
      });
      return;
    }
    if (path.endsWith("/sales")) {
      await route.fulfill({ json: { data: salePosts === 0 ? [] : [sale] } });
      return;
    }
    if (path.endsWith("/inventory/movements")) {
      movementGets += 1;
      if (movementGets === 1)
        await route.fulfill({
          status: 503,
          json: {
            error: { code: "READ_FAILED", correlationId: "corr-movements" },
          },
        });
      else
        await route.fulfill({
          json: {
            items: [
              {
                id: "movement-a",
                tenantId: "tenant-a",
                productId: "product-a",
                lotId: "lot-a",
                type: "SALE_OUT",
                quantity: 1,
                quantityDelta: -1,
                balanceBefore: 8,
                balanceAfter: 7,
                reason: "Venta confirmada",
                actorId: "owner-a",
                createdAt: "2026-09-04T00:00:00Z",
              },
            ],
            nextCursor: null,
          },
        });
      return;
    }
    if (path.endsWith("/inventory/alerts")) {
      alertGets += 1;
      if (alertGets === 2)
        await route.fulfill({
          status: 503,
          json: {
            error: { code: "READ_FAILED", correlationId: "corr-alerts" },
          },
        });
      else
        await route.fulfill({
          json: {
            items: [
              {
                id: "alert-a",
                tenantId: "tenant-a",
                productId: "product-a",
                lotId: null,
                type: "LOW_STOCK",
                status: "ACTIVE",
                observedValue: 7,
                thresholdValue: 8,
                triggeredAt: "2026-09-04T00:00:00Z",
                resolvedAt: null,
              },
            ],
            nextCursor: null,
          },
        });
      return;
    }
    if (path.endsWith("/inventory-summary")) {
      const stock = salePosts === 0 ? 8 : 7;
      await route.fulfill({
        json: {
          data: {
            totalProducts: 1,
            totalStockAvailable: stock,
            lowStockProducts: 1,
            productsExpiringSoon: 0,
            productsExpired: 0,
            activeAlerts: 1,
          },
        },
      });
      return;
    }
    if (path.includes("/bi/")) {
      await route.fulfill({ json: { data: [] } });
      return;
    }
    await route.fulfill({ json: { items: [], nextCursor: null } });
  });

  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator('[data-state="loading"]').first()).toBeVisible();
  await expect(page.locator("#quick-sale-stock")).toHaveValue("8");
  await expect(
    page.locator('[data-resource="sales"][data-state="empty"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-resource="movements"][data-state="error"]'),
  ).toContainText("corr-movements");

  await page.getByRole("button", { name: "Registrar venta" }).click();
  await expect(
    page.locator('[data-resource="alerts"][data-state="stale"]'),
  ).toContainText("corr-alerts");
  await expect(
    page.getByText("Venta confirmada", { exact: false }).first(),
  ).toBeVisible();
  expect(salePosts).toBe(1);
  const readsBeforeRetry = { movementGets, alertGets };
  await page.locator('[data-retry-resource="alerts"]').click();
  await expect(
    page.locator('[data-resource="alerts"][data-state="ready"]'),
  ).toBeVisible();
  expect({ salePosts, movementGets, alertGets }).toEqual({
    salePosts: 1,
    movementGets: readsBeforeRetry.movementGets,
    alertGets: readsBeforeRetry.alertGets + 1,
  });
  await expect(page.locator("#quick-sale-stock")).toHaveValue("7");
});
