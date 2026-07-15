import { PrismaClient } from "@prisma/client";
import {
  runInTransaction,
  type TransactionOperation,
  type TransactionOptions,
} from "./transaction.js";

export type PrismaOperation<TResult> = (
  client: PrismaClient,
) => Promise<TResult>;

/**
 * API-local persistence boundary. Construction is lazy with respect to network I/O:
 * Prisma does not connect until an operation is executed.
 */
export class PrismaModule {
  readonly #client: PrismaClient;

  public constructor(client: PrismaClient = new PrismaClient()) {
    this.#client = client;
  }

  public execute<TResult>(
    operation: PrismaOperation<TResult>,
  ): Promise<TResult> {
    return operation(this.#client);
  }

  public transaction<TResult>(
    operation: TransactionOperation<TResult>,
    options?: TransactionOptions,
  ): Promise<TResult> {
    return runInTransaction(this.#client, operation, options);
  }

  public disconnect(): Promise<void> {
    return this.#client.$disconnect();
  }
}
