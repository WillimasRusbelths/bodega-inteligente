export type InventoryResource =
  | "Category"
  | "UnitOfMeasure"
  | "Product"
  | "Lot"
  | "InventoryBalance"
  | "InventoryMovement"
  | "Fefo"
  | "InventoryAlert";
export type InventoryAttackVector =
  | "pathParam"
  | "bodyParam"
  | "queryParam"
  | "cursor"
  | "foreignId"
  | "missingId"
  | "nestedRelation";
export interface InventoryIsolationCase {
  readonly id: string;
  readonly resource: InventoryResource;
  readonly operation: "read" | "list" | "write" | "admin";
  readonly sourceTenant: "A" | "B";
  readonly targetTenant: "A" | "B";
  readonly attackVector: InventoryAttackVector;
  readonly expected: "NOT_FOUND" | "FORBIDDEN" | "NO_DATA" | "NO_MUTATION";
}

const resources: readonly InventoryResource[] = [
  "Category",
  "UnitOfMeasure",
  "Product",
  "Lot",
  "InventoryBalance",
  "InventoryMovement",
  "Fefo",
  "InventoryAlert",
];
const vectors: readonly InventoryAttackVector[] = [
  "pathParam",
  "bodyParam",
  "queryParam",
  "cursor",
  "foreignId",
  "nestedRelation",
];

export const INVENTORY_TENANT_ISOLATION_MATRIX: readonly InventoryIsolationCase[] =
  Object.freeze(
    resources.flatMap((resource) => [
      ...(["A", "B"] as const).flatMap((sourceTenant) => {
        const targetTenant = sourceTenant === "A" ? "B" : "A";
        return vectors.map(
          (attackVector): InventoryIsolationCase => ({
            id: `${resource}-${sourceTenant}-${attackVector}`,
            resource,
            operation: attackVector === "bodyParam" ? "write" : "read",
            sourceTenant,
            targetTenant,
            attackVector,
            expected:
              attackVector === "queryParam" || attackVector === "cursor"
                ? "NO_DATA"
                : "NOT_FOUND",
          }),
        );
      }),
      {
        id: `${resource}-missing`,
        resource,
        operation: "read" as const,
        sourceTenant: "A" as const,
        targetTenant: "A" as const,
        attackVector: "missingId" as const,
        expected: "NOT_FOUND" as const,
      },
    ]),
  );
