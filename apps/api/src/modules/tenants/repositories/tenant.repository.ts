import type { Prisma, Tenant, TenantStatus } from "@prisma/client";

export interface CreateTenantInput {
  readonly name: string;
  readonly createdByTechnicalAdminId: string;
}

export interface TechnicalTenantRecord {
  readonly id: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly memberCount: number;
  readonly serviceStatus: string;
}

export class TenantRepository {
  public create(
    transaction: Prisma.TransactionClient,
    input: CreateTenantInput,
  ): Promise<Tenant> {
    return transaction.tenant.create({
      data: {
        name: input.name,
        createdByTechnicalAdminId: input.createdByTechnicalAdminId,
        status: "ACTIVE",
      },
    });
  }

  public findById(
    transaction: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<Tenant | null> {
    return transaction.tenant.findUnique({ where: { id: tenantId } });
  }

  public async findTechnicalSummary(
    transaction: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<TechnicalTenantRecord | null> {
    const tenant = await transaction.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { memberships: true } },
      },
    });
    if (tenant === null) return null;
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      memberCount: tenant._count.memberships,
      serviceStatus: "CONFIGURED",
    };
  }

  public updateStatus(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    version: number,
    status: TenantStatus,
    reason: string,
  ): Promise<Prisma.BatchPayload> {
    const disabled = status === "DISABLED";
    return transaction.tenant.updateMany({
      where: { id: tenantId, version },
      data: {
        status,
        disabledAt: disabled ? new Date() : null,
        disabledReason: disabled ? reason : null,
        version: { increment: 1 },
      },
    });
  }
}
