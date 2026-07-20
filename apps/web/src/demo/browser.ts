import { renderBodegiaDashboard, renderDemoLogin } from "./mvp-demo.js";
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

function root(): HTMLDivElement {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app === null) throw new Error("DEMO_ROOT_NOT_FOUND");
  return app;
}

function chosenRole(fallback: InventoryWebRole): InventoryWebRole {
  const selected = document.querySelector<HTMLInputElement>(
    'input[name="demo-role-card"]:checked',
  );
  const value = selected?.value;
  return roles.has(value as InventoryWebRole)
    ? (value as InventoryWebRole)
    : fallback;
}

function mountLogin(role: InventoryWebRole): void {
  root().innerHTML = renderDemoLogin(role);
  document.querySelector("#enter-dashboard")?.addEventListener("click", () => {
    mountDashboard(chosenRole(role));
  });
  document
    .querySelectorAll<HTMLInputElement>('input[name="demo-role-card"]')
    .forEach((input) => {
      input.addEventListener("change", () => {
        mountLogin(chosenRole(role));
      });
    });
}

function mountDashboard(role: InventoryWebRole): void {
  root().innerHTML = renderBodegiaDashboard(role);
  document
    .querySelector("#change-demo-user")
    ?.addEventListener("click", () => mountLogin(role));
}

mountLogin(selectedRole());
