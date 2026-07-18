import type { Prisma, PrismaClient } from "@prisma/client";
import {
  TenantResourceNotFoundError,
  TenantSessionInvalidError,
} from "../../modules/access/guards/authorization-errors.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../modules/access/context/tenant-context.js";
import type { PrismaModule } from "./prisma.module.js";

type PrismaConnection = PrismaClient | Prisma.TransactionClient;

export interface TenantScopedDelegate<TEntity, TUpdate> {
  findUnique(args: {
    readonly where: {
      readonly tenantId_id: { readonly tenantId: string; readonly id: string };
    };
  }): Promise<TEntity | null>;
  updateMany(args: {
    readonly where: { readonly tenantId: string; readonly id: string };
    readonly data: TUpdate;
  }): Promise<{ readonly count: number }>;
}

export type TenantDelegateFactory<TEntity, TUpdate> = (
  connection: PrismaConnection,
) => TenantScopedDelegate<TEntity, TUpdate>;

function requireContext(context: TenantContext): void {
  if (!isTenantContext(context)) throw new TenantSessionInvalidError();
}

/**
 * Base repository exposing only tenant-scoped operations. The delegate never
 * receives an unscoped ID and transactions retain the exact TenantContext.
 */
export class TenantRepository<TEntity, TUpdate> {
  public constructor(
    private readonly prisma: PrismaModule,
    private readonly delegateFactory: TenantDelegateFactory<TEntity, TUpdate>,
    private readonly transactionConnection?: Prisma.TransactionClient,
  ) {}

  public findById(context: TenantContext, id: string): Promise<TEntity> {
    requireContext(context);
    return this.withConnection(async (connection) => {
      const entity = await this.delegateFactory(connection).findUnique({
        where: { tenantId_id: { tenantId: context.tenantId, id } },
      });
      if (entity === null) throw new TenantResourceNotFoundError();
      return entity;
    });
  }

  public updateById(
    context: TenantContext,
    id: string,
    data: TUpdate,
  ): Promise<void> {
    requireContext(context);
    return this.withConnection(async (connection) => {
      const updated = await this.delegateFactory(connection).updateMany({
        where: { tenantId: context.tenantId, id },
        data,
      });
      if (updated.count !== 1) throw new TenantResourceNotFoundError();
    });
  }

  public async transaction<TResult>(
    context: TenantContext,
    work: (
      repository: TenantRepository<TEntity, TUpdate>,
      transactionContext: TenantContext,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    requireContext(context);
    if (this.transactionConnection !== undefined) {
      return work(this, context);
    }
    return this.prisma.transaction((transaction) =>
      work(
        new TenantRepository(this.prisma, this.delegateFactory, transaction),
        context,
      ),
    );
  }

  private withConnection<TResult>(
    operation: (connection: PrismaConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return this.transactionConnection === undefined
      ? this.prisma.execute(operation)
      : operation(this.transactionConnection);
  }
}

interface HarnessState {
  records: Array<{
    id: string;
    tenantId: string;
    value: string;
    childIds: string[];
  }>;
  filters: unknown[];
}

interface HarnessRepository {
  findById(
    context: TenantContext,
    id: string,
  ): Promise<{ readonly id: string; readonly tenantId: string; value: string }>;
  updateById(context: TenantContext, id: string, value: string): Promise<void>;
  connectChild(
    context: TenantContext,
    parentId: string,
    childId: string,
  ): Promise<void>;
  transaction<T>(
    context: TenantContext,
    work: (
      repository: HarnessRepository,
      transactionContext: TenantContext,
    ) => Promise<T>,
  ): Promise<T>;
}

/** In-memory adapter proving compound filters and cross-tenant denial. */
export function createTenantRepositoryHarness(options: {
  readonly state: HarnessState;
}): HarnessRepository {
  const find = (context: TenantContext, id: string) => {
    requireContext(context);
    options.state.filters.push({
      tenantId_id: { tenantId: context.tenantId, id },
    });
    const record = options.state.records.find(
      (candidate) =>
        candidate.id === id && candidate.tenantId === context.tenantId,
    );
    if (record === undefined) throw new TenantResourceNotFoundError();
    return record;
  };

  const repository: HarnessRepository = {
    async findById(context, id) {
      await Promise.resolve();
      return find(context, id);
    },
    async updateById(context, id, value) {
      await Promise.resolve();
      find(context, id).value = value;
    },
    async connectChild(context, parentId, childId) {
      await Promise.resolve();
      const parent = find(context, parentId);
      const child = find(context, childId);
      if (parent.tenantId !== child.tenantId) {
        throw new TenantResourceNotFoundError();
      }
      parent.childIds.push(child.id);
    },
    async transaction(context, work) {
      requireContext(context);
      return work(repository, context);
    },
  };
  return repository;
}
