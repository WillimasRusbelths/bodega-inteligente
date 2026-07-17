import type { Membership } from "./membership-admin.js";
import type { EditorState } from "./RoleEditor.js";

export interface StatusEditorApi {
  changeStatus(input: {
    readonly membershipId: string;
    readonly status: "ACTIVE" | "DISABLED";
    readonly reason: string;
    readonly ifMatch: string;
  }): Promise<Membership>;
}

function errorCode(error: unknown): string | null {
  if (error === null || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>)["code"];
  return typeof code === "string" ? code : null;
}

export class StatusEditorController {
  #state: EditorState = { status: "IDLE" };

  public constructor(
    private readonly api: StatusEditorApi,
    private membership: Membership,
    private readonly actorPermissions: readonly string[],
    private readonly activeOwnerCount: number,
  ) {}

  public get state(): EditorState {
    return this.#state;
  }

  public get visible(): boolean {
    return this.actorPermissions.includes("access.memberships.manage");
  }

  public async save(
    status: "ACTIVE" | "DISABLED",
    reason: string,
  ): Promise<void> {
    if (!this.visible) {
      this.#state = { status: "BLOCKED", message: "Acción no autorizada." };
      return;
    }
    if (
      status === "DISABLED" &&
      this.membership.status === "ACTIVE" &&
      this.membership.roles.includes("owner_admin") &&
      this.activeOwnerCount <= 1
    ) {
      this.#state = {
        status: "BLOCKED",
        message: "No puedes desactivar al último propietario activo.",
      };
      return;
    }
    this.#state = { status: "SAVING" };
    try {
      this.membership = await this.api.changeStatus({
        membershipId: this.membership.id,
        status,
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
              message: "No se pudo cambiar el estado del miembro.",
            };
    }
  }
}

export function StatusEditor(controller: StatusEditorController): EditorState {
  return controller.state;
}
