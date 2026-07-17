import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface RefreshCredentialRecord {
  id: string;
  sessionId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  replacedById: string | null;
  revokedAt: Date | null;
  reuseDetectedAt: Date | null;
}

interface RefreshReuseState {
  session: {
    id: string;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  };
  credentials: RefreshCredentialRecord[];
  audits: Array<Record<string, unknown>>;
  logs: unknown[];
}

interface RefreshRotationService {
  rotate(
    rawToken: string,
    now: Date,
  ): Promise<{
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly absoluteExpiresAt: Date;
  }>;
}

interface RefreshRotationModule {
  createRefreshRotationHarness(options: {
    readonly state: RefreshReuseState;
    readonly transaction: <T>(
      work: (draft: RefreshReuseState) => Promise<T>,
    ) => Promise<T>;
    readonly hashToken: (rawToken: string) => string;
    readonly issueOpaqueToken: () => string;
    readonly failAfterReplacement?: boolean;
  }): RefreshRotationService;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/auth/services/refresh-rotation.service.ts",
);

async function loadModule(): Promise<RefreshRotationModule> {
  if (!existsSync(servicePath)) {
    throw new Error("[T056] RefreshRotationService is required by T053.");
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<RefreshRotationModule>;
  if (module.createRefreshRotationHarness === undefined) {
    throw new Error(
      "[T056] createRefreshRotationHarness export is required by T053.",
    );
  }
  return { createRefreshRotationHarness: module.createRefreshRotationHarness };
}

const now = new Date("2026-01-01T00:00:00.000Z");
const absoluteExpiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
const initialToken = "synthetic-refresh-token-initial-000000000001";
const descendantToken = "synthetic-refresh-token-rotated-00000000001";
const sessionId = "00000000-0000-4000-8000-000000000501";
const familyId = "00000000-0000-4000-8000-000000000601";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("base64url");
}

function createState(
  credentialOverrides: Partial<RefreshCredentialRecord> = {},
): RefreshReuseState {
  return {
    session: { id: sessionId, absoluteExpiresAt, revokedAt: null },
    credentials: [
      {
        id: "00000000-0000-4000-8000-000000000701",
        sessionId,
        familyId,
        tokenHash: hashToken(initialToken),
        expiresAt: absoluteExpiresAt,
        rotatedAt: null,
        replacedById: null,
        revokedAt: null,
        reuseDetectedAt: null,
        ...credentialOverrides,
      },
    ],
    audits: [],
    logs: [],
  };
}

async function setup(options?: {
  readonly credentialOverrides?: Partial<RefreshCredentialRecord>;
  readonly failAfterReplacement?: boolean;
}) {
  const state = createState(options?.credentialOverrides);
  let nextToken = descendantToken;
  const transaction = async <T>(
    work: (draft: RefreshReuseState) => Promise<T>,
  ): Promise<T> => {
    const draft = structuredClone(state);
    const result = await work(draft);
    Object.assign(state, draft);
    return result;
  };
  const service = (await loadModule()).createRefreshRotationHarness({
    state,
    transaction,
    hashToken,
    issueOpaqueToken: () => {
      const issued = nextToken;
      nextToken = `${descendantToken}-next`;
      return issued;
    },
    ...(options?.failAfterReplacement === undefined
      ? {}
      : { failAfterReplacement: options.failAfterReplacement }),
  });
  return { state, service };
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected a safe refresh failure.");
}

describe("refresh reuse security [T053; HU-002; FR-005, FR-027, FR-029]", () => {
  it("allows each refresh token to rotate only once", async () => {
    const { service } = await setup();
    await service.rotate(initialToken, now);
    await expect(service.rotate(initialToken, now)).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("persists only token hashes", async () => {
    const { state, service } = await setup();
    const response = await service.rotate(initialToken, now);
    expect(
      state.credentials.every(({ tokenHash }) => tokenHash.length > 0),
    ).toBe(true);
    expect(JSON.stringify(state)).not.toContain(initialToken);
    expect(JSON.stringify(state)).not.toContain(response.refreshToken);
  });

  it("rolls back the complete rotation when replacement persistence fails", async () => {
    const { state, service } = await setup({ failAfterReplacement: true });
    const before = structuredClone(state);
    await expect(service.rotate(initialToken, now)).rejects.toBeDefined();
    expect(state).toEqual(before);
  });

  it("revokes the complete family when an old refresh is reused", async () => {
    const { state, service } = await setup();
    await service.rotate(initialToken, now);
    await expect(service.rotate(initialToken, now)).rejects.toBeDefined();
    expect(
      state.credentials
        .filter((credential) => credential.familyId === familyId)
        .every(({ revokedAt }) => revokedAt !== null),
    ).toBe(true);
  });

  it("rejects every descendant after reuse detection", async () => {
    const { service } = await setup();
    const descendant = await service.rotate(initialToken, now);
    await expect(service.rotate(initialToken, now)).rejects.toBeDefined();
    await expect(
      service.rotate(descendant.refreshToken, now),
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("revokes the related server-side Session on reuse", async () => {
    const { state, service } = await setup();
    await service.rotate(initialToken, now);
    await expect(service.rotate(initialToken, now)).rejects.toBeDefined();
    expect(state.session.revokedAt).toEqual(now);
  });

  it("allows exactly one winner for concurrent refresh requests", async () => {
    const { state, service } = await setup();
    const results = await Promise.allSettled([
      service.rotate(initialToken, now),
      service.rotate(initialToken, now),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(state.session.revokedAt).toEqual(now);
  });

  it("treats the losing concurrent request as reuse", async () => {
    const { state, service } = await setup();
    await Promise.allSettled([
      service.rotate(initialToken, now),
      service.rotate(initialToken, now),
    ]);
    expect(
      state.credentials.some(({ reuseDetectedAt }) => reuseDetectedAt !== null),
    ).toBe(true);
  });

  it("returns the same anti-enumeration error for hidden token states", async () => {
    const failures: unknown[] = [];
    failures.push(
      await captureFailure(
        (await setup()).service.rotate("unknown-token", now),
      ),
    );
    for (const credentialOverrides of [
      { revokedAt: now },
      { expiresAt: new Date(now.getTime() - 1) },
      { rotatedAt: now },
    ]) {
      failures.push(
        await captureFailure(
          (await setup({ credentialOverrides })).service.rotate(
            initialToken,
            now,
          ),
        ),
      );
    }
    expect(failures).toHaveLength(4);
    expect(failures.map((error) => JSON.stringify(error))).toEqual(
      Array.from({ length: 4 }, () => JSON.stringify(failures[0])),
    );
    expect(JSON.stringify(failures)).not.toMatch(/refresh|token|family/iu);
  });

  it("never writes the raw token to logs or audit", async () => {
    const { state, service } = await setup();
    await service.rotate(initialToken, now);
    await expect(service.rotate(initialToken, now)).rejects.toBeDefined();
    expect(
      JSON.stringify({ logs: state.logs, audits: state.audits }),
    ).not.toContain(initialToken);
  });

  it("audits reuse with sanitized metadata", async () => {
    const { state, service } = await setup();
    await service.rotate(initialToken, now);
    await expect(service.rotate(initialToken, now)).rejects.toBeDefined();
    expect(state.audits).toContainEqual(
      expect.objectContaining({ action: "REFRESH_REUSE_DETECTED" }),
    );
    expect(JSON.stringify(state.audits)).not.toMatch(
      /tokenHash|refreshToken/iu,
    );
  });

  it("preserves the original eight-hour absolute expiry", async () => {
    const { state, service } = await setup();
    const response = await service.rotate(
      initialToken,
      new Date(now.getTime() + 60 * 60 * 1_000),
    );
    expect(response.absoluteExpiresAt).toEqual(absoluteExpiresAt);
    expect(state.session.absoluteExpiresAt).toEqual(absoluteExpiresAt);
  });
});
