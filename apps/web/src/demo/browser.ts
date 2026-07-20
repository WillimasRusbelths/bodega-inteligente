import type { InventoryWebRole } from "../api/inventory-client.js";
import {
  renderBodegiaDashboard,
  renderDemoLogin,
  type DemoEmployee,
  type DemoTenantSession,
  type DemoWebSession,
} from "./mvp-demo.js";

const roles = new Set<InventoryWebRole>([
  "owner_admin",
  "inventory_manager",
  "seller",
]);

type ApiResponse<T> =
  | { readonly data: T }
  | {
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly correlationId: string;
      };
    };

function selectedRole(): InventoryWebRole {
  const params = new URLSearchParams(globalThis.location.search);
  const candidate = params.get("role");
  return roles.has(candidate as InventoryWebRole)
    ? (candidate as InventoryWebRole)
    : "owner_admin";
}

function apiBaseUrl(): string {
  const configured = globalThis.sessionStorage.getItem("BODEGIA_API_BASE_URL");
  if (configured !== null && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/u, "");
  }
  return `${globalThis.location.protocol}//${globalThis.location.hostname}:3000`;
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

async function readApi<T>(
  path: string,
  sessionId?: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionId === undefined ? {} : { "X-Demo-Session": sessionId }),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || "error" in payload) {
    const message =
      "error" in payload
        ? `${payload.error.code} (${payload.error.correlationId})`
        : "REQUEST_FAILED";
    throw new Error(message);
  }
  return payload.data;
}

async function loadEmployees(session: DemoWebSession): Promise<DemoWebSession> {
  if (session.membership.role !== "owner_admin") return session;
  const employees = await readApi<readonly DemoEmployee[]>(
    "/tenants/current/memberships",
    session.sessionId,
  );
  return { ...session, employees };
}

function setLoginError(message: string): void {
  const error = document.querySelector<HTMLElement>("#login-error");
  if (error !== null) error.textContent = message;
}

function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

async function login(role: InventoryWebRole): Promise<void> {
  const form = document.querySelector<HTMLFormElement>("#demo-login-form");
  if (form === null) return;
  const data = new FormData(form);
  const username = formText(data, "username");
  const pin = formText(data, "pin");
  try {
    setLoginError("");
    const session = await readApi<DemoWebSession>(
      "/demo/auth/login",
      undefined,
      {
        method: "POST",
        body: JSON.stringify({ username, pin }),
      },
    );
    globalThis.sessionStorage.setItem(
      "BODEGIA_DEMO_SESSION",
      session.sessionId,
    );
    mountDashboard(await loadEmployees(session));
  } catch (error) {
    const suffix = error instanceof Error ? ` ${error.message}` : "";
    setLoginError(
      `No se pudo iniciar sesion. Verifica que la API este levantada.${suffix}`,
    );
    mountLogin(role);
  }
}

function bindLogin(role: InventoryWebRole): void {
  document
    .querySelector("#demo-login-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      void login(chosenRole(role));
    });
  document
    .querySelectorAll<HTMLInputElement>('input[name="demo-role-card"]')
    .forEach((input) => {
      input.addEventListener("change", () => {
        mountLogin(chosenRole(role));
      });
    });
}

function mountLogin(role: InventoryWebRole): void {
  root().innerHTML = renderDemoLogin(role);
  bindLogin(role);
}

async function logout(session: DemoWebSession): Promise<void> {
  try {
    await readApi<{ readonly loggedOut: boolean }>(
      "/demo/auth/logout",
      session.sessionId,
      { method: "POST", body: "{}" },
    );
  } finally {
    globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
    mountLogin(session.membership.role);
  }
}

function tenantSettingsFromForm(
  form: HTMLFormElement,
): Partial<DemoTenantSession> {
  const data = new FormData(form);
  return {
    name: formText(data, "name"),
    locationText: formText(data, "locationText"),
    currencyCode: formText(data, "currencyCode"),
    referenceSchedule: formText(data, "referenceSchedule"),
    status: formText(data, "status") || "ACTIVE",
  };
}

function bindSettings(session: DemoWebSession): void {
  document
    .querySelector<HTMLFormElement>("#tenant-settings-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const result = document.querySelector<HTMLElement>("#settings-result");
      void readApi<DemoTenantSession>(
        "/tenants/current/settings",
        session.sessionId,
        {
          method: "PATCH",
          body: JSON.stringify(tenantSettingsFromForm(form)),
        },
      )
        .then((tenant) => {
          if (result !== null) {
            result.textContent = "Configuracion actualizada.";
          }
          mountDashboard({ ...session, tenant });
        })
        .catch((error: unknown) => {
          if (result !== null) {
            result.textContent =
              error instanceof Error
                ? `No se pudo guardar: ${error.message}`
                : "No se pudo guardar.";
          }
        });
    });
}

function bindDashboard(session: DemoWebSession): void {
  document
    .querySelector("#logout-demo-user")
    ?.addEventListener("click", () => void logout(session));
  bindSettings(session);
}

function mountDashboard(session: DemoWebSession): void {
  root().innerHTML = renderBodegiaDashboard(session.membership.role, session);
  bindDashboard(session);
}

async function restoreSession(role: InventoryWebRole): Promise<void> {
  const sessionId = globalThis.sessionStorage.getItem("BODEGIA_DEMO_SESSION");
  if (sessionId === null) {
    mountLogin(role);
    return;
  }
  try {
    const session = await readApi<DemoWebSession>(
      "/demo/auth/session",
      sessionId,
    );
    mountDashboard(await loadEmployees(session));
  } catch {
    globalThis.sessionStorage.removeItem("BODEGIA_DEMO_SESSION");
    mountLogin(role);
  }
}

void restoreSession(selectedRole());
