import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface CapabilityContextInput {
  readonly activeTenant?: {
    readonly capabilities: readonly string[];
  } | null;
  readonly effectivePermissions?: readonly string[];
  readonly demoRole?: string;
}

interface ResolvedCapabilityContext {
  readonly capabilities: readonly string[];
  readonly source:
    | "active-tenant"
    | "effective-permissions"
    | "demo-role-fallback";
}

interface CapabilityContextModule {
  readonly resolveCapabilityContext: (
    input: CapabilityContextInput,
  ) => ResolvedCapabilityContext;
}

const modulePath = resolve(
  process.cwd(),
  "apps/web/src/features/navigation/capability-context.ts",
);

async function loadCapabilityContext(): Promise<CapabilityContextModule> {
  if (!existsSync(modulePath)) {
    throw new Error("CAPABILITY_CONTEXT_NOT_IMPLEMENTED");
  }
  const module = (await import(
    pathToFileURL(modulePath).href
  )) as Partial<CapabilityContextModule>;
  if (module.resolveCapabilityContext === undefined) {
    throw new Error("CAPABILITY_CONTEXT_NOT_IMPLEMENTED");
  }
  return { resolveCapabilityContext: module.resolveCapabilityContext };
}

describe("effective web capability context [T038]", () => {
  it("prioritizes activeTenant.capabilities over a broader singular demo role", async () => {
    const { resolveCapabilityContext } = await loadCapabilityContext();

    const context = resolveCapabilityContext({
      activeTenant: { capabilities: ["sales.read"] },
      demoRole: "owner_admin",
    });

    expect(context).toEqual({
      capabilities: ["sales.read"],
      source: "active-tenant",
    });
    expect(Object.isFrozen(context.capabilities)).toBe(true);
  });

  it("treats an empty authoritative capability set as effective instead of expanding the role", async () => {
    const { resolveCapabilityContext } = await loadCapabilityContext();

    expect(
      resolveCapabilityContext({
        activeTenant: { capabilities: [] },
        demoRole: "owner_admin",
      }),
    ).toEqual({ capabilities: [], source: "active-tenant" });
  });

  it("uses effective permissions before the role and limits the role fallback to demo sessions", async () => {
    const { resolveCapabilityContext } = await loadCapabilityContext();

    expect(
      resolveCapabilityContext({
        effectivePermissions: ["inventory.stock.read"],
        demoRole: "owner_admin",
      }),
    ).toEqual({
      capabilities: ["inventory.stock.read"],
      source: "effective-permissions",
    });
    expect(resolveCapabilityContext({ demoRole: "seller" })).toEqual({
      capabilities: [
        "inventory.products.read",
        "inventory.stock.read",
        "sales.read",
        "sales.write",
      ],
      source: "demo-role-fallback",
    });
    expect(() => resolveCapabilityContext({})).toThrow(
      "EFFECTIVE_CAPABILITIES_REQUIRED",
    );
    expect(() =>
      resolveCapabilityContext({ demoRole: "unknown-role" }),
    ).toThrow("EFFECTIVE_CAPABILITIES_REQUIRED");
  });
});
