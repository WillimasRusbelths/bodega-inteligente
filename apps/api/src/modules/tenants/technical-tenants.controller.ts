import { HttpExceptionFilter } from "../../common/errors/http-exception.filter.js";
import type { TechnicalActor } from "./guards/technical-admin.guard.js";
import {
  parseChangeTenantStatusDto,
  parseCreateTenantDto,
  parseIdempotencyKey,
  serializeTenantBootstrap,
  type ChangeTenantStatusDto,
} from "./dto/index.js";
import type {
  BootstrapResult,
  BootstrapTenantService,
} from "./services/bootstrap-tenant.service.js";
import type { TechnicalTenantService } from "./services/technical-tenant.service.js";

const exceptionFilter = new HttpExceptionFilter();

export const technicalTenantContract = Object.freeze({
  validateCreateRequest(
    body: unknown,
    idempotencyKey: string | undefined,
  ): unknown {
    return {
      body: parseCreateTenantDto(body),
      idempotencyKey: parseIdempotencyKey(idempotencyKey),
    };
  },
  serializeBootstrap: serializeTenantBootstrap,
  serializeError(error: unknown): unknown {
    return exceptionFilter.catch(error, "VALIDATION_ERROR").body;
  },
});

export class TechnicalTenantsController {
  public constructor(
    private readonly bootstrap: BootstrapTenantService,
    private readonly technicalTenants: TechnicalTenantService,
  ) {}

  public async createTenantWithFirstOwner(
    body: unknown,
    idempotencyKey: string | undefined,
    actor: TechnicalActor,
  ): Promise<BootstrapResult> {
    const dto = parseCreateTenantDto(body);
    return this.bootstrap.execute(
      {
        tenantName: dto.tenantName,
        owner: {
          displayName: dto.owner.displayName,
          phoneE164: dto.owner.phone,
        },
        idempotencyKey: parseIdempotencyKey(idempotencyKey),
      },
      actor,
    );
  }

  public getTechnicalTenantSummary(
    tenantId: string,
    actor: TechnicalActor,
  ): Promise<unknown> {
    return this.technicalTenants.getSummary(tenantId, actor);
  }

  public async changeTenantStatus(
    tenantId: string,
    version: number,
    body: unknown,
    actor: TechnicalActor,
  ): Promise<ChangeTenantStatusDto> {
    const dto = parseChangeTenantStatusDto(body);
    await this.technicalTenants.changeStatus(
      tenantId,
      version,
      dto.status,
      dto.reason,
      actor,
    );
    return dto;
  }
}
