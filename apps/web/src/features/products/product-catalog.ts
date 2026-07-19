import {
  canManageInventory,
  type Category,
  type InventoryWebRole,
  type InventoryWebApi,
  type Product,
  type ProductCreateInput,
  type ProductListQuery,
  type ProductStatus,
  type ProductUpdateInput,
  type UnitOfMeasure,
} from "../../api/inventory-client.js";

export type CatalogState<T> =
  | { readonly status: "IDLE" }
  | { readonly status: "LOADING" }
  | {
      readonly status: "READY";
      readonly items: readonly T[];
      readonly nextCursor: string | null;
    }
  | { readonly status: "EMPTY" }
  | { readonly status: "ERROR"; readonly message: string };

export interface ProductCatalogState {
  readonly products: CatalogState<Product>;
  readonly categories: CatalogState<Category>;
  readonly units: CatalogState<UnitOfMeasure>;
  readonly role: InventoryWebRole;
}

/** State/controller used by the web catalog. It never accepts a tenantId from a form. */
export class ProductCatalogController {
  #state: ProductCatalogState;
  public constructor(
    private readonly api: InventoryWebApi,
    role: InventoryWebRole,
  ) {
    this.#state = {
      role,
      products: { status: "IDLE" },
      categories: { status: "IDLE" },
      units: { status: "IDLE" },
    };
  }

  public get state(): ProductCatalogState {
    return this.#state;
  }

  public async loadProducts(query: ProductListQuery = {}): Promise<void> {
    this.#state = { ...this.#state, products: { status: "LOADING" } };
    try {
      const result = await this.api.listProducts(query);
      this.#state = {
        ...this.#state,
        products:
          result.items.length === 0
            ? { status: "EMPTY" }
            : {
                status: "READY",
                items: result.items,
                nextCursor: result.nextCursor,
              },
      };
    } catch {
      this.#state = {
        ...this.#state,
        products: {
          status: "ERROR",
          message: "No se pudieron cargar los productos.",
        },
      };
    }
  }

  public async loadTaxonomy(): Promise<void> {
    this.#state = {
      ...this.#state,
      categories: { status: "LOADING" },
      units: { status: "LOADING" },
    };
    const [categories, units] = await Promise.allSettled([
      this.api.listCategories(),
      this.api.listUnits(),
    ]);
    this.#state = {
      ...this.#state,
      categories:
        categories.status === "fulfilled"
          ? categories.value.items.length === 0
            ? { status: "EMPTY" }
            : {
                status: "READY",
                items: categories.value.items,
                nextCursor: categories.value.nextCursor,
              }
          : {
              status: "ERROR",
              message: "No se pudieron cargar las categorías.",
            },
      units:
        units.status === "fulfilled"
          ? units.value.items.length === 0
            ? { status: "EMPTY" }
            : {
                status: "READY",
                items: units.value.items,
                nextCursor: units.value.nextCursor,
              }
          : { status: "ERROR", message: "No se pudieron cargar las unidades." },
    };
  }

  public async createProduct(
    input: ProductCreateInput,
    idempotencyKey: string,
  ): Promise<Product> {
    this.assertCanManage();
    const product = await this.api.createProduct(input, idempotencyKey);
    await this.loadProducts();
    return product;
  }

  public async updateProduct(
    id: string,
    input: ProductUpdateInput,
    version: number,
    idempotencyKey?: string,
  ): Promise<Product> {
    this.assertCanManage();
    const product = await this.api.updateProduct(
      id,
      input,
      `"${version}"`,
      idempotencyKey,
    );
    await this.loadProducts();
    return product;
  }

  public async setProductStatus(
    id: string,
    status: ProductStatus,
    version: number,
  ): Promise<Product> {
    return this.updateProduct(id, { status }, version);
  }

  public async createCategory(
    name: string,
    idempotencyKey: string,
  ): Promise<Category> {
    this.assertCanManage();
    const result = await this.api.createCategory({ name }, idempotencyKey);
    await this.loadTaxonomy();
    return result;
  }

  public async updateCategory(
    id: string,
    name: string,
    version: number,
  ): Promise<Category> {
    this.assertCanManage();
    const result = await this.api.updateCategory(id, { name }, `"${version}"`);
    await this.loadTaxonomy();
    return result;
  }

  public async setCategoryStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    version: number,
  ): Promise<Category> {
    this.assertCanManage();
    const result = await this.api.setCategoryStatus(id, status, `"${version}"`);
    await this.loadTaxonomy();
    return result;
  }

  public async createUnit(
    input: {
      readonly code: string;
      readonly name: string;
      readonly quantityScale: number;
    },
    idempotencyKey: string,
  ): Promise<UnitOfMeasure> {
    this.assertCanManage();
    const result = await this.api.createUnit(input, idempotencyKey);
    await this.loadTaxonomy();
    return result;
  }

  public async updateUnit(
    id: string,
    input: {
      readonly code?: string;
      readonly name?: string;
      readonly quantityScale?: number;
    },
    version: number,
  ): Promise<UnitOfMeasure> {
    this.assertCanManage();
    const result = await this.api.updateUnit(id, input, `"${version}"`);
    await this.loadTaxonomy();
    return result;
  }

  public async setUnitStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    version: number,
  ): Promise<UnitOfMeasure> {
    this.assertCanManage();
    const result = await this.api.setUnitStatus(id, status, `"${version}"`);
    await this.loadTaxonomy();
    return result;
  }

  private assertCanManage(): void {
    if (!canManageInventory(this.#state.role)) throw new Error("FORBIDDEN");
  }
}
