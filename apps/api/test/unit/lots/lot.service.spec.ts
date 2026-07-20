import { describe, expect, it } from "vitest";
import {
  parseLotCreateDto,
  parseLotListQuery,
} from "../../../src/modules/lots/dto/lot.dto.js";

const productId = "00000000-0000-4000-8000-000000000201";

describe("lot validation", () => {
  it("requires positive quantity, non-negative cost and a calendar date", () => {
    expect(
      parseLotCreateDto({
        receivedAt: "2026-07-19T00:00:00.000Z",
        expiresAt: "2026-12-31",
        initialQuantity: 10,
        unitCost: 4.5,
        reason: "Ingreso sintético",
      }),
    ).toMatchObject({ initialQuantity: 10, unitCost: 4.5 });
    expect(() =>
      parseLotCreateDto({
        receivedAt: "2026-07-19T00:00:00.000Z",
        expiresAt: "2026-02-30",
        initialQuantity: 10,
        unitCost: 4.5,
      }),
    ).toThrow();
    expect(() =>
      parseLotCreateDto({
        receivedAt: "2026-07-19T00:00:00.000Z",
        expiresAt: "2026-12-31",
        initialQuantity: 0,
        unitCost: 4.5,
      }),
    ).toThrow();
    expect(() =>
      parseLotCreateDto({
        receivedAt: "2026-07-19T00:00:00.000Z",
        expiresAt: "2026-12-31",
        initialQuantity: 10,
        unitCost: -1,
      }),
    ).toThrow();
  });

  it("keeps list filters strict and does not accept tenantId", () => {
    expect(parseLotListQuery({ productId, limit: "20" })).toMatchObject({
      productId,
      limit: 20,
    });
    expect(() =>
      parseLotListQuery({ tenantId: "foreign", limit: "20" }),
    ).toThrow();
  });
});
