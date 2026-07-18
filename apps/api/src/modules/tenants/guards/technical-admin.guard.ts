import { errorCatalog } from "../../../common/errors/error-catalog.js";

export interface TechnicalActor {
  readonly id: string;
  readonly technicalAdmin: boolean;
}

export class TechnicalAuthorizationError extends Error {
  public readonly code = "INSUFFICIENT_PERMISSION" as const;
  public readonly status = errorCatalog.INSUFFICIENT_PERMISSION.status;

  public constructor() {
    super(errorCatalog.INSUFFICIENT_PERMISSION.message);
    this.name = "TechnicalAuthorizationError";
  }
}

export class TechnicalAdminGuard {
  public assertAuthorized(actor: TechnicalActor): void {
    if (!actor.technicalAdmin) throw new TechnicalAuthorizationError();
  }

  public canActivate(actor: TechnicalActor): boolean {
    this.assertAuthorized(actor);
    return true;
  }
}
