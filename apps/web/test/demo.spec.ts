import { describe, expect, it } from "vitest";
import {
  renderBodegiaDashboard,
  renderBodegiaMvpDemo,
  renderDemoLogin,
} from "../src/demo/mvp-demo.js";

describe("BodeGIA MVP browser demo", () => {
  it("renders a professional demo access screen with MVP demo credentials", () => {
    const html = renderDemoLogin("owner_admin");

    expect(html).toContain("BodegIA");
    expect(html).toContain("Plataforma inteligente para bodegas familiares");
    expect(html).toContain("MVP web con login funcional");
    expect(html).toContain("Due&ntilde;o administrador");
    expect(html).toContain("Encargado de inventario");
    expect(html).toContain("Vendedor");
    expect(html).toContain("Iniciar sesi");
    expect(html).toContain("Modo demo");
    expect(html).toContain("propietario");
    expect(html).toContain("100001");
    expect(html).toContain("inventario");
    expect(html).toContain("100002");
    expect(html).toContain("vendedor");
    expect(html).toContain("100003");
    expect(html).not.toContain("password");
    expect(html).not.toContain("accessToken");
  });

  it("renders the requested session, configuration, employees, OLTP, DataMart, BI/OLAP, roles and roadmap sections", () => {
    const html = renderBodegiaMvpDemo("owner_admin");

    expect(html).toContain("BodegIA MVP");
    expect(html).toContain("Bodega San Crist");
    expect(html).toContain("Sesi&oacute;n MVP web");
    expect(html).toContain("Usuario: Propietario demo");
    expect(html).toContain("Cerrar sesi&oacute;n");
    expect(html).toContain("Configuraci&oacute;n de bodega");
    expect(html).toContain("Empleados y roles");
    expect(html).toContain("Guardar configuraci&oacute;n");
    expect(html).toContain("Ventas r&aacute;pidas");
    expect(html).toContain("Registrar venta");
    expect(html).toContain("Historial de ventas");
    expect(html).toContain("Operacion OLTP");
    expect(html).toContain("Data Warehouse / DataMart de Inventario");
    expect(html).toContain("BI/OLAP");
    expect(html).toContain("Permisos");
    expect(html).toContain("Roadmap");
    expect(html).toContain("public.products");
    expect(html).toContain("dw.dim_product");
    expect(html).toContain("dw.fact_inventory_movement");
    expect(html).toContain("OLTP</span><strong>DataMart dw</strong>");
    expect(html).toContain("Ventas avanzadas y pagos complejos");
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
    expect(html).not.toContain("Guardar configuraci&oacute;n");
    expect(html).toContain("Registrar venta");
    expect(html).toContain("Precio de venta");
    expect(html).toContain("Acceso reservado para due");
  });

  it("does not manufacture valuation for an administrative role without an API aggregate", () => {
    const html = renderBodegiaDashboard("inventory_manager");

    expect(html).toContain("Valorizacion");
    expect(html).toContain("S/ 0.00");
    expect(html).not.toContain("S/ 680.60");
    expect(html).toContain("Perdida estimada");
    expect(html).not.toContain("Guardar configuraci&oacute;n");
  });

  it("shows tenant configuration and employees only to owner_admin", () => {
    const ownerHtml = renderBodegiaDashboard("owner_admin");
    const sellerHtml = renderBodegiaDashboard("seller");

    expect(ownerHtml).toContain("Propietario demo");
    expect(ownerHtml).toContain("Encargado demo");
    expect(ownerHtml).toContain("Vendedor demo");
    expect(ownerHtml).toContain("Ayacucho, Peru");
    expect(sellerHtml).toContain("La administraci&oacute;n de empleados");
    expect(sellerHtml).not.toContain("Propietario demo</strong>");
  });
});
