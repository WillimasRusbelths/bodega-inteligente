import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StructuredLoggerService } from "../../src/common/logging/logger.service.js";
import { PrismaModule } from "../../src/infrastructure/prisma/prisma.module.js";
import { createPhoneBindingService } from "../../src/modules/activation/crypto/phone-binding.service.js";
import { ConsumeActivationService } from "../../src/modules/activation/services/consume-activation.service.js";
import { IssueActivationService } from "../../src/modules/activation/services/issue-activation.service.js";
import { PinService } from "../../src/modules/auth/services/pin.service.js";
import { SessionService } from "../../src/modules/auth/services/session.service.js";
import { TokenService } from "../../src/modules/auth/services/token.service.js";
import { BootstrapTenantService } from "../../src/modules/tenants/services/bootstrap-tenant.service.js";

const databaseUrl = process.env["DATABASE_URL"];
const technicalActor = {
  id: "00000000-0000-4000-8000-000000000901",
  technicalAdmin: true,
} as const;
const phone = "+51900000501";
const pin = "123456";
const deviceCredential = "synthetic-device-credential-t134";
const pepper = Buffer.from("synthetic-pin-pepper-t134-32-bytes", "utf8");
const signingKey = Buffer.from(
  "synthetic-access-signing-key-t134-32-bytes",
  "utf8",
);
const refreshHashKey = Buffer.from(
  "synthetic-refresh-hash-key-t134-32-bytes",
  "utf8",
);

let client: PrismaClient;
let prisma: PrismaModule;

function assertLocalDatabase(value: string | undefined): string {
  if (value === undefined) throw new Error("T134 requires DATABASE_URL.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    database !== "bodegia_test"
  ) {
    throw new Error("T134 refuses non-local or non-exclusive databases.");
  }
  return value;
}

async function truncateFunctionalTables(): Promise<void> {
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshCredential", "Session", "ActivationManualAlias",
      "ActivationChallenge", "DeviceProfile", "Device", "AuditEvent",
      "IdempotencyRecord", "MembershipRole", "RolePermission", "Permission",
      "Role", "Membership", "Tenant", "User"
    RESTART IDENTITY CASCADE
  `);
}

const phoneBinding = createPhoneBindingService({
  currentVersion: "t134-v1",
  keys: new Map([
    ["t134-v1", Buffer.from("synthetic-phone-binding-key-t134", "utf8")],
  ]),
});

const tokens = new TokenService({
  accessSigningKey: signingKey,
  refreshHashKey,
});

const pinServiceOptions = {
  currentPepperVersion: "t134-pepper-v1",
  peppers: new Map([["t134-pepper-v1", pepper]]),
};

beforeAll(async () => {
  const safeUrl = assertLocalDatabase(databaseUrl);
  client = new PrismaClient({ datasources: { db: { url: safeUrl } } });
  prisma = new PrismaModule(client);
  const identity = await client.$queryRaw<
    Array<{ database: string; user: string; version: string }>
  >`
    SELECT current_database() AS database, current_user AS user,
           current_setting('server_version') AS version
  `;
  expect(identity).toEqual([
    expect.objectContaining({
      database: "bodegia_test",
      user: "bodegia_test",
      version: "16.14",
    }),
  ]);
});

beforeEach(async () => truncateFunctionalTables());

afterAll(async () => {
  if (client !== undefined) {
    await truncateFunctionalTables();
    await client.$disconnect();
  }
});

describe("MVP secret absence [T134; FR-023, FR-024, FR-027, FR-031, FR-034]", () => {
  it("keeps activation, PIN, access and refresh secrets out of persisted and telemetry surfaces", async () => {
    const bootstrap = await new BootstrapTenantService(prisma).execute(
      {
        tenantName: "Synthetic secret absence tenant",
        owner: {
          displayName: "Synthetic secret absence owner",
          phoneE164: phone,
        },
        idempotencyKey: "00000000-0000-4000-8000-000000000501",
      },
      technicalActor,
    );
    const issued = await new IssueActivationService(
      prisma,
      phoneBinding,
    ).execute({
      tenantId: bootstrap.tenantId,
      membershipId: bootstrap.membershipId,
      issuedByMembershipId: bootstrap.membershipId,
      phoneE164: phone,
      purpose: "INITIAL_ACTIVATION",
    });
    const consumed = await new ConsumeActivationService(
      prisma,
      phoneBinding,
    ).execute({
      phoneE164: phone,
      credential: { type: "QR_SECRET", value: issued.qrSecret },
      installationId: "synthetic-installation-t134",
      platform: "ANDROID",
      appVersion: "0.0.0-test",
      deviceCredential,
      requestContext: { ip: "127.0.0.1" },
    });
    await new PinService(prisma, pinServiceOptions).setup({
      deviceProfileId: consumed.deviceProfileId,
      pin,
      now: new Date("2026-07-17T20:00:00.000Z"),
    });
    const login = await new SessionService(
      prisma,
      new PinService(prisma, pinServiceOptions),
      tokens,
    ).loginWithPin({
      phone,
      pin,
      deviceCredential,
      now: new Date("2026-07-17T20:01:00.000Z"),
    });

    const persisted = await Promise.all([
      client.activationChallenge.findMany(),
      client.activationManualAlias.findMany(),
      client.deviceProfile.findMany(),
      client.refreshCredential.findMany(),
      client.auditEvent.findMany(),
      client.idempotencyRecord.findMany(),
    ]);
    const laterResponse = JSON.stringify({
      consumed: {
        deviceProfileId: consumed.deviceProfileId,
        expiresAt: consumed.expiresAt,
      },
      login: {
        activeContext: login.activeContext,
        absoluteExpiresAt: login.absoluteExpiresAt,
      },
    });
    const loggerRecords: unknown[] = [];
    new StructuredLoggerService({
      write: (record) => loggerRecords.push(record),
    }).info("synthetic security event", {
      pin,
      manualCode: issued.manualCode,
      qrSecret: issued.qrSecret,
      approvalSecret: "synthetic-approval-secret",
      browserPollingSecret: "synthetic-browser-polling-secret",
      accessToken: login.accessToken,
      refreshToken: login.refreshToken,
      pepper: pepper.toString("utf8"),
      biometricTemplate: "synthetic-biometric-template",
      phone,
    });
    const surfaces = JSON.stringify({
      persisted,
      laterResponse,
      loggerRecords,
    });
    for (const secret of [
      pin,
      issued.manualCode,
      issued.qrSecret,
      "synthetic-approval-secret",
      "synthetic-browser-polling-secret",
      login.accessToken,
      login.refreshToken,
      pepper.toString("utf8"),
      "synthetic-biometric-template",
      phone,
    ]) {
      expect(surfaces).not.toContain(secret);
    }
    expect(JSON.stringify(persisted)).toMatch(
      /qrSecretHash|codeHash|pinHash|tokenHash/iu,
    );
    expect(JSON.stringify(persisted)).not.toMatch(
      /approvalSecret|browserPollingSecret|biometricTemplate/iu,
    );
  });
});
