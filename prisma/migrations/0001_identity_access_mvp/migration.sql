-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('PERSONAL');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "DeviceProfileStatus" AS ENUM ('PENDING_PIN', 'ACTIVE', 'LOCKED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SessionPlatform" AS ENUM ('MOBILE');

-- CreateEnum
CREATE TYPE "ActivationPurpose" AS ENUM ('INITIAL_ACTIVATION', 'DEVICE_REACTIVATION');

-- CreateEnum
CREATE TYPE "ActivationChallengeStatus" AS ENUM ('ISSUED', 'CONSUMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('TECHNICAL_ADMIN', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCEEDED', 'DENIED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "phoneE164" VARCHAR(16) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabledAt" TIMESTAMPTZ(3),
    "disabledReason" VARCHAR(500),
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabledAt" TIMESTAMPTZ(3),
    "disabledReason" VARCHAR(500),
    "createdByTechnicalAdminId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "joinedAt" TIMESTAMPTZ(3),
    "createdByMembershipId" UUID,
    "disabledAt" TIMESTAMPTZ(3),
    "disabledReason" VARCHAR(500),
    "disabledByMembershipId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "catalogVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "domain" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "MembershipRole" (
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedByMembershipId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRole_pkey" PRIMARY KEY ("tenantId","membershipId","roleId")
);

-- CreateTable
CREATE TABLE "ActivationChallenge" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "qrSecretHash" BYTEA NOT NULL,
    "formatVersion" VARCHAR(32) NOT NULL,
    "purpose" "ActivationPurpose" NOT NULL,
    "status" "ActivationChallengeStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "phoneBindingHmac" BYTEA NOT NULL,
    "phoneBindingKeyVersion" VARCHAR(32) NOT NULL,
    "issuedByMembershipId" UUID NOT NULL,
    "targetDeviceNonce" VARCHAR(128),
    "consumedAt" TIMESTAMPTZ(3),
    "consumedByDeviceProfileId" UUID,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActivationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationManualAlias" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "codeHash" BYTEA NOT NULL,
    "formatVersion" VARCHAR(32) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationManualAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "type" "DeviceType" NOT NULL DEFAULT 'PERSONAL',
    "installationIdHash" BYTEA NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" VARCHAR(64) NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "revokedByMembershipId" UUID,
    "revokeReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "status" "DeviceProfileStatus" NOT NULL DEFAULT 'PENDING_PIN',
    "pinHash" BYTEA,
    "pinSaltVersion" VARCHAR(32),
    "pinPepperVersion" VARCHAR(32),
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "deviceCredentialHashOrPublicKey" BYTEA NOT NULL,
    "activatedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceProfileId" UUID NOT NULL,
    "platform" "SessionPlatform" NOT NULL DEFAULT 'MOBILE',
    "activeMembershipId" UUID,
    "tenantId" UUID,
    "authVersion" INTEGER NOT NULL,
    "contextVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" VARCHAR(500),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshCredential" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "rotatedAt" TIMESTAMPTZ(3),
    "replacedById" UUID,
    "revokedAt" TIMESTAMPTZ(3),
    "reuseDetectedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RefreshCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" UUID,
    "effectiveMembershipId" UUID,
    "sessionId" UUID,
    "deviceId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "targetType" VARCHAR(120) NOT NULL,
    "targetId" UUID,
    "result" "AuditResult" NOT NULL,
    "reasonCode" VARCHAR(120),
    "beforeSanitized" JSONB,
    "afterSanitized" JSONB,
    "correlationId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "scopeActorId" UUID NOT NULL,
    "tenantId" UUID,
    "operation" VARCHAR(120) NOT NULL,
    "idempotencyKeyHash" BYTEA NOT NULL,
    "requestHash" BYTEA NOT NULL,
    "responseStatus" INTEGER,
    "responseBodySanitized" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Membership_tenantId_status_idx" ON "Membership"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_id_key" ON "Membership"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_domain_idx" ON "Permission"("domain");

-- CreateIndex
CREATE INDEX "MembershipRole_tenantId_roleId_idx" ON "MembershipRole"("tenantId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRole_tenantId_membershipId_roleId_key" ON "MembershipRole"("tenantId", "membershipId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationChallenge_qrSecretHash_key" ON "ActivationChallenge"("qrSecretHash");

-- CreateIndex
CREATE INDEX "ActivationChallenge_tenantId_status_expiresAt_idx" ON "ActivationChallenge"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ActivationChallenge_tenantId_membershipId_idx" ON "ActivationChallenge"("tenantId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationManualAlias_challengeId_key" ON "ActivationManualAlias"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationManualAlias_codeHash_key" ON "ActivationManualAlias"("codeHash");

-- CreateIndex
CREATE INDEX "ActivationManualAlias_expiresAt_idx" ON "ActivationManualAlias"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_installationIdHash_key" ON "Device"("installationIdHash");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "DeviceProfile_tenantId_status_idx" ON "DeviceProfile"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DeviceProfile_tenantId_membershipId_idx" ON "DeviceProfile"("tenantId", "membershipId");

-- CreateIndex
CREATE INDEX "DeviceProfile_deviceId_status_idx" ON "DeviceProfile"("deviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfile_tenantId_id_key" ON "DeviceProfile"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_tenantId_activeMembershipId_idx" ON "Session"("tenantId", "activeMembershipId");

-- CreateIndex
CREATE INDEX "Session_deviceProfileId_revokedAt_idx" ON "Session"("deviceProfileId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshCredential_tokenHash_key" ON "RefreshCredential"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshCredential_replacedById_key" ON "RefreshCredential"("replacedById");

-- CreateIndex
CREATE INDEX "RefreshCredential_sessionId_revokedAt_idx" ON "RefreshCredential"("sessionId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshCredential_familyId_revokedAt_idx" ON "RefreshCredential"("familyId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_occurredAt_id_idx" ON "AuditEvent"("tenantId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "AuditEvent_actorType_actorId_occurredAt_idx" ON "AuditEvent"("actorType", "actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_tenantId_expiresAt_idx" ON "IdempotencyRecord"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scopeActorId_tenantId_operation_idempoten_key" ON "IdempotencyRecord"("scopeActorId", "tenantId", "operation", "idempotencyKeyHash");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_createdByMembershipId_fkey" FOREIGN KEY ("tenantId", "createdByMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_disabledByMembershipId_fkey" FOREIGN KEY ("tenantId", "disabledByMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_tenantId_assignedByMembershipId_fkey" FOREIGN KEY ("tenantId", "assignedByMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_tenantId_issuedByMembershipId_fkey" FOREIGN KEY ("tenantId", "issuedByMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_tenantId_consumedByDeviceProfileId_fkey" FOREIGN KEY ("tenantId", "consumedByDeviceProfileId") REFERENCES "DeviceProfile"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationManualAlias" ADD CONSTRAINT "ActivationManualAlias_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ActivationChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceProfileId_fkey" FOREIGN KEY ("deviceProfileId") REFERENCES "DeviceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_activeMembershipId_fkey" FOREIGN KEY ("tenantId", "activeMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_effectiveMembershipId_fkey" FOREIGN KEY ("tenantId", "effectiveMembershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MVP lifecycle and optimistic-concurrency invariants.
ALTER TABLE "User" ADD CONSTRAINT "User_version_positive_check" CHECK ("version" > 0 AND "authVersion" > 0);
ALTER TABLE "User" ADD CONSTRAINT "User_disabled_metadata_check" CHECK (
    ("status" = 'ACTIVE' AND "disabledAt" IS NULL AND "disabledReason" IS NULL) OR
    ("status" = 'DISABLED' AND "disabledAt" IS NOT NULL AND "disabledReason" IS NOT NULL)
);
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_version_positive_check" CHECK ("version" > 0);
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_disabled_metadata_check" CHECK (
    ("status" = 'ACTIVE' AND "disabledAt" IS NULL AND "disabledReason" IS NULL) OR
    ("status" = 'DISABLED' AND "disabledAt" IS NOT NULL AND "disabledReason" IS NOT NULL)
);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_version_positive_check" CHECK ("version" > 0);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_disabled_metadata_check" CHECK (
    ("status" <> 'DISABLED' AND "disabledAt" IS NULL AND "disabledReason" IS NULL) OR
    ("status" = 'DISABLED' AND "disabledAt" IS NOT NULL AND "disabledReason" IS NOT NULL)
);

-- The fixed MVP catalog accepts only approved role codes.
ALTER TABLE "Role" ADD CONSTRAINT "Role_approved_code_check" CHECK (
    "code" IN ('owner_admin', 'seller', 'inventory_manager')
);

-- Activation credentials remain hashes and challenges are short-lived, bounded and single-use.
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_ttl_check" CHECK (
    "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '15 minutes'
);
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_attempts_check" CHECK (
    "maxAttempts" = 5 AND "failedAttempts" >= 0 AND "failedAttempts" <= "maxAttempts"
);
ALTER TABLE "ActivationChallenge" ADD CONSTRAINT "ActivationChallenge_terminal_state_check" CHECK (
    ("status" = 'ISSUED' AND "consumedAt" IS NULL AND "consumedByDeviceProfileId" IS NULL AND "revokedAt" IS NULL) OR
    ("status" = 'CONSUMED' AND "consumedAt" IS NOT NULL AND "consumedByDeviceProfileId" IS NOT NULL AND "revokedAt" IS NULL) OR
    ("status" = 'EXPIRED' AND "consumedAt" IS NULL AND "consumedByDeviceProfileId" IS NULL AND "revokedAt" IS NULL) OR
    ("status" = 'REVOKED' AND "consumedAt" IS NULL AND "consumedByDeviceProfileId" IS NULL AND "revokedAt" IS NOT NULL)
);
ALTER TABLE "ActivationManualAlias" ADD CONSTRAINT "ActivationManualAlias_ttl_check" CHECK (
    "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '15 minutes'
);

CREATE FUNCTION "validate_activation_alias_expiry"() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."expiresAt" > (SELECT "expiresAt" FROM "ActivationChallenge" WHERE "id" = NEW."challengeId") THEN
        RAISE EXCEPTION 'activation alias cannot outlive its challenge';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActivationManualAlias_expiry_guard"
BEFORE INSERT OR UPDATE ON "ActivationManualAlias"
FOR EACH ROW EXECUTE FUNCTION "validate_activation_alias_expiry"();

-- A personal installation has at most one non-revoked profile.
CREATE UNIQUE INDEX "DeviceProfile_one_live_profile_per_device_key"
ON "DeviceProfile"("deviceId")
WHERE "status" IN ('PENDING_PIN', 'ACTIVE', 'LOCKED');

-- A profile's user must be the user of its tenant-scoped Membership.
CREATE UNIQUE INDEX "Membership_tenantId_id_userId_key"
ON "Membership"("tenantId", "id", "userId");
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_membership_user_fkey"
FOREIGN KEY ("tenantId", "membershipId", "userId")
REFERENCES "Membership"("tenantId", "id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_pin_metadata_check" CHECK (
    ("pinHash" IS NULL AND "pinSaltVersion" IS NULL AND "pinPepperVersion" IS NULL) OR
    ("pinHash" IS NOT NULL AND "pinSaltVersion" IS NOT NULL AND "pinPepperVersion" IS NOT NULL)
);
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_failed_pin_attempts_check" CHECK (
    "failedPinAttempts" >= 0 AND "failedPinAttempts" <= 5
);

-- Mobile sessions never become sliding sessions beyond the approved eight-hour absolute limit.
ALTER TABLE "Session" ADD CONSTRAINT "Session_absolute_expiry_check" CHECK (
    "absoluteExpiresAt" > "createdAt" AND "absoluteExpiresAt" <= "createdAt" + INTERVAL '8 hours'
);
ALTER TABLE "Session" ADD CONSTRAINT "Session_context_check" CHECK (
    ("tenantId" IS NULL AND "activeMembershipId" IS NULL) OR
    ("tenantId" IS NOT NULL AND "activeMembershipId" IS NOT NULL)
);
ALTER TABLE "Session" ADD CONSTRAINT "Session_versions_positive_check" CHECK (
    "authVersion" > 0 AND "contextVersion" > 0
);
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_expiry_check" CHECK ("expiresAt" > "issuedAt");
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_rotation_check" CHECK (
    ("replacedById" IS NULL AND "rotatedAt" IS NULL) OR
    ("replacedById" IS NOT NULL AND "rotatedAt" IS NOT NULL)
);

-- NULL tenant denotes a truly global operation and must still be collision-safe.
CREATE UNIQUE INDEX "IdempotencyRecord_scope_with_global_tenant_key"
ON "IdempotencyRecord"(
    "scopeActorId",
    COALESCE("tenantId", '00000000-0000-0000-0000-000000000000'::UUID),
    "operation",
    "idempotencyKeyHash"
);
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_expiry_check" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_response_check" CHECK (
    ("responseStatus" IS NULL AND "responseBodySanitized" IS NULL) OR
    ("responseStatus" BETWEEN 100 AND 599)
);

-- AuditEvent is append-only; payload columns are explicitly sanitized and contain no raw secret fields.
CREATE FUNCTION "prevent_audit_event_mutation"() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AuditEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only_guard"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();
