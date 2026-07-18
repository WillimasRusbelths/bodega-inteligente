import type { Prisma } from "@prisma/client";
import type { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import {
  AuditService,
  type AppendAuditEventInput,
} from "./services/audit.service.js";

export interface AuditedOperationResult<TResult> {
  readonly result: TResult;
  readonly audit: AppendAuditEventInput;
}

/**
 * Runs the state mutation and its single audit append inside one Serializable
 * transaction. A failure in either step rejects and lets PostgreSQL roll back both.
 */
export class AuditedTransaction {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly audit: AuditService = new AuditService(),
  ) {}

  public execute<TResult>(
    operation: (
      transaction: Prisma.TransactionClient,
    ) => Promise<AuditedOperationResult<TResult>>,
  ): Promise<TResult> {
    return this.prisma.transaction(
      async (transaction) => {
        const completed = await operation(transaction);
        await this.audit.append(transaction, completed.audit);
        return completed.result;
      },
      { isolationLevel: "Serializable" },
    );
  }
}
