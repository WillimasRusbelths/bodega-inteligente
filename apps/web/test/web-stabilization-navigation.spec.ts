import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { InventoryWebRole } from "../src/api/inventory-client.js";
import { renderBodegiaDashboard } from "../src/demo/mvp-demo.js";

interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

interface CapabilityNavigationModule {
  readonly resolveCapabilityNavigation: (input: {
    readonly capabilities: readonly string[];
    readonly requestedHref?: string;
  }) => {
    readonly links: readonly NavigationLink[];
    readonly currentHref: string;
  };
}

const capabilityNavigationPath = resolve(
  process.cwd(),
  "apps/web/src/features/navigation/capability-navigation.ts",
);

async function loadCapabilityNavigation(): Promise<CapabilityNavigationModule> {
  if (!existsSync(capabilityNavigationPath)) {
    throw new Error("CAPABILITY_NAVIGATION_NOT_IMPLEMENTED");
  }
  const module = (await import(
    pathToFileURL(capabilityNavigationPath).href
  )) as Partial<CapabilityNavigationModule>;
  if (module.resolveCapabilityNavigation === undefined) {
    throw new Error("CAPABILITY_NAVIGATION_NOT_IMPLEMENTED");
  }
  return { resolveCapabilityNavigation: module.resolveCapabilityNavigation };
}

function navigationFor(role: InventoryWebRole): readonly NavigationLink[] {
  const html = renderBodegiaDashboard(role);
  const sidebarStart = html.indexOf('<aside class="sidebar"');
  const sidebarEnd = html.indexOf("</aside>", sidebarStart);
  if (sidebarStart < 0 || sidebarEnd < 0) {
    throw new Error("PRIMARY_NAVIGATION_NOT_RENDERED");
  }

  return [
    ...html
      .slice(sidebarStart, sidebarEnd)
      .matchAll(/<a href="([^"]+)">([^<]+)<\/a>/gu),
  ].map((match) => {
    const href = match[1];
    const label = match[2];
    if (href === undefined || label === undefined) {
      throw new Error("PRIMARY_NAVIGATION_LINK_INVALID");
    }
    return { href, label };
  });
}

describe("web stabilization capability navigation [T011, T039]", () => {
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

  it("rejects an unauthorized deep link and fully recalculates navigation after changing tenant capabilities", async () => {
    const { resolveCapabilityNavigation } = await loadCapabilityNavigation();
    const owner = resolveCapabilityNavigation({
      capabilities: [
        "access.memberships.read",
        "access.audit.read",
        "inventory.products.read",
        "inventory.stock.read",
        "inventory.movements.read",
        "inventory.alerts.read",
        "sales.read",
      ],
      requestedHref: "#warehouse",
    });
    expect(owner.currentHref).toBe("#warehouse");

    const sellerAfterTenantChange = resolveCapabilityNavigation({
      capabilities: [
        "inventory.products.read",
        "inventory.stock.read",
        "sales.read",
        "sales.write",
      ],
      requestedHref: owner.currentHref,
    });
    expect(sellerAfterTenantChange).toEqual({
      currentHref: "#inicio",
      links: [
        { href: "#inicio", label: "Inicio" },
        { href: "#ventas", label: "Ventas rapidas" },
      ],
    });
  });

  it("falls back safely when a deep link does not name any authorized destination", async () => {
    const { resolveCapabilityNavigation } = await loadCapabilityNavigation();

    expect(
      resolveCapabilityNavigation({
        capabilities: ["inventory.products.read", "sales.read"],
        requestedHref: "#tenant-admin-private",
      }).currentHref,
    ).toBe("#inicio");
  });
});
