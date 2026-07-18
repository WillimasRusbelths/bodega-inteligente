import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type HttpMethod = "delete" | "get" | "patch" | "post" | "put";

interface ExpectedOperation {
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers: readonly string[];
  readonly requestBody: boolean;
  readonly responses: readonly string[];
}

const expected = {
  createTenantWithFirstOwner: operation(
    "post",
    "/technical/tenants",
    ["IdempotencyKey"],
    true,
    ["201", "400", "401", "403", "409"],
  ),
  getTechnicalTenantSummary: operation(
    "get",
    "/technical/tenants/{tenantId}/summary",
    ["TenantId"],
    false,
    ["200", "404"],
  ),
  changeTenantStatus: operation(
    "patch",
    "/technical/tenants/{tenantId}/status",
    ["TenantId", "IfMatch"],
    true,
    ["200", "404", "409"],
  ),
  listCurrentTenantMembers: operation(
    "get",
    "/tenants/current/members",
    ["Cursor"],
    false,
    ["200", "401", "403"],
  ),
  createMembership: operation(
    "post",
    "/tenants/current/members",
    ["IdempotencyKey"],
    true,
    ["201", "403", "409"],
  ),
  getCurrentTenantMember: operation(
    "get",
    "/tenants/current/members/{membershipId}",
    ["MembershipId"],
    false,
    ["200", "404"],
  ),
  issueActivationChallenge: operation(
    "post",
    "/tenants/current/members/{membershipId}/activation-challenges",
    ["MembershipId", "IdempotencyKey"],
    true,
    ["201", "403", "404", "409"],
  ),
  replaceMembershipRoles: operation(
    "patch",
    "/tenants/current/members/{membershipId}/roles",
    ["MembershipId", "IfMatch"],
    true,
    ["200", "404", "409"],
  ),
  changeMembershipStatus: operation(
    "patch",
    "/tenants/current/members/{membershipId}/status",
    ["MembershipId", "IfMatch"],
    true,
    ["200", "404", "409"],
  ),
  listMemberDevices: operation(
    "get",
    "/tenants/current/members/{membershipId}/devices",
    ["MembershipId"],
    false,
    ["200", "404"],
  ),
  revokeMemberDevice: operation(
    "delete",
    "/tenants/current/members/{membershipId}/devices/{deviceProfileId}",
    ["MembershipId", "DeviceProfileId"],
    true,
    ["204", "404"],
  ),
  activateDeviceProfile: operation(
    "post",
    "/auth/activations",
    ["IdempotencyKey"],
    true,
    ["200", "400", "429"],
  ),
  setupPin: operation("post", "/auth/pin/setup", [], true, ["204", "401"]),
  unlockWithPin: operation("post", "/auth/pin/unlock", [], true, [
    "200",
    "400",
    "429",
  ]),
  rotateRefreshToken: operation("post", "/auth/refresh", [], true, [
    "200",
    "401",
  ]),
  logoutCurrentSession: operation("post", "/auth/logout", [], false, ["204"]),
  getMyIdentity: operation("get", "/me", [], false, ["200", "401"]),
  listMyActiveMemberships: operation("get", "/me/memberships", [], false, [
    "200",
  ]),
  selectActiveTenant: operation("put", "/sessions/current/tenant", [], true, [
    "200",
    "404",
  ]),
  listMyDevices: operation("get", "/me/devices", [], false, ["200"]),
  revokeMyDevice: operation(
    "delete",
    "/me/devices/{deviceProfileId}",
    ["DeviceProfileId"],
    false,
    ["204", "404"],
  ),
  listCurrentTenantAuditEvents: operation(
    "get",
    "/tenants/current/audit-events",
    ["Cursor"],
    false,
    ["200", "403"],
  ),
} as const satisfies Readonly<Record<string, ExpectedOperation>>;

function operation(
  method: HttpMethod,
  path: string,
  headers: readonly string[],
  requestBody: boolean,
  responses: readonly string[],
): ExpectedOperation {
  return { method, path, headers, requestBody, responses };
}

interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue =
  | JsonObject
  | readonly JsonValue[]
  | boolean
  | number
  | string
  | null;

function isJsonArray(
  value: JsonValue | undefined,
): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function object(value: JsonValue | undefined, label: string): JsonObject {
  if (
    value === null ||
    value === undefined ||
    isJsonArray(value) ||
    typeof value !== "object"
  ) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value;
}

function string(value: JsonValue | undefined, label: string): string {
  if (typeof value !== "string")
    throw new Error(`Expected ${label} to be a string.`);
  return value;
}

function operationEntries(document: JsonObject): ReadonlyMap<
  string,
  {
    readonly method: HttpMethod;
    readonly path: string;
    readonly value: JsonObject;
  }
> {
  const result = new Map<
    string,
    { method: HttpMethod; path: string; value: JsonObject }
  >();
  const paths = object(document["paths"], "paths");
  for (const [path, pathValue] of Object.entries(paths)) {
    const pathItem = object(pathValue, path);
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      if (pathItem[method] === undefined) continue;
      const value = object(pathItem[method], `${method} ${path}`);
      result.set(string(value["operationId"], "operationId"), {
        method,
        path,
        value,
      });
    }
  }
  return result;
}

function responseCodes(value: JsonObject): readonly string[] {
  return Object.keys(object(value["responses"], "responses")).sort();
}

function parameterReferences(value: JsonObject): readonly string[] {
  const parameters = value["parameters"];
  if (!isJsonArray(parameters)) return [];
  return parameters.flatMap((parameter) => {
    const reference = object(parameter, "parameter")["$ref"];
    if (typeof reference !== "string") return [];
    return [reference.slice(reference.lastIndexOf("/") + 1)];
  });
}

const sourcePath = resolve(
  process.cwd(),
  "specs/001-multi-tenant-access/contracts/openapi.yaml",
);
const snapshotPath = resolve(
  process.cwd(),
  "packages/api-contract/src/generated/schema.snapshot.json",
);
const source = readFileSync(sourcePath, "utf8");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as JsonObject;
const implemented = operationEntries(snapshot);

describe("MVP OpenAPI conformance [T121]", () => {
  it("has exactly the implemented MVP operationId allowlist", () => {
    expect([...implemented.keys()].sort()).toEqual(
      Object.keys(expected).sort(),
    );
  });

  it.each(Object.entries(expected))(
    "%s has the approved method, route, request, headers and errors",
    (operationId, contract) => {
      const actual = implemented.get(operationId);
      expect(actual).toBeDefined();
      if (actual === undefined) return;
      expect({ method: actual.method, path: actual.path }).toEqual({
        method: contract.method,
        path: contract.path,
      });
      expect(parameterReferences(actual.value)).toEqual(contract.headers);
      expect(actual.value["requestBody"] !== undefined).toBe(
        contract.requestBody,
      );
      if (contract.requestBody) {
        expect(
          object(actual.value["requestBody"], "requestBody")["required"],
        ).toBe(true);
      }
      expect(responseCodes(actual.value)).toEqual(
        [...contract.responses].sort(),
      );
      expect(source).toContain(`operationId: ${operationId}`);
      expect(source).toContain(`  ${contract.path}:`);
    },
  );

  it("keeps one-time secret responses and tenant selection fields required", () => {
    const schemas = object(
      object(snapshot["components"], "components")["schemas"],
      "schemas",
    );
    const required = (name: string): readonly JsonValue[] => {
      const value = object(schemas[name], name)["required"];
      if (!isJsonArray(value)) throw new Error(`${name}.required is missing.`);
      return value;
    };
    expect(required("ActivationChallengeIssueResponse")).toEqual(
      expect.arrayContaining([
        "qrSecret",
        "qrPayload",
        "manualCode",
        "expiresAt",
      ]),
    );
    expect(required("ActivationConsumeResponse")).toEqual(
      expect.arrayContaining(["deviceProfileId", "pinSetupToken", "expiresAt"]),
    );
    expect(required("SessionCreationResponse")).toEqual(
      expect.arrayContaining([
        "accessToken",
        "refreshToken",
        "absoluteExpiresAt",
      ]),
    );
    expect(required("TenantSelectionResponse")).toEqual(
      expect.arrayContaining([
        "accessToken",
        "activeTenant",
        "contextVersion",
        "sessionExpiresAt",
      ]),
    );
  });

  it("excludes deferred support, pairing, biometric and shared-device operations", () => {
    const deferred = [
      "createTenantSharedDevice",
      "createBiometricChallenge",
      "verifyBiometricDeviceProof",
      "createWebPairing",
      "getWebPairingStatus",
      "reviewWebPairing",
      "approveWebPairing",
      "rejectWebPairing",
      "openSupportCase",
      "approveSupportGrant",
      "revokeSupportGrant",
      "closeSupportCase",
      "getScopedSessionHealth",
    ];
    expect(deferred.some((operationId) => implemented.has(operationId))).toBe(
      false,
    );
  });
});
