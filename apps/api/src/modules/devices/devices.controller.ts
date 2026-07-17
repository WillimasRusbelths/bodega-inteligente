import {
  HttpExceptionFilter,
  type FilteredHttpError,
} from "../../common/errors/http-exception.filter.js";
import { parseRevokeDeviceDto } from "./dto/index.js";
import {
  type DeviceActorContext,
  type DeviceService,
} from "./services/device.service.js";

const errors = new HttpExceptionFilter();

class DeviceHttpError extends Error {
  public readonly status: number;
  public readonly body: FilteredHttpError["body"];

  public constructor(error: FilteredHttpError) {
    super(error.body.message);
    this.name = "DeviceHttpError";
    this.status = error.status;
    this.body = error.body;
  }
}

export class DevicesController {
  public constructor(private readonly devices: DeviceService) {}

  public listMyDevices(actor: DeviceActorContext): Promise<unknown> {
    return this.devices.listVisible(actor);
  }

  public listMemberDevices(
    membershipId: string,
    actor: DeviceActorContext,
  ): Promise<unknown> {
    this.assertCanManageMembers(actor);
    return this.devices.listVisible(actor, membershipId);
  }

  public async revokeMyDevice(
    deviceProfileId: string,
    actor: DeviceActorContext,
  ): Promise<void> {
    try {
      await this.devices.revokeProfile({
        actor,
        deviceProfileId,
        reason: "USER_REQUESTED_DEVICE_REVOCATION",
      });
    } catch (error) {
      throw new DeviceHttpError(errors.notFound(error));
    }
  }

  public async revokeMemberDevice(
    membershipId: string,
    deviceProfileId: string,
    body: unknown,
    actor: DeviceActorContext,
  ): Promise<void> {
    this.assertCanManageMembers(actor);
    const dto = parseRevokeDeviceDto(body);
    try {
      await this.devices.revokeProfile({
        actor,
        membershipId,
        deviceProfileId,
        reason: dto.reason,
      });
    } catch (error) {
      throw new DeviceHttpError(errors.notFound(error));
    }
  }

  private assertCanManageMembers(actor: DeviceActorContext): void {
    if (!actor.permissions.includes("access.memberships.manage")) {
      throw new DeviceHttpError(
        errors.catch(undefined, "INSUFFICIENT_PERMISSION"),
      );
    }
  }
}
