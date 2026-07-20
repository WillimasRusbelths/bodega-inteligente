import { renderBodegiaMvpDemo } from "./mvp-demo.js";
import type { InventoryWebRole } from "../api/inventory-client.js";

const roles = new Set<InventoryWebRole>([
  "owner_admin",
  "inventory_manager",
  "seller",
]);

function selectedRole(): InventoryWebRole {
  const params = new URLSearchParams(globalThis.location.search);
  const candidate = params.get("role");
  return roles.has(candidate as InventoryWebRole)
    ? (candidate as InventoryWebRole)
    : "owner_admin";
}

function mount(role: InventoryWebRole): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app === null) throw new Error("DEMO_ROOT_NOT_FOUND");
  app.innerHTML = renderBodegiaMvpDemo(role);
  document.querySelector("#demo-role")?.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    if (roles.has(value as InventoryWebRole)) mount(value as InventoryWebRole);
  });
}

mount(selectedRole());
