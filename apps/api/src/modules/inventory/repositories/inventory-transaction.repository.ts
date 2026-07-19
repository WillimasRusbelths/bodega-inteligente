import type { Prisma } from "@prisma/client";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import { TenantSessionInvalidError } from "../../access/guards/authorization-errors.js";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";

/** Keeps inventory writes in one tenant-aware Prisma transaction. */
export class InventoryTransactionRepository {
  public constructor(private readonly prisma: PrismaModule) {}

  public transaction<TResult>(
    context: TenantContext,
    work: (
      transaction: Prisma.TransactionClient,
      context: TenantContext,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    return this.prisma.transaction((transaction) => work(transaction, context));
  }
}
