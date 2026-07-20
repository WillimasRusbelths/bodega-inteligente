import { describe, expect, it } from "vitest";
import {
  renderBodegiaDashboard,
  renderBodegiaMvpDemo,
  renderDemoLogin,
} from "../src/demo/mvp-demo.js";

describe("BodeGIA MVP browser demo", () => {
  it("renders a professional demo access screen without real authentication", () => {
    const html = renderDemoLogin("owner_admin");

    expect(html).toContain("BodegIA");
    expect(html).toContain("Plataforma inteligente para bodegas familiares");
    expect(html).toContain("MVP web administrativo y anal");
    expect(html).toContain("Due&ntilde;o administrador");
    expect(html).toContain("Encargado de inventario");
    expect(html).toContain("Vendedor");
    expect(html).toContain("Entrar al dashboard");
    expect(html).toContain("Modo demo");
    expect(html).toContain("El acceso por rol es simulado");
    expect(html).not.toContain("password");
    expect(html).not.toContain("accessToken");
  });

  it("renders the requested OLTP, DataMart, BI/OLAP, roles and roadmap sections", () => {
    const html = renderBodegiaMvpDemo("owner_admin");

    expect(html).toContain("BodegIA MVP");
    expect(html).toContain("Bodega San Crist");
    expect(html).toContain("Operacion OLTP");
    expect(html).toContain("Data Warehouse / DataMart de Inventario");
    expect(html).toContain("BI/OLAP");
    expect(html).toContain("Roles");
    expect(html).toContain("Roadmap");
    expect(html).toContain("public.products");
    expect(html).toContain("dw.dim_product");
    expect(html).toContain("dw.fact_inventory_movement");
    expect(html).toContain("OLTP</span><strong>DataMart dw</strong>");
    expect(html).toContain("DataMart de Ventas");
    expect(html).toContain("Sistema final planificado");
  });

  it("keeps seller demo output free of valuation and cost fields", () => {
    const html = renderBodegiaDashboard("seller");

    expect(html).toContain("Vista operativa: costos protegidos");
    expect(html).not.toContain("Valorizacion");
    expect(html).not.toContain("S/ 680.60");
    expect(html).not.toContain("S/ 46.80");
    expect(html).not.toContain("<th>Costo</th>");
    expect(html).not.toContain("Perdida estimada");
  });

  it("shows authorized valuation to administrative roles", () => {
    const html = renderBodegiaDashboard("inventory_manager");

    expect(html).toContain("Valorizacion");
    expect(html).toContain("S/ 680.60");
    expect(html).toContain("Perdida estimada");
  });
});
