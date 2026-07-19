/* global __ENV */

import http from "k6/http";
import { check, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const operationDuration = new Trend("access_operation_duration", true);
const operationFailures = new Rate("access_operation_failures");
const baseUrl = requiredBaseUrl().replace(/\/$/u, "");
const runDuration = __ENV.ACCESS_DURATION ?? "30s";
const requestRate = Number(__ENV.ACCESS_RATE ?? "1");

if (!Number.isFinite(requestRate) || requestRate <= 0) {
  throw new Error("ACCESS_RATE must be a positive number");
}

export const options = {
  scenarios: {
    login: scenario("loginScenario"),
    refresh: scenario("refreshScenario"),
    tenant_selection: scenario("tenantSelectionScenario"),
    guard_chain: scenario("guardChainScenario"),
    tenant_listing: scenario("tenantListingScenario"),
    revocation: scenario("revocationScenario"),
    safe_errors: scenario("safeErrorsScenario"),
    audit: scenario("auditScenario"),
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    access_operation_duration: ["p(95)<300"],
    access_operation_failures: ["rate<0.05"],
  },
};

function requiredBaseUrl() {
  const value = __ENV.API_BASE_URL ?? __ENV.BASE_URL;
  if (value === undefined || value.length === 0) {
    throw new Error(
      "Missing required k6 environment variable: API_BASE_URL or BASE_URL",
    );
  }
  return value;
}

function scenario(exec) {
  return {
    executor: "constant-arrival-rate",
    rate: requestRate,
    timeUnit: "1s",
    duration: runDuration,
    preAllocatedVUs: 1,
    maxVUs: Number(__ENV.ACCESS_MAX_VUS ?? "10"),
    exec,
  };
}

function headers(accessToken) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(accessToken === undefined
      ? {}
      : { Authorization: `Bearer ${accessToken}` }),
  };
}

function jsonBody(response) {
  try {
    return response.json();
  } catch {
    return undefined;
  }
}

function hasEnvironmentValues(...names) {
  return names.every((name) => {
    const value = __ENV[name];
    return value !== undefined && value.length > 0;
  });
}

function statusLabel(expectedStatus) {
  return Array.isArray(expectedStatus)
    ? expectedStatus.join(" or ")
    : String(expectedStatus);
}

function request(operation, method, path, body, accessToken, expectedStatus) {
  const response = http.request(
    method,
    `${baseUrl}${path}`,
    body === undefined ? undefined : JSON.stringify(body),
    { headers: headers(accessToken), tags: { operation } },
  );
  operationDuration.add(response.timings.duration, { operation });
  const statusOk = Array.isArray(expectedStatus)
    ? expectedStatus.includes(response.status)
    : response.status === expectedStatus;
  const noKnownInputSecret = ![
    __ENV.TEST_PHONE,
    __ENV.TEST_PIN,
    __ENV.TEST_DEVICE_CREDENTIAL,
  ].some(
    (value) =>
      value !== undefined &&
      value.length > 0 &&
      (response.body ?? "").includes(value),
  );
  const passed = check(response, {
    [`${operation} returns ${statusLabel(expectedStatus)}`]: () => statusOk,
    [`${operation} response has no raw input secret`]: () => noKnownInputSecret,
  });
  operationFailures.add(!passed, { operation });
  return response;
}

function login() {
  const credentialsAvailable = hasEnvironmentValues(
    "TEST_PHONE",
    "TEST_DEVICE_CREDENTIAL",
    "TEST_PIN",
  );
  const response = request(
    "login",
    "POST",
    "/auth/pin/unlock",
    credentialsAvailable
      ? {
          phone: __ENV.TEST_PHONE,
          deviceCredential: __ENV.TEST_DEVICE_CREDENTIAL,
          pin: __ENV.TEST_PIN,
        }
      : {},
    undefined,
    [200, 400, 401, 404, 422],
  );
  if (response.status !== 200) return undefined;
  const body = jsonBody(response);
  if (body === null || typeof body !== "object") return undefined;
  const record = body;
  if (
    typeof record.accessToken !== "string" ||
    typeof record.refreshToken !== "string"
  ) {
    return undefined;
  }
  return {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
  };
}

function healthcheck(operation) {
  return request(operation, "GET", "/health", undefined, undefined, 200);
}

export function loginScenario() {
  group("login with PIN", () => {
    healthcheck("login_health");
    login();
  });
}

export function refreshScenario() {
  group("refresh token", () => {
    healthcheck("refresh_health");
    const tokens = login();
    request(
      "refresh",
      "POST",
      "/auth/refresh",
      tokens === undefined ? {} : { refreshToken: tokens.refreshToken },
      undefined,
      [200, 400, 401, 404, 422],
    );
  });
}

export function tenantSelectionScenario() {
  group("tenant selection", () => {
    healthcheck("tenant_selection_health");
    const tokens = login();
    request(
      "tenant_selection",
      "PUT",
      "/sessions/current/tenant",
      {
        membershipId: __ENV.TEST_MEMBERSHIP_ID ?? "synthetic-membership-id",
      },
      tokens?.accessToken,
      [200, 400, 401, 404, 422],
    );
  });
}

export function guardChainScenario() {
  group("guard chain", () => {
    healthcheck("guard_chain_health");
    const tokens = login();
    request(
      "guard_chain",
      "GET",
      "/me",
      undefined,
      tokens?.accessToken,
      [200, 401, 404],
    );
  });
}

export function tenantListingScenario() {
  group("tenant-scoped listings", () => {
    healthcheck("tenant_listing_health");
    const tokens = login();
    const cursor = __ENV.TEST_CURSOR;
    const path =
      cursor === undefined
        ? "/tenants/current/members"
        : `/tenants/current/members?cursor=${encodeURIComponent(cursor)}`;
    request(
      "tenant_listing",
      "GET",
      path,
      undefined,
      tokens?.accessToken,
      [200, 401, 404],
    );
  });
}

export function revocationScenario() {
  group("revocation", () => {
    healthcheck("revocation_health");
    const tokens = login();
    request(
      "revocation",
      "DELETE",
      `/tenants/current/members/${__ENV.TEST_MEMBERSHIP_ID ?? "synthetic-membership-id"}/devices/${__ENV.TEST_DEVICE_PROFILE_ID ?? "synthetic-device-profile-id"}`,
      { reason: "synthetic performance revocation" },
      tokens?.accessToken,
      [200, 204, 400, 401, 404, 422],
    );
  });
}

export function safeErrorsScenario() {
  group("safe errors", () => {
    healthcheck("safe_error_health");
    const tokens = login();
    request(
      "safe_error",
      "PUT",
      "/sessions/current/tenant",
      {
        membershipId:
          __ENV.TEST_FOREIGN_MEMBERSHIP_ID ?? "synthetic-foreign-membership-id",
      },
      tokens?.accessToken,
      [400, 401, 404, 422],
    );
  });
}

export function auditScenario() {
  group("authorized audit query", () => {
    healthcheck("audit_health");
    const tokens = login();
    request(
      "audit",
      "GET",
      "/tenants/current/audit-events?result=SUCCEEDED",
      undefined,
      tokens?.accessToken,
      [200, 401, 404],
    );
  });
}

export default function () {
  loginScenario();
}
