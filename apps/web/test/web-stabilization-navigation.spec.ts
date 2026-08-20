import { describe, expect, it } from "vitest";
import type { InventoryWebRole } from "../src/api/inventory-client.js";
import { renderBodegiaDashboard } from "../src/demo/mvp-demo.js";

interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

function navigationFor(role: InventoryWebRole): readonly NavigationLink[] {
  const html = renderBodegiaDashboard(role);
  const sidebarStart = html.indexOf('<aside class="sidebar"');
  const sidebarEnd = html.indexOf("</aside>", sidebarStart);
  if (sidebarStart < 0 || sidebarEnd < 0) {
    throw new Error("PRIMARY_NAVIGATION_NOT_RENDERED");
  }

  return [...html.slice(sidebarStart, sidebarEnd).matchAll(
    /<a href="([^"]+)">([^<]+)<\/a>/gu,
  )].map((match) => {
    const href = match[1];
    const label = match[2];
    if (href === undefined || label === undefined) {
      throw new Error("PRIMARY_NAVIGATION_LINK_INVALID");
    }
    return { href, label };
  });
}

describe("web stabilization capability navigation [T011]", () => {
  it("shows owner_admin the administrative, operational, sales and Data Warehouse destinations without separate Permissions or Roadmap modules", () => {
    expect(navigationFor("owner_admin")).toEqual([
      { href: "#inicio", label: "Inicio" },
      { href: "#configuracion", label: "Configuracion de bodega" },
      { href: "#empleados", label: "Empleados y roles" },
      { href: "#ventas", label: "Ventas rapidas" },
      { href: "#oltp", label: "Operacion OLTP" },
      { href: "#warehouse", label: "Data Warehouse" },
      { href: "#bi", label: "BI/OLAP" },
    ]);
  });

  it("shows inventory_manager the authorized sales and inventory-operation destinations without owner-only navigation", () => {
    expect(navigationFor("inventory_manager")).toEqual([
      { href: "#inicio", label: "Inicio" },
      { href: "#ventas", label: "Ventas rapidas" },
      { href: "#oltp", label: "Operacion OLTP" },
    ]);
  });

  it("shows seller only permitted catalogue-stock and sales navigation", () => {
    expect(navigationFor("seller")).toEqual([
      { href: "#inicio", label: "Inicio" },
      { href: "#ventas", label: "Ventas rapidas" },
    ]);
  });
});
