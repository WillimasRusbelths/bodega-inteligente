import { strictRecord } from "./validation.js";

export type ActivationPurposeDto = "INITIAL_ACTIVATION" | "DEVICE_REACTIVATION";

export interface IssueActivationDto {
  readonly purpose: ActivationPurposeDto;
}

export function parseIssueActivationDto(value: unknown): IssueActivationDto {
  const body = strictRecord(value, ["purpose"]);
  if (
    body["purpose"] !== "INITIAL_ACTIVATION" &&
    body["purpose"] !== "DEVICE_REACTIVATION"
  ) {
    throw new Error("The request is invalid.");
  }
  return { purpose: body["purpose"] };
}
