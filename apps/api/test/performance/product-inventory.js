/* global __ENV */

import http from "k6/http";
import { check, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/u, "");
const operationDuration = new Trend("inventory_operation_duration", true);
const operationFailures = new Rate("inventory_operation_failures");

function request(path, expectedStatuses = [200, 401, 404, 422]) {
  const started = Date.now();
  const response = http.get(`${baseUrl}${path}`);
  const elapsed = Date.now() - started;
  operationDuration.add(elapsed);
  const passed = check(response, {
    "inventory endpoint returned a controlled status": (res) =>
      expectedStatuses.includes(res.status),
    "inventory endpoint returned a body": (res) => res.body.length > 0,
  });
  operationFailures.add(!passed);
}

export function productSearch() {
  group("product search", () =>
    request("/tenants/current/products?query=synthetic"),
  );
}

export function lots() {
  group("lot listing", () => request("/tenants/current/lots?limit=20"));
}

export function balances() {
  group("stock balances", () => request("/tenants/current/inventory/balances"));
}

export function fefo() {
  group("FEFO recommendation", () =>
    request(
      "/tenants/current/products/00000000-0000-4000-8000-000000000001/fefo",
    ),
  );
}

export function alerts() {
  group("inventory alerts", () => request("/tenants/current/alerts"));
}

export function movements() {
  group("inventory movements", () =>
    request("/tenants/current/inventory/movements"),
  );
}

export const options = {
  scenarios: {
    product_search: {
      executor: "shared-iterations",
      iterations: 1,
      exec: "productSearch",
    },
    lots: { executor: "shared-iterations", iterations: 1, exec: "lots" },
    balances: {
      executor: "shared-iterations",
      iterations: 1,
      exec: "balances",
    },
    fefo: { executor: "shared-iterations", iterations: 1, exec: "fefo" },
    alerts: { executor: "shared-iterations", iterations: 1, exec: "alerts" },
    movements: {
      executor: "shared-iterations",
      iterations: 1,
      exec: "movements",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    inventory_operation_duration: ["p(95)<300"],
    inventory_operation_failures: ["rate<0.05"],
  },
};

export default function () {
  productSearch();
}
