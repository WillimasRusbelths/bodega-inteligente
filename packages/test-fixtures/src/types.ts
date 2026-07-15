export type SyntheticRole = "OWNER" | "SELLER" | "INVENTORY_MANAGER";

export interface SyntheticTenant {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
}

export interface SyntheticUser {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
}

export interface SyntheticMembership {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly roles: readonly SyntheticRole[];
  readonly createdAt: string;
}

export interface SyntheticDevice {
  readonly id: string;
  readonly userId: string;
  readonly label: string;
  readonly createdAt: string;
}
