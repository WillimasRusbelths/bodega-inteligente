import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface DashboardContextGeneration {
  activate(context: {
    readonly sessionId: string;
    readonly tenantId: string;
    readonly membershipId: string;
    readonly capabilities: readonly string[];
  }): { readonly contextKey: string; readonly generation: number };
  accepts(contextKey: string): boolean;
  clear(): void;
  snapshot(): unknown;
}

interface ContextModule {
  readonly DashboardContextGeneration: new () => DashboardContextGeneration;
}

async function loadContextGeneration(): Promise<ContextModule> {
  const modulePath = fileURLToPath(
    new URL(
      "../src/features/dashboard/operational-dashboard-state.ts",
      import.meta.url,
    ),
  );
  if (!existsSync(modulePath)) {
    throw new Error("[T019] operational-dashboard-state is required by T018.");
  }
  const module = (await import(pathToFileURL(modulePath).href)) as Partial<ContextModule>;
  if (module.DashboardContextGeneration === undefined) {
    throw new Error(
      "[T019] DashboardContextGeneration export is required by T018.",
    );
  }
  return { DashboardContextGeneration: module.DashboardContextGeneration };
}

describe("operational dashboard context generation [T018]", () => {
  it("rejects late responses, clears the previous aggregate on tenant changes and keeps operational data out of sessionStorage", async () => {
    const { DashboardContextGeneration } = await loadContextGeneration();
    const generation = new DashboardContextGeneration();
    const first = generation.activate({
      sessionId: "session-a",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      capabilities: ["inventory.products.read"],
    });
    const second = generation.activate({
      sessionId: "session-b",
      tenantId: "tenant-b",
      membershipId: "membership-b",
      capabilities: ["sales.read"],
    });

    expect({
      rejectsLateFirstResponse: generation.accepts(first.contextKey),
      acceptsCurrentResponse: generation.accepts(second.contextKey),
      clearsPreviousDataOnChange: generation.snapshot(),
      sessionStorageKeys: Object.keys(globalThis.sessionStorage ?? {}),
    }).toEqual({
      rejectsLateFirstResponse: false,
      acceptsCurrentResponse: true,
      clearsPreviousDataOnChange: null,
      sessionStorageKeys: [],
    });
  });
});
