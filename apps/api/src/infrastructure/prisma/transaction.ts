import type { Prisma, PrismaClient } from "@prisma/client";

export type TransactionIsolationLevel =
  | "ReadCommitted"
  | "RepeatableRead"
  | "Serializable";

export interface TransactionOptions {
  readonly isolationLevel?: TransactionIsolationLevel;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

export type TransactionOperation<TResult> = (
  transaction: Prisma.TransactionClient,
) => Promise<TResult>;

const defaultOptions = Object.freeze({
  isolationLevel: "Serializable" as const,
  maxWaitMs: 5_000,
  timeoutMs: 10_000,
});

export async function runInTransaction<TResult>(
  client: PrismaClient,
  operation: TransactionOperation<TResult>,
  options: TransactionOptions = {},
): Promise<TResult> {
  const isolationLevel =
    options.isolationLevel ?? defaultOptions.isolationLevel;
  const maxWait = options.maxWaitMs ?? defaultOptions.maxWaitMs;
  const timeout = options.timeoutMs ?? defaultOptions.timeoutMs;

  if (maxWait <= 0 || timeout <= 0) {
    throw new Error("Transaction time limits must be positive.");
  }

  return client.$transaction(operation, { isolationLevel, maxWait, timeout });
}
