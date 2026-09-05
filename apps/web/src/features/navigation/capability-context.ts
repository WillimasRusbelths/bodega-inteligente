import { isRoleCode, permissionsForRoles } from "@bodegia/authz-catalog";

export interface CapabilityContextInput {
  readonly activeTenant?: {
    readonly capabilities: readonly string[];
  } | null;
  readonly effectivePermissions?: readonly string[];
  /** Explicit local-demo fallback; general presentation must not derive from a role. */
  readonly demoRole?: string;
}

export interface ResolvedCapabilityContext {
  readonly capabilities: readonly string[];
  readonly source:
    | "active-tenant"
    | "effective-permissions"
    | "demo-role-fallback";
}

function immutableCapabilities(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function resolveCapabilityContext(
  input: CapabilityContextInput,
): ResolvedCapabilityContext {
  if (input.activeTenant !== undefined && input.activeTenant !== null) {
    return {
      capabilities: immutableCapabilities(input.activeTenant.capabilities),
      source: "active-tenant",
    };
  }
  if (input.effectivePermissions !== undefined) {
    return {
      capabilities: immutableCapabilities(input.effectivePermissions),
      source: "effective-permissions",
    };
  }
  if (input.demoRole === undefined || !isRoleCode(input.demoRole)) {
    throw new Error("EFFECTIVE_CAPABILITIES_REQUIRED");
  }
  return {
    capabilities: permissionsForRoles([input.demoRole]),
    source: "demo-role-fallback",
  };
}
