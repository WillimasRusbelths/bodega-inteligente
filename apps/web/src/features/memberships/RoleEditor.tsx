import {
  canManageMembershipRoles,
  type Membership,
  type RoleCode,
} from "./membership-admin.js";

export interface RoleEditorApi {
  replaceRoles(input: {
    readonly membershipId: string;
    readonly roles: readonly RoleCode[];
    readonly reason: string;
    readonly ifMatch: string;
  }): Promise<Membership>;
}

export type EditorState =
  | { readonly status: "IDLE" }
  | { readonly status: "SAVING" }
  | { readonly status: "SUCCESS"; readonly membership: Membership }
  | { readonly status: "STALE"; readonly message: string }
  | { readonly status: "BLOCKED"; readonly message: string }
  | { readonly status: "ERROR"; readonly message: string };

function errorCode(error: unknown): string | null {
  if (error === null || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>)["code"];
  return typeof code === "string" ? code : null;
}

export class RoleEditorController {
  #state: EditorState = { status: "IDLE" };

  public constructor(
    private readonly api: RoleEditorApi,
    private membership: Membership,
    private readonly actorPermissions: readonly string[],
    private readonly activeOwnerCount: number,
  ) {}

  public get state(): EditorState {
    return this.#state;
  }

  public get visible(): boolean {
    return canManageMembershipRoles(this.actorPermissions);
  }

  public async save(roles: readonly RoleCode[], reason: string): Promise<void> {
    if (!this.visible) {
      this.#state = { status: "BLOCKED", message: "Acción no autorizada." };
      return;
    }
    if (
      this.membership.status === "ACTIVE" &&
      this.membership.roles.includes("owner_admin") &&
      !roles.includes("owner_admin") &&
      this.activeOwnerCount <= 1
    ) {
      this.#state = {
        status: "BLOCKED",
        message: "La bodega debe conservar al menos un propietario activo.",
      };
      return;
    }
    this.#state = { status: "SAVING" };
    try {
      this.membership = await this.api.replaceRoles({
        membershipId: this.membership.id,
        roles: [...roles],
        reason,
        ifMatch: `"${this.membership.version}"`,
      });
      this.#state = { status: "SUCCESS", membership: this.membership };
    } catch (error) {
      this.#state =
        errorCode(error) === "STALE_STATE"
          ? {
              status: "STALE",
              message:
                "El miembro cambió. Actualiza la vista antes de reintentar.",
            }
          : {
              status: "ERROR",
              message: "No se pudieron actualizar los roles.",
            };
    }
  }
}

export function RoleEditor(controller: RoleEditorController): EditorState {
  return controller.state;
}

export interface MembershipRoleView {
  readonly id: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly status: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Framework-neutral view embedded by the Employees surface. It uses the same
 * capability predicate as RoleEditorController and never replaces API guards.
 */
export function renderMembershipRoleManagement(
  memberships: readonly MembershipRoleView[],
  actorPermissions: readonly string[],
): string {
  if (!canManageMembershipRoles(actorPermissions)) return "";
  const items = memberships
    .map(
      (
        membership,
      ) => `<article class="card membership-role-card" data-membership-id="${escapeHtml(membership.id)}">
        <h4>${escapeHtml(membership.displayName)}</h4>
        <p>Rol vigente: ${escapeHtml(membership.roles.join(", "))} &middot; ${escapeHtml(membership.status)}</p>
        <p class="permission-note">Los cambios de rol y permisos se validan en el backend para esta pertenencia.</p>
      </article>`,
    )
    .join("");
  return `<div class="membership-role-management" data-testid="membership-role-management">
    <h3>Gestion de roles y permisos</h3>
    <p>Administracion integrada en Empleados para la bodega activa.</p>
    <div class="role-grid">${items}</div>
  </div>`;
}
