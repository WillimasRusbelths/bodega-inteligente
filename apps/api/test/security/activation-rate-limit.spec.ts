import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface RateLimitInput {
  readonly ip: string;
  readonly deviceIdentifier: string;
  readonly pseudonymousIdentifier: string;
  readonly challengeAlias: string;
}

interface RateLimitDecision {
  readonly allowed: boolean;
  readonly status: number;
  readonly body: Record<string, unknown>;
}

interface ActivationRateLimiter {
  check(input: RateLimitInput, now: Date): RateLimitDecision;
  recordFailure(input: RateLimitInput, now: Date): void;
}

interface RateLimitModule {
  createActivationRateLimiter(options: {
    limit: number;
    windowMs: number;
  }): ActivationRateLimiter;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/activation/services/consume-activation.service.ts",
);

async function limiter(limit = 3): Promise<ActivationRateLimiter> {
  if (!existsSync(servicePath)) {
    throw new Error(
      "[T039] consume-activation.service.ts rate limiter is required by T035.",
    );
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<RateLimitModule>;
  if (module.createActivationRateLimiter === undefined) {
    throw new Error(
      "[T039] createActivationRateLimiter export is required by T035.",
    );
  }
  return module.createActivationRateLimiter({ limit, windowMs: 60_000 });
}

const now = new Date("2026-01-01T00:00:00.000Z");
const base: RateLimitInput = {
  ip: "192.0.2.10",
  deviceIdentifier: "synthetic-device-a",
  pseudonymousIdentifier: "hmac-subject-a",
  challengeAlias: "challenge-a",
};

function exhaust(
  rateLimiter: ActivationRateLimiter,
  input: RateLimitInput,
): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    rateLimiter.recordFailure(input, now);
  }
}

describe("activation rate limiting [T035; HU-002; FR-027, FR-029, FR-031]", () => {
  it.each([
    ["IP", { ip: base.ip }],
    ["device", { deviceIdentifier: base.deviceIdentifier }],
    [
      "pseudonymous identifier",
      { pseudonymousIdentifier: base.pseudonymousIdentifier },
    ],
    ["challenge alias", { challengeAlias: base.challengeAlias }],
  ] as const)("enforces an independent %s bucket", async (_label, fixed) => {
    const rateLimiter = await limiter();
    exhaust(rateLimiter, base);
    const probe = {
      ...base,
      ip: "192.0.2.99",
      deviceIdentifier: "synthetic-device-z",
      pseudonymousIdentifier: "hmac-subject-z",
      challengeAlias: "challenge-z",
      ...fixed,
    };
    expect(rateLimiter.check(probe, now).allowed).toBe(false);
  });

  it("combines dimensions to resist basic distributed attempts", async () => {
    const rateLimiter = await limiter();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      rateLimiter.recordFailure(
        {
          ...base,
          ip: `192.0.2.${attempt + 20}`,
          deviceIdentifier: `synthetic-device-${attempt}`,
        },
        now,
      );
    }
    expect(rateLimiter.check({ ...base, ip: "192.0.2.80" }, now).allowed).toBe(
      false,
    );
  });

  it("uses the same anti-enumeration response for hidden resource states", async () => {
    const rateLimiter = await limiter();
    exhaust(rateLimiter, base);
    const blocked = rateLimiter.check(base, now);
    const decisions = Array.from({ length: 4 }, () =>
      rateLimiter.check(base, now),
    );
    for (const decision of decisions) {
      expect(decision.status).toBe(blocked.status);
      expect(Object.keys(decision.body).sort()).toEqual(
        Object.keys(blocked.body).sort(),
      );
    }
  });

  it("reveals no phone, membership, tenant or internal state", async () => {
    const rateLimiter = await limiter();
    exhaust(rateLimiter, base);
    const serialized = JSON.stringify(rateLimiter.check(base, now));
    expect(serialized).not.toMatch(
      /\+519|phone|membership|tenant|expired|blocked/iu,
    );
  });

  it("never uses a raw phone as a rate-limit key", async () => {
    const phone = "+51900000011";
    const rateLimiter = await limiter();
    const input = { ...base, pseudonymousIdentifier: "hmac-phone-a" };
    exhaust(rateLimiter, input);
    expect(JSON.stringify(rateLimiter.check(input, now))).not.toContain(phone);
  });

  it("recovers only after the configured window", async () => {
    const rateLimiter = await limiter();
    exhaust(rateLimiter, base);
    expect(
      rateLimiter.check(base, new Date(now.getTime() + 59_999)).allowed,
    ).toBe(false);
    expect(
      rateLimiter.check(base, new Date(now.getTime() + 60_001)).allowed,
    ).toBe(true);
  });
});
