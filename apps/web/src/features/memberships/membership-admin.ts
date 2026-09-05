import type { components } from "@bodegia/api-contract";
import type { WebApiClient } from "../../api/client.js";

export type Membership = components["schemas"]["Membership"];
export type RoleCode = components["schemas"]["RoleCode"];
export type ActivationIssue =
  components["schemas"]["ActivationChallengeIssueResponse"];

export const MEMBERSHIP_ROLE_MANAGEMENT_CAPABILITY =
  "access.roles.manage" as const;

/** Shared presentation/controller rule; the backend remains authoritative. */
export function canManageMembershipRoles(
  actorPermissions: readonly string[],
): boolean {
  return actorPermissions.includes(MEMBERSHIP_ROLE_MANAGEMENT_CAPABILITY);
}

export interface MembershipAdminApi {
  list(): Promise<readonly Membership[]>;
  create(input: {
    readonly displayName: string;
    readonly phone: string;
    readonly roles: readonly RoleCode[];
    readonly idempotencyKey: string;
  }): Promise<Membership>;
  issueActivation(input: {
    readonly membershipId: string;
    readonly purpose: "INITIAL_ACTIVATION" | "DEVICE_REACTIVATION";
    readonly idempotencyKey: string;
  }): Promise<ActivationIssue>;
}

export class WebMembershipHttpApi implements MembershipAdminApi {
  public constructor(private readonly client: WebApiClient) {}

  public async list(): Promise<readonly Membership[]> {
    const page = await this.client.request<
      components["schemas"]["MembershipPage"]
    >({
      method: "GET",
      path: "/tenants/current/members",
      authenticated: true,
      tenantScoped: true,
    });
    return page.items;
  }

  public create(input: {
    readonly displayName: string;
    readonly phone: string;
    readonly roles: readonly RoleCode[];
    readonly idempotencyKey: string;
  }): Promise<Membership> {
    return this.client.request<
      Membership,
      components["schemas"]["CreateMembershipRequest"]
    >({
      method: "POST",
      path: "/tenants/current/members",
      authenticated: true,
      tenantScoped: true,
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: {
        displayName: input.displayName,
        phone: input.phone,
        roles: input.roles,
      },
    });
  }

  public issueActivation(input: {
    readonly membershipId: string;
    readonly purpose: "INITIAL_ACTIVATION" | "DEVICE_REACTIVATION";
    readonly idempotencyKey: string;
  }): Promise<ActivationIssue> {
    return this.client.request<
      ActivationIssue,
      { readonly purpose: typeof input.purpose }
    >({
      method: "POST",
      path: `/tenants/current/members/${encodeURIComponent(input.membershipId)}/activation-challenges`,
      authenticated: true,
      tenantScoped: true,
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: { purpose: input.purpose },
    });
  }

  public replaceRoles(input: {
    readonly membershipId: string;
    readonly roles: readonly RoleCode[];
    readonly reason: string;
    readonly ifMatch: string;
  }): Promise<Membership> {
    return this.client.request<
      Membership,
      { readonly roles: readonly RoleCode[]; readonly reason: string }
    >({
      method: "PATCH",
      path: `/tenants/current/members/${encodeURIComponent(input.membershipId)}/roles`,
      authenticated: true,
      tenantScoped: true,
      headers: { "If-Match": input.ifMatch },
      body: { roles: input.roles, reason: input.reason },
    });
  }

  public changeStatus(input: {
    readonly membershipId: string;
    readonly status: "ACTIVE" | "DISABLED";
    readonly reason: string;
    readonly ifMatch: string;
  }): Promise<Membership> {
    return this.client.request<
      Membership,
      {
        readonly status: "ACTIVE" | "DISABLED";
        readonly reason: string;
      }
    >({
      method: "PATCH",
      path: `/tenants/current/members/${encodeURIComponent(input.membershipId)}/status`,
      authenticated: true,
      tenantScoped: true,
      headers: { "If-Match": input.ifMatch },
      body: { status: input.status, reason: input.reason },
    });
  }
}

export type MembershipAdminState =
  | { readonly status: "LOADING" }
  | { readonly status: "EMPTY" }
  | { readonly status: "READY"; readonly items: readonly Membership[] }
  | { readonly status: "SUCCESS"; readonly message: string }
  | { readonly status: "ERROR"; readonly message: string };

export interface OneTimeActivationView {
  readonly membershipId: string;
  readonly qrPayload: string;
  readonly manualCode: string;
  readonly expiresAt: string;
  readonly maxAttempts: number;
}

/** Tenant-scoped membership workflow with explicit one-time secret lifecycle. */
export class MembershipAdmin {
  #state: MembershipAdminState = { status: "LOADING" };
  #oneTimeActivation: OneTimeActivationView | null = null;

  public constructor(
    private readonly api: MembershipAdminApi,
    private readonly activeTenantId: () => string | null,
  ) {}

  public get state(): MembershipAdminState {
    return this.#state;
  }

  public get oneTimeActivation(): OneTimeActivationView | null {
    return this.#oneTimeActivation;
  }

  public async load(): Promise<void> {
    this.assertActiveTenant();
    this.#state = { status: "LOADING" };
    try {
      const items = await this.api.list();
      this.#state =
        items.length === 0
          ? { status: "EMPTY" }
          : { status: "READY", items: [...items] };
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudieron cargar los miembros.",
      };
    }
  }

  public async create(input: {
    readonly displayName: string;
    readonly phone: string;
    readonly initialRole: RoleCode;
    readonly idempotencyKey: string;
  }): Promise<Membership> {
    this.assertActiveTenant();
    const membership = await this.api.create({
      displayName: input.displayName,
      phone: input.phone,
      roles: [input.initialRole],
      idempotencyKey: input.idempotencyKey,
    });
    this.#state = {
      status: "SUCCESS",
      message: "La pertenencia pendiente fue creada.",
    };
    return membership;
  }

  public async issueActivation(input: {
    readonly membershipId: string;
    readonly purpose: "INITIAL_ACTIVATION" | "DEVICE_REACTIVATION";
    readonly idempotencyKey: string;
  }): Promise<void> {
    this.assertActiveTenant();
    const issued = await this.api.issueActivation(input);
    this.#oneTimeActivation = {
      membershipId: input.membershipId,
      qrPayload: issued.qrPayload,
      manualCode: issued.manualCode,
      expiresAt: issued.expiresAt,
      maxAttempts: issued.maxAttempts,
    };
  }

  public leaveActivationView(): void {
    this.#oneTimeActivation = null;
  }

  private assertActiveTenant(): void {
    if (this.activeTenantId() === null) {
      throw new Error("ACTIVE_TENANT_REQUIRED");
    }
  }
}
