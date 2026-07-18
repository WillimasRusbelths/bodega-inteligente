import { normalizeE164 } from "../../../common/validation/e164.js";
import { requiredString, strictRecord } from "./validation.js";

export interface ConsumeActivationDto {
  readonly phone: string;
  readonly credential:
    | { readonly type: "QR_SECRET"; readonly value: string }
    | { readonly type: "MANUAL_CODE"; readonly value: string };
  readonly device: {
    readonly installationId: string;
    readonly platform: "ANDROID" | "IOS";
    readonly appVersion: string;
    readonly deviceCredential: string;
  };
}

export function parseConsumeActivationDto(
  value: unknown,
): ConsumeActivationDto {
  const body = strictRecord(value, ["phone", "credential", "device"]);
  const credential = strictRecord(body["credential"], [
    "type",
    "qrSecret",
    "manualCode",
  ]);
  const device = strictRecord(body["device"], [
    "installationId",
    "platform",
    "appVersion",
    "deviceCredential",
  ]);
  if (device["platform"] !== "ANDROID" && device["platform"] !== "IOS") {
    throw new Error("The request is invalid.");
  }

  let parsedCredential: ConsumeActivationDto["credential"];
  if (
    credential["type"] === "QR_SECRET" &&
    credential["manualCode"] === undefined
  ) {
    parsedCredential = {
      type: "QR_SECRET",
      value: requiredString(credential["qrSecret"], 22, 512),
    };
  } else if (
    credential["type"] === "MANUAL_CODE" &&
    credential["qrSecret"] === undefined &&
    typeof credential["manualCode"] === "string" &&
    /^\d{8}$/u.test(credential["manualCode"])
  ) {
    parsedCredential = {
      type: "MANUAL_CODE",
      value: credential["manualCode"],
    };
  } else {
    throw new Error("The request is invalid.");
  }

  return {
    phone: normalizeE164(requiredString(body["phone"], 8, 16)),
    credential: parsedCredential,
    device: {
      installationId: requiredString(device["installationId"], 1, 256),
      platform: device["platform"],
      appVersion: requiredString(device["appVersion"], 1, 64),
      deviceCredential: requiredString(device["deviceCredential"], 1, 1024),
    },
  };
}
