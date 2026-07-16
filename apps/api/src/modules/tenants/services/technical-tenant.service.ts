import { randomUUID } from "node:crypto";
import type { TenantStatus } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  TechnicalAdminGuard,
  type TechnicalActor,
} from "../guards/technical-admin.guard.js";
import { TenantRepository } from "../repositories/tenant.repository.js";

export interface TechnicalTenantSummary {
  readonly id: unknown;
  readonly name: unknown;
  readonly status: unknown;
  readonly memberCount: unknown;
  readonly serviceStatus: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Builds the response from an explicit allowlist; unknown and nested fields never propagate. */
export function buildTechnicalTenantSummary(
  value: unknown,
): TechnicalTenantSummary {
  const source = record(value);
  return {
    id: source["id"],
    name: source["name"],
    status: source["status"],
    memberCount: source["memberCount"],
    serviceStatus: source["serviceStatus"],
  };
}

export class TechnicalTenantService {
  readonly #guard = new TechnicalAdminGuard();

  public constructor(
    private readonly prisma: PrismaModule,
    private readonly tenants: TenantRepository = new TenantRepository(),
  ) {}

  public getSummary(
    tenantId: string,
    actor: TechnicalActor,
  ): Promise<TechnicalTenantSummary> {
    this.#guard.assertAuthorized(actor);
    return this.prisma.transaction(async (transaction) => {
      const tenant = await this.tenants.findTechnicalSummary(
        transaction,
        tenantId,
      );
      if (tenant === null)
        throw new Error("The requested resource is not available.");
      return buildTechnicalTenantSummary(tenant);
    });
  }

  public changeStatus(
    tenantId: string,
    version: number,
    status: TenantStatus,
    reason: string,
    actor: TechnicalActor,
  ): Promise<void> {
    this.#guard.assertAuthorized(actor);
    return this.prisma.transaction(async (transaction) => {
      const updated = await this.tenants.updateStatus(
        transaction,
        tenantId,
        version,
        status,
        reason,
      );
      if (updated.count !== 1)
        throw new Error("The resource changed. Reload and try again.");
      await transaction.auditEvent.create({
        data: {
          tenantId,
          actorType: "TECHNICAL_ADMIN",
          actorId: actor.id,
          action: status === "ACTIVE" ? "TENANT_ACTIVATED" : "TENANT_DISABLED",
          targetType: "Tenant",
          targetId: tenantId,
          result: "SUCCEEDED",
          reasonCode: reason,
          correlationId: randomUUID(),
          afterSanitized: { status },
        },
      });
    });
  }
}
