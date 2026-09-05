import { describe, expect, it } from "vitest";
import {
  operationalBalance,
  operationalLot,
  type InventoryBalance,
  type Lot,
} from "../src/api/inventory-client.js";
import { renderBodegiaDashboard } from "../src/demo/mvp-demo.js";
import { renderInventoryBiDashboard } from "../src/features/bi/inventory-bi-dashboard.js";

const sellerRestrictedSections = [
  "configuracion",
  "empleados",
  "oltp",
  "warehouse",
  "bi",
  "roles",
  "roadmap",
] as const;

function section(html: string, id: string): string | null {
  const start = html.indexOf(`<section id="${id}"`);
  const end = html.indexOf("</section>", start);
  return start < 0 || end < 0 ? null : html.slice(start, end);
}

function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const financialValues = ["680.6", "104.4", "46.8"] as const;

function sellerInventoryProjections(): readonly unknown[] {
  const lot: Lot = {
    id: "lot-malformed-cost",
    tenantId: "tenant-a",
    productId: "product-a",
    expiresAt: "2027-01-01",
    initialQuantity: 10,
    availableQuantity: 4,
    unitCost: 91.25,
    status: "AVAILABLE",
    version: 1,
  };
  const balance: InventoryBalance = {
    tenantId: "tenant-a",
    productId: "product-a",
    lotId: lot.id,
    availableQuantity: 4,
    unitCost: 91.25,
  };
  return [operationalLot(lot, "seller"), operationalBalance(balance, "seller")];
}

function sellerBiStates(): readonly string[] {
  return [
    renderInventoryBiDashboard({
      role: "seller",
      status: "LOADING",
      stockByCategory: [],
      expirationRisk: [],
      movementSummary: [],
      alertsSummary: [],
    }),
    renderInventoryBiDashboard({
      role: "seller",
      status: "EMPTY",
      stockByCategory: [],
      expirationRisk: [],
      movementSummary: [],
      alertsSummary: [],
    }),
    renderInventoryBiDashboard({
      role: "seller",
      status: "ERROR",
      stockByCategory: [],
      expirationRisk: [],
      movementSummary: [],
      alertsSummary: [],
      error: "No se pudo cargar el resumen BI de inventario.",
    }),
    renderInventoryBiDashboard({
      role: "seller",
      status: "READY",
      summary: {
        totalProducts: 1,
        totalStockAvailable: 4,
        lowStockProducts: 1,
        productsExpiringSoon: 1,
        productsExpired: 0,
        activeAlerts: 1,
        inventoryValuation: 680.6,
      },
      stockByCategory: [
        {
          categoryId: "lacteos",
          categoryName: "Lacteos",
          stockAvailable: 4,
          lowStockProducts: 1,
          inventoryValuation: 104.4,
        },
      ],
      expirationRisk: [
        {
          lotId: "lot-1",
          productId: "product-1",
          productName: "Leche",
          categoryName: "Lacteos",
          expiresAt: "2027-01-01",
          availableQuantity: 4,
          riskState: "EXPIRING_SOON",
          estimatedLoss: 46.8,
        },
      ],
      movementSummary: [],
      alertsSummary: [],
    }),
  ];
}

describe("web stabilization seller privacy [T012, T040]", () => {
  it("does not mount restricted surfaces or expose cost, valuation, loss or purchase content to seller", () => {
    const sellerHtml = renderBodegiaDashboard("seller");
    const renderedRestrictedSections = sellerRestrictedSections.filter(
      (id) => section(sellerHtml, id) !== null,
    );
    const sensitiveContentSections = sellerRestrictedSections.filter((id) => {
      const content = section(sellerHtml, id);
      return (
        content !== null &&
        /costos?|valorizacion|perdida estimada|compras?/iu.test(
          visibleText(content),
        )
      );
    });
    const renderedFinancialValues = financialValues.filter((value) =>
      sellerHtml.includes(value),
    );
    const stateFinancialExposure = financialValues.filter((value) =>
      sellerBiStates().some((html) => html.includes(value)),
    );
    const stateRestrictedFields = [
      "unitCost",
      "inventoryValuation",
      "estimatedLoss",
    ].filter((field) => sellerBiStates().some((html) => html.includes(field)));
    const inventoryProjection = JSON.stringify(sellerInventoryProjections());

    expect({
      renderedRestrictedSections,
      sensitiveContentSections,
      renderedFinancialValues,
      stateFinancialExposure,
      stateRestrictedFields,
      inventoryProjectionExposesCost: /unitCost|91\.25/iu.test(
        inventoryProjection,
      ),
    }).toEqual({
      renderedRestrictedSections: [],
      sensitiveContentSections: [],
      renderedFinancialValues: [],
      stateFinancialExposure: [],
      stateRestrictedFields: [],
      inventoryProjectionExposesCost: false,
    });
  });
});
