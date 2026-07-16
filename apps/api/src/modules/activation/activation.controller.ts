import { HttpExceptionFilter } from "../../common/errors/http-exception.filter.js";
import type {
  CreateMembershipService,
  MembershipActorContext,
} from "../memberships/services/create-membership.service.js";
import {
  parseConsumeActivationDto,
  parseCreateMembershipDto,
  parseIssueActivationDto,
  serializeActivationConsume,
  serializeActivationIssue,
  serializeMembership,
} from "./dto/index.js";
import type { ConsumeActivationService } from "./services/consume-activation.service.js";
import type { IssueActivationService } from "./services/issue-activation.service.js";

interface ContractActivationState {
  devices: Array<{ type: string }>;
  profiles: Array<{ status: string }>;
}

const filter = new HttpExceptionFilter();

export const activationContract = Object.freeze({
  validateCreateMembership: parseCreateMembershipDto,
  validateIssue: parseIssueActivationDto,
  validateConsume: parseConsumeActivationDto,
  async dispatchConsume(
    body: unknown,
    state: ContractActivationState,
  ): Promise<unknown> {
    await Promise.resolve();
    parseConsumeActivationDto(body);
    state.devices.push({ type: "PERSONAL" });
    state.profiles.push({ status: "PENDING_PIN" });
    return { accepted: true };
  },
  serializeMembership,
  serializeIssue: serializeActivationIssue,
  serializeConsume: serializeActivationConsume,
  serializeError(error: unknown): unknown {
    return filter.catch(error, "AUTHENTICATION_FAILED").body;
  },
});

export class ActivationController {
  public constructor(
    private readonly memberships: CreateMembershipService,
    private readonly issuer: IssueActivationService,
    private readonly consumer: ConsumeActivationService,
  ) {}

  public createMembership(
    body: unknown,
    actor: MembershipActorContext,
  ): Promise<unknown> {
    const dto = parseCreateMembershipDto(body);
    if (dto.roles.length !== 1) throw new Error("The request is invalid.");
    const role = dto.roles[0];
    if (role === undefined) throw new Error("The request is invalid.");
    return this.memberships.execute(
      {
        displayName: dto.displayName,
        phoneE164: dto.phone,
        role,
      },
      actor,
    );
  }

  public issueActivation(
    membershipId: string,
    phoneE164: string,
    body: unknown,
    actor: MembershipActorContext,
  ): Promise<unknown> {
    if (!actor.permissions.includes("access.memberships.manage")) {
      throw new Error("The operation is not allowed.");
    }
    const dto = parseIssueActivationDto(body);
    return this.issuer.execute({
      tenantId: actor.tenantId,
      membershipId,
      issuedByMembershipId: actor.membershipId,
      phoneE164,
      purpose: dto.purpose,
    });
  }

  public consumeActivation(
    body: unknown,
    requestContext: { readonly ip: string },
  ): Promise<unknown> {
    const dto = parseConsumeActivationDto(body);
    return this.consumer.execute({
      phoneE164: dto.phone,
      credential: dto.credential,
      installationId: dto.device.installationId,
      platform: dto.device.platform,
      appVersion: dto.device.appVersion,
      deviceCredential: dto.device.deviceCredential,
      requestContext,
    });
  }
}
