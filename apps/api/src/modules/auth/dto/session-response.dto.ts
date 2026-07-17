import type { RefreshRotationResponse } from "../services/refresh-rotation.service.js";
import type { SessionCreationResponse } from "../services/session.service.js";

export interface SessionResponseDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly activeContext: null | {
    readonly tenantId: string;
    readonly membershipId: string;
  };
}

export function serializeSessionResponse(
  value: SessionCreationResponse | RefreshRotationResponse,
): SessionResponseDto {
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    accessExpiresAt: value.accessExpiresAt.toISOString(),
    absoluteExpiresAt: value.absoluteExpiresAt.toISOString(),
    activeContext: value.activeContext,
  };
}
