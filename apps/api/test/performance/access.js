/* global __ENV */

import http from "k6/http";
import { check, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const operationDuration = new Trend("access_operation_duration", true);
const operationFailures = new Rate("access_operation_failures");
const baseUrl = requiredEnv("API_BASE_URL").replace(/\/$/u, "");
const runDuration = __ENV.K6_DURATION ?? "30s";
const requestRate = Number(__ENV.K6_RATE ?? "1");

if (!Number.isFinite(requestRate) || requestRate <= 0) {
  throw new Error("K6_RATE must be a positive number");
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

function requiredEnv(name) {
  const value = __ENV[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required k6 environment variable: ${name}`);
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
    maxVUs: Number(__ENV.K6_MAX_VUS ?? "10"),
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

function request(operation, method, path, body, accessToken, expectedStatus) {
  const response = http.request(
    method,
    `${baseUrl}${path}`,
    body === undefined ? undefined : JSON.stringify(body),
    { headers: headers(accessToken), tags: { operation } },
  );
  operationDuration.add(response.timings.duration, { operation });
  const statusOk = response.status === expectedStatus;
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
    [`${operation} returns ${expectedStatus}`]: () => statusOk,
    [`${operation} response has no raw input secret`]: () => noKnownInputSecret,
  });
  operationFailures.add(!passed, { operation });
  return response;
}

function login() {
  const response = request(
    "login",
    "POST",
    "/auth/pin/unlock",
    {
      phone: requiredEnv("TEST_PHONE"),
      deviceCredential: requiredEnv("TEST_DEVICE_CREDENTIAL"),
      pin: requiredEnv("TEST_PIN"),
    },
    undefined,
    200,
  );
  const body = jsonBody(response);
  if (body === null || typeof body !== "object") {
    throw new Error("Login response did not contain a JSON object");
  }
  const record = body;
  if (
    typeof record.accessToken !== "string" ||
    typeof record.refreshToken !== "string"
  ) {
    throw new Error("Login response did not contain opaque session tokens");
  }
  return {
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
  };
}

export function loginScenario() {
  group("login with PIN", () => {
    login();
  });
}

export function refreshScenario() {
  group("refresh token", () => {
    const tokens = login();
    request(
      "refresh",
      "POST",
      "/auth/refresh",
      { refreshToken: tokens.refreshToken },
      undefined,
      200,
    );
  });
}

export function tenantSelectionScenario() {
  group("tenant selection", () => {
    const tokens = login();
    request(
      "tenant_selection",
      "PUT",
      "/sessions/current/tenant",
      { membershipId: requiredEnv("TEST_MEMBERSHIP_ID") },
      tokens.accessToken,
      200,
    );
  });
}

export function guardChainScenario() {
  group("guard chain", () => {
    const tokens = login();
    request("guard_chain", "GET", "/me", undefined, tokens.accessToken, 200);
  });
}

export function tenantListingScenario() {
  group("tenant-scoped listings", () => {
    const tokens = login();
    const cursor = __ENV.TEST_CURSOR;
    const path =
      cursor === undefined
        ? "/tenants/current/members"
        : `/tenants/current/members?cursor=${encodeURIComponent(cursor)}`;
    request("tenant_listing", "GET", path, undefined, tokens.accessToken, 200);
  });
}

export function revocationScenario() {
  group("revocation", () => {
    const tokens = login();
    request(
      "revocation",
      "DELETE",
      `/tenants/current/members/${requiredEnv("TEST_MEMBERSHIP_ID")}/devices/${requiredEnv("TEST_DEVICE_PROFILE_ID")}`,
      { reason: "synthetic performance revocation" },
      tokens.accessToken,
      204,
    );
  });
}

export function safeErrorsScenario() {
  group("safe errors", () => {
    const tokens = login();
    request(
      "safe_error",
      "PUT",
      "/sessions/current/tenant",
      { membershipId: requiredEnv("TEST_FOREIGN_MEMBERSHIP_ID") },
      tokens.accessToken,
      404,
    );
  });
}

export function auditScenario() {
  group("authorized audit query", () => {
    const tokens = login();
    request(
      "audit",
      "GET",
      "/tenants/current/audit-events?result=SUCCEEDED",
      undefined,
      tokens.accessToken,
      200,
    );
  });
}
