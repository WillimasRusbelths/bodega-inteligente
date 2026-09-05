import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  new URL("../src/demo/mvp-demo.ts", import.meta.url),
  "utf8",
);
const dashboardStart = dashboardSource.indexOf(
  "export function renderBodegiaDashboard(",
);
const dashboardEnd = dashboardSource.indexOf(
  "export function renderBodegiaMvpDemo(",
);
const operationalDashboardSource = dashboardSource.slice(
  dashboardStart,
  dashboardEnd,
);

describe("web stabilization operational data sources [T009]", () => {
  it("does not import or render inventory snapshots from demo-data", () => {
    expect({
      importsDemoInventorySnapshot: /from\s+["']\.\/demo-data\.js["']/u.test(
        dashboardSource,
      ),
      rendersInventoryFromDemoSnapshot: operationalDashboardSource.includes(
        "createDemoInventoryData(",
      ),
    }).toEqual({
      importsDemoInventorySnapshot: false,
      rendersInventoryFromDemoSnapshot: false,
    });
  });
});
