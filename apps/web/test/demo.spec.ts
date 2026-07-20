import { describe, expect, it } from "vitest";
import { renderBodegiaMvpDemo } from "../src/demo/mvp-demo.js";

describe("BodegIA MVP browser demo", () => {
  it("renders the requested OLTP and BI/OLAP sections", () => {
    const html = renderBodegiaMvpDemo("owner_admin");

    expect(html).toContain("BodegIA MVP");
    expect(html).toContain("Demo mode");
    expect(html).toContain("Productos");
    expect(html).toContain("Lotes");
    expect(html).toContain("Movimientos");
    expect(html).toContain("Stock");
    expect(html).toContain("Alertas");
    expect(html).toContain("FEFO");
    expect(html).toContain("OLAP / BI");
    expect(html).toContain("Modelo dimensional / DataMart");
    expect(html).toContain("Stock por categor");
    expect(html).toContain("Riesgo de vencimiento");
    expect(html).toContain("dim_product");
    expect(html).toContain("fact_inventory_movement");
  });

  it("keeps seller demo output free of valuation and cost fields", () => {
    const html = renderBodegiaMvpDemo("seller");

    expect(html).toContain("Vista seller");
    expect(html).not.toContain("bi-valuation");
    expect(html).not.toContain("680.6");
    expect(html).not.toContain("unitCost");
    expect(html).not.toContain("estimatedLoss");
  });

  it("keeps out-of-scope modules out of the demo copy", () => {
    const html = renderBodegiaMvpDemo("inventory_manager");

    expect(html).not.toMatch(
      /href="#(?:sales|customers|ocr|ai|offline)"|>Clientes<|>OCR<|>IA<|>Offline</iu,
    );
  });
});
