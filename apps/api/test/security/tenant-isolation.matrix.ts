/**
 * Reusable A/B attack matrix for tenant-scoped MVP operations.
 *
 * Every new API resource should add its adapter to the T130 harness and keep
 * these vectors: IDs in path/body/query, foreign cursors and nested relations.
 * The matrix deliberately covers only identity/access resources; sales,
 * inventory, products, customers and BI can consume it in later features.
 */

export type TenantLabel = "A" | "B";

export type TenantIsolationResource =
  | "Membership"
  | "Device"
  | "DeviceProfile"
  | "Session"
  | "ActivationChallenge"
  | "AuditEvent"
  | "TenantContext"
  | "TenantAdmin";

export type TenantIsolationOperation =
  | "readById"
  | "list"
  | "modify"
  | "admin"
  | "administration"
  | "nestedRead"
  | "nestedWrite";

export type TenantIsolationAttackVector =
  | "pathParam"
  | "bodyParam"
  | "queryParam"
  | "cursor"
  | "foreignId"
  | "missingId"
  | "nestedRelation"
  | "tenantContext";

export type TenantIsolationExpected =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "NO_DATA"
  | "NO_MUTATION";

export interface TenantIsolationCase {
  readonly id: string;
  readonly resource: TenantIsolationResource;
  readonly operation: TenantIsolationOperation;
  readonly sourceTenant: TenantLabel;
  readonly targetTenant: TenantLabel;
  readonly attackVector: TenantIsolationAttackVector;
  readonly expected: TenantIsolationExpected;
  readonly expectedCode:
    | "RESOURCE_NOT_FOUND"
    | "INSUFFICIENT_PERMISSION"
    | "SESSION_INVALID"
    | null;
}

const resources: readonly TenantIsolationResource[] = [
  "Membership",
  "Device",
  "DeviceProfile",
  "Session",
  "ActivationChallenge",
  "AuditEvent",
  "TenantContext",
  "TenantAdmin",
];

const foreignVectors: readonly TenantIsolationAttackVector[] = [
  "foreignId",
  "pathParam",
  "bodyParam",
  "queryParam",
  "cursor",
  "nestedRelation",
  "tenantContext",
];

const operations: readonly TenantIsolationOperation[] = [
  "readById",
  "list",
  "modify",
  "admin",
  "nestedRead",
  "nestedWrite",
];

function expectedFor(
  operation: TenantIsolationOperation,
  vector: TenantIsolationAttackVector,
): {
  readonly expected: TenantIsolationExpected;
  readonly expectedCode: TenantIsolationCase["expectedCode"];
} {
  if (
    operation === "admin" ||
    operation === "administration" ||
    vector === "tenantContext"
  ) {
    return { expected: "FORBIDDEN", expectedCode: "INSUFFICIENT_PERMISSION" };
  }
  if (operation === "list") {
    return { expected: "NO_DATA", expectedCode: "RESOURCE_NOT_FOUND" };
  }
  return { expected: "NOT_FOUND", expectedCode: "RESOURCE_NOT_FOUND" };
}

function buildCases(): readonly TenantIsolationCase[] {
  const cases: TenantIsolationCase[] = [];
  for (const sourceTenant of ["A", "B"] as const) {
    const targetTenant = sourceTenant === "A" ? "B" : "A";
    for (const resource of resources) {
      for (const operation of operations) {
        for (const vector of foreignVectors) {
          const expectation = expectedFor(operation, vector);
          cases.push({
            id: `${resource}-${operation}-${sourceTenant}-to-${targetTenant}-${vector}`,
            resource,
            operation,
            sourceTenant,
            targetTenant,
            attackVector: vector,
            ...expectation,
          });
        }
      }
      for (const operation of ["readById", "list", "modify"] as const) {
        cases.push({
          id: `${resource}-${operation}-${sourceTenant}-missing-id`,
          resource,
          operation,
          sourceTenant,
          targetTenant: sourceTenant,
          attackVector: "missingId",
          expected: operation === "list" ? "NO_DATA" : "NOT_FOUND",
          expectedCode: "RESOURCE_NOT_FOUND",
        });
      }
    }
  }
  return Object.freeze(cases);
}

/** FR-018..FR-020, FR-029 and SC-001. */
export const TENANT_ISOLATION_MATRIX: readonly TenantIsolationCase[] =
  buildCases();

export const tenantIsolationMatrix = TENANT_ISOLATION_MATRIX;
