export interface CapabilityNavigationLink {
  readonly href: string;
  readonly label: string;
}

interface CapabilityDestination extends CapabilityNavigationLink {
  readonly requiredAll?: readonly string[];
  readonly requiredAny?: readonly string[];
}

export interface CapabilityNavigation {
  readonly links: readonly CapabilityNavigationLink[];
  readonly currentHref: string;
}

const destinations: readonly CapabilityDestination[] = Object.freeze([
  {
    href: "#inicio",
    label: "Inicio",
    requiredAll: ["inventory.products.read"],
  },
  {
    href: "#configuracion",
    label: "Configuracion de bodega",
    requiredAll: ["access.memberships.manage"],
  },
  {
    href: "#empleados",
    label: "Empleados y roles",
    requiredAll: ["access.memberships.read"],
  },
  {
    href: "#ventas",
    label: "Ventas rapidas",
    requiredAll: ["sales.read"],
  },
  {
    href: "#oltp",
    label: "Operacion OLTP",
    requiredAny: [
      "inventory.lots.read",
      "inventory.movements.read",
      "inventory.alerts.read",
      "inventory.stock.adjust",
    ],
  },
  {
    href: "#warehouse",
    label: "Data Warehouse",
    requiredAll: ["access.audit.read"],
  },
  {
    href: "#bi",
    label: "BI/OLAP",
    requiredAll: ["access.audit.read"],
  },
]);

function isAuthorized(
  destination: CapabilityDestination,
  capabilities: ReadonlySet<string>,
): boolean {
  const hasAll =
    destination.requiredAll?.every((capability) =>
      capabilities.has(capability),
    ) ?? true;
  const hasAny =
    destination.requiredAny === undefined ||
    destination.requiredAny.some((capability) => capabilities.has(capability));
  return hasAll && hasAny;
}

/**
 * Builds navigation solely from effective capabilities. Unknown or no-longer
 * authorized deep links fall back to the first permitted destination.
 */
export function resolveCapabilityNavigation(input: {
  readonly capabilities: readonly string[];
  readonly requestedHref?: string;
}): CapabilityNavigation {
  const capabilities = new Set(input.capabilities);
  const links = Object.freeze(
    destinations
      .filter((destination) => isAuthorized(destination, capabilities))
      .map(({ href, label }) => Object.freeze({ href, label })),
  );
  const requested = links.find((link) => link.href === input.requestedHref);
  return Object.freeze({
    links,
    currentHref: requested?.href ?? links[0]?.href ?? "#inicio",
  });
}
