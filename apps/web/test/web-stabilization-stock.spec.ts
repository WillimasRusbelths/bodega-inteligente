import { describe, expect, it } from "vitest";
import {
  renderBodegiaDashboard,
  type QuickSalesDashboardData,
} from "../src/demo/mvp-demo.js";

const lecheEvaporada = {
  id: "00000000-0000-4000-8000-000000000301",
  name: "Leche evaporada",
  sku: "LAC-LEC-001",
  barcode: "7750001000011",
  status: "ACTIVE",
  salePrice: 5.5,
};

function salesData(availableStock: number): QuickSalesDashboardData {
  return {
    products: [{ ...lecheEvaporada, availableStock }],
    sales: [],
  };
}

function section(html: string, id: string): string {
  const start = html.indexOf(`<section id="${id}"`);
  const end = html.indexOf("</section>", start);
  if (start < 0 || end < 0) throw new Error(`SECTION_NOT_FOUND:${id}`);
  return html.slice(start, end);
}

function stockReadings(html: string): {
  readonly quickSale: number;
  readonly operation: number;
  readonly executiveIndicator: number;
  readonly biIndicator: number;
} {
  const quickSale = /data-stock="(\d+)"/u.exec(section(html, "ventas"));
  const operation =
    /Leche evaporada<\/strong><small>LAC-LEC-001<\/small><\/td><td>Lacteos<\/td><td>(\d+)<\/td>/u.exec(
      section(html, "oltp"),
    );
  const executive =
    /<span>Stock disponible<\/span><strong>(\d+)<\/strong>/u.exec(
      section(html, "inicio"),
    );
  const bi = /<span>Stock disponible<\/span><strong>(\d+)<\/strong>/u.exec(
    section(html, "bi"),
  );
  if (quickSale === null || operation === null || executive === null || bi === null)
    throw new Error("AUTHORITATIVE_STOCK_NOT_RENDERED");
  return {
    quickSale: Number(quickSale[1]),
    operation: Number(operation[1]),
    executiveIndicator: Number(executive[1]),
    biIndicator: Number(bi[1]),
  };
}

describe("web stabilization authoritative stock [T010]", () => {
  it("keeps quick sales, operation and indicators coherent before and after a confirmed sale", () => {
    const beforeSale = stockReadings(
      renderBodegiaDashboard("owner_admin", undefined, salesData(18)),
    );
    expect(beforeSale).toEqual({
      quickSale: 18,
      operation: 18,
      executiveIndicator: 135,
      biIndicator: 135,
    });

    const afterSale = stockReadings(
      renderBodegiaDashboard("owner_admin", undefined, salesData(17)),
    );
    expect(afterSale).toEqual({
      quickSale: 17,
      operation: 17,
      executiveIndicator: 134,
      biIndicator: 134,
    });
  });
});
