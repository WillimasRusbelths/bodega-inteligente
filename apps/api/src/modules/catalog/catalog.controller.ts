import { HttpExceptionFilter } from "../../common/errors/http-exception.filter.js";
import type { ErrorCode } from "../../common/errors/error-catalog.js";
import {
  catalogStatus,
  parseCatalogStatusDto,
  parseCategoryCreateDto,
  parseCategoryUpdateDto,
  parseProductCreateDto,
  parseProductListQuery,
  parseProductUpdateDto,
  parseUnitCreateDto,
  parseUnitUpdateDto,
  requireIdempotencyKey,
  type CatalogStatusDto,
} from "./dto/index.js";
import {
  ProductService,
  CatalogMutationError,
} from "./services/product.service.js";
import type { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import type { TenantContext } from "../access/context/tenant-context.js";

const filter = new HttpExceptionFilter();

function queryRecord(
  value: Record<string, unknown>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, item] of Object.entries(value))
    result[key] = typeof item === "string" ? item : undefined;
  return result;
}

function parseCatalogQuery(value: Record<string, unknown>): {
  readonly status?: "ACTIVE" | "INACTIVE";
  readonly cursorId?: string;
  readonly limit: number;
} {
  const query = queryRecord(value);
  const rawLimit = query["limit"] === undefined ? 50 : Number(query["limit"]);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100)
    throw new Error("The request is invalid.");
  const status =
    query["status"] === undefined ? undefined : catalogStatus(query["status"]);
  return {
    limit: rawLimit,
    ...(status === undefined ? {} : { status }),
    ...(query["cursor"] === undefined ? {} : { cursorId: query["cursor"] }),
  };
}

function responseData(value: Readonly<Record<string, unknown>>): {
  readonly data: Readonly<Record<string, unknown>>;
} {
  return { data: value };
}

export const catalogContract = Object.freeze({
  validateCategoryCreate: parseCategoryCreateDto,
  validateCategoryUpdate: parseCategoryUpdateDto,
  validateUnitCreate: parseUnitCreateDto,
  validateUnitUpdate: parseUnitUpdateDto,
  validateProductCreate: parseProductCreateDto,
  validateProductUpdate: parseProductUpdateDto,
  validateProductList: parseProductListQuery,
  validateStatus: parseCatalogStatusDto,
  validateIdempotencyKey: requireIdempotencyKey,
  serializeError(error: unknown): unknown {
    let code: ErrorCode = "VALIDATION_ERROR";
    if (error instanceof CatalogMutationError) {
      code = error.code === "CONFLICT" ? "STALE_STATE" : error.code;
    }
    return filter.catch(error, code).body;
  },
});

export class CatalogController {
  private readonly service: ProductService;
  public constructor(
    prisma: PrismaModule,
    service = new ProductService(prisma),
  ) {
    this.service = service;
  }

  public listCategories(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.listCategories(context, parseCatalogQuery(query));
  }
  public async createCategory(
    context: TenantContext,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    requireIdempotencyKey(idempotencyKey);
    return responseData(
      await this.service.createCategory(
        context,
        parseCategoryCreateDto(body),
        requireIdempotencyKey(idempotencyKey),
      ),
    );
  }
  public async updateCategory(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<unknown> {
    return responseData(
      await this.service.updateCategory(
        context,
        id,
        ifMatch,
        parseCategoryUpdateDto(body),
      ),
    );
  }
  public async setCategoryStatus(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<unknown> {
    const dto: CatalogStatusDto = parseCatalogStatusDto(body);
    return responseData(
      await this.service.updateCategoryStatus(context, id, ifMatch, dto),
    );
  }

  public listUnits(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.listUnits(context, parseCatalogQuery(query));
  }
  public async createUnit(
    context: TenantContext,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    requireIdempotencyKey(idempotencyKey);
    return responseData(
      await this.service.createUnit(
        context,
        parseUnitCreateDto(body),
        requireIdempotencyKey(idempotencyKey),
      ),
    );
  }
  public async updateUnit(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<unknown> {
    return responseData(
      await this.service.updateUnit(
        context,
        id,
        ifMatch,
        parseUnitUpdateDto(body),
      ),
    );
  }
  public async setUnitStatus(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<unknown> {
    return responseData(
      await this.service.updateUnitStatus(
        context,
        id,
        ifMatch,
        parseCatalogStatusDto(body),
      ),
    );
  }

  public listProducts(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.listProducts(
      context,
      parseProductListQuery(queryRecord(query)),
    );
  }
  public async createProduct(
    context: TenantContext,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    requireIdempotencyKey(idempotencyKey);
    return responseData(
      await this.service.createProduct(
        context,
        parseProductCreateDto(body),
        requireIdempotencyKey(idempotencyKey),
      ),
    );
  }
  public async getProduct(
    context: TenantContext,
    id: string,
  ): Promise<unknown> {
    return responseData(await this.service.getProduct(context, id));
  }
  public async updateProduct(
    context: TenantContext,
    id: string,
    ifMatch: string | undefined,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    requireIdempotencyKey(idempotencyKey);
    return responseData(
      await this.service.updateProduct(
        context,
        id,
        ifMatch,
        parseProductUpdateDto(body),
        requireIdempotencyKey(idempotencyKey),
      ),
    );
  }
}
