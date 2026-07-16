import type { Prisma, User } from "@prisma/client";
import { normalizeE164 } from "../../../common/validation/e164.js";

export interface CreateGlobalUserInput {
  readonly displayName: string;
  readonly phoneE164: string;
}

export class UserRepository {
  public findByNormalizedPhone(
    transaction: Prisma.TransactionClient,
    phoneE164: string,
  ): Promise<User | null> {
    return transaction.user.findUnique({
      where: { phoneE164: normalizeE164(phoneE164) },
    });
  }

  public createGlobalUser(
    transaction: Prisma.TransactionClient,
    input: CreateGlobalUserInput,
  ): Promise<User> {
    return transaction.user.create({
      data: {
        displayName: input.displayName,
        phoneE164: normalizeE164(input.phoneE164),
        status: "ACTIVE",
      },
    });
  }

  public async findOrCreateGlobalUser(
    transaction: Prisma.TransactionClient,
    input: CreateGlobalUserInput,
  ): Promise<User> {
    const phoneE164 = normalizeE164(input.phoneE164);
    return transaction.user.upsert({
      where: { phoneE164 },
      update: {},
      create: { displayName: input.displayName, phoneE164, status: "ACTIVE" },
    });
  }
}
