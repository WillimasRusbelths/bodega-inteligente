import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface ResourceStateFactories {
  readonly idle: () => unknown;
  readonly loading: (cycle: number) => unknown;
  readonly ready: <T>(data: T, receivedAt: string, cycle: number) => unknown;
  readonly empty: (receivedAt: string, cycle: number) => unknown;
  readonly error: (
    message: string,
    correlationId: string | null,
    cycle: number,
  ) => unknown;
  readonly stale: <T>(
    data: T,
    reason: string,
    correlationId: string | null,
    cycle: number,
  ) => unknown;
}

async function loadResourceStateFactories(): Promise<ResourceStateFactories> {
  const modulePath = fileURLToPath(
    new URL(
      "../src/features/dashboard/operational-dashboard-state.ts",
      import.meta.url,
    ),
  );
  if (!existsSync(modulePath)) {
    throw new Error("[T019] operational-dashboard-state is required by T016.");
  }
  const module = (await import(pathToFileURL(modulePath).href)) as Partial<{
    resourceState: ResourceStateFactories;
  }>;
  if (module.resourceState === undefined) {
    throw new Error("[T019] resourceState factories are required by T016.");
  }
  return module.resourceState;
}

describe("operational dashboard resource state [T016]", () => {
  it("models idle, loading, ready, empty, error and stale with provenance and synchronization metadata", async () => {
    const state = await loadResourceStateFactories();
    const receivedAt = "2026-08-20T12:00:00.000Z";
    const correlationId = "00000000-0000-4000-8000-000000000901";

    expect({
      idle: state.idle(),
      loading: state.loading(7),
      ready: state.ready(["product"], receivedAt, 7),
      empty: state.empty(receivedAt, 7),
      error: state.error("No se pudo cargar productos.", correlationId, 7),
      stale: state.stale(["product"], "POST_SALE_REFRESH_FAILED", correlationId, 7),
    }).toEqual({
      idle: { status: "idle" },
      loading: { status: "loading", cycle: 7 },
      ready: { status: "ready", data: ["product"], receivedAt, cycle: 7 },
      empty: { status: "empty", receivedAt, cycle: 7 },
      error: {
        status: "error",
        message: "No se pudo cargar productos.",
        correlationId,
        cycle: 7,
      },
      stale: {
        status: "stale",
        data: ["product"],
        reason: "POST_SALE_REFRESH_FAILED",
        correlationId,
        cycle: 7,
      },
    });
  });
});
