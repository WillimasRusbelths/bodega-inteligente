import type { components } from "@bodegia/api-contract";
import type { MobileApiClient } from "../../api/client.js";
import type { SecureSessionStore } from "../../security/secure-store.js";

type MembershipChoice = components["schemas"]["MembershipChoice"];
type SelectionResponse = components["schemas"]["TenantSelectionResponse"];

export interface TenantSelectionApi {
  listActiveMemberships(): Promise<readonly MembershipChoice[]>;
  selectActiveTenant(membershipId: string): Promise<SelectionResponse>;
}

export class MobileTenantSelectionHttpApi implements TenantSelectionApi {
  public constructor(private readonly client: MobileApiClient) {}

  public listActiveMemberships(): Promise<readonly MembershipChoice[]> {
    return this.client.request<readonly MembershipChoice[]>({
      method: "GET",
      path: "/me/memberships",
      authenticated: true,
    });
  }

  public selectActiveTenant(membershipId: string): Promise<SelectionResponse> {
    return this.client.request<
      SelectionResponse,
      { readonly membershipId: string }
    >({
      method: "POST",
      path: "/sessions/current/tenant",
      body: { membershipId },
      authenticated: true,
    });
  }
}

export type TenantSelectorState =
  | { readonly status: "LOADING" }
  | { readonly status: "EMPTY" }
  | {
      readonly status: "SELECTION_REQUIRED";
      readonly memberships: readonly MembershipChoice[];
    }
  | {
      readonly status: "ACTIVE";
      readonly membershipId: string;
      readonly tenantId: string;
      readonly tenantName: string;
      readonly roles: readonly string[];
      readonly permissions: readonly string[];
      readonly contextVersion: number;
    }
  | { readonly status: "ERROR"; readonly message: string };

/** Replaces, rather than merges, every tenant-derived capability. */
export class TenantSelector {
  #state: TenantSelectorState = { status: "LOADING" };

  public constructor(
    private readonly api: TenantSelectionApi,
    private readonly store: SecureSessionStore,
  ) {}

  public get state(): TenantSelectorState {
    return this.#state;
  }

  public async load(): Promise<void> {
    this.#state = { status: "LOADING" };
    try {
      const memberships = await this.api.listActiveMemberships();
      if (memberships.length === 0) {
        this.#state = { status: "EMPTY" };
      } else if (memberships.length === 1) {
        const membership = memberships[0];
        if (membership !== undefined)
          await this.select(membership.membershipId);
      } else {
        this.#state = {
          status: "SELECTION_REQUIRED",
          memberships: [...memberships],
        };
      }
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudieron cargar las bodegas disponibles.",
      };
    }
  }

  public async select(membershipId: string): Promise<void> {
    this.#state = { status: "LOADING" };
    try {
      const response = await this.api.selectActiveTenant(membershipId);
      const active = response.activeTenant;
      await this.store.replaceAccessContext({
        accessToken: response.accessToken,
        activeContext: active,
      });
      this.#state = {
        status: "ACTIVE",
        membershipId: active.membershipId,
        tenantId: active.tenantId,
        tenantName: active.tenantName,
        roles: [...active.roles],
        permissions: [...active.capabilities],
        contextVersion: response.contextVersion,
      };
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudo cambiar la bodega activa.",
      };
    }
  }
}
