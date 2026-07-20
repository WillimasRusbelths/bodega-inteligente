import type {
  FefoResult,
  InventoryAlert,
  InventoryBalance,
  InventoryMovement,
  InventoryWebRole,
  Lot,
  Product,
} from "../api/inventory-client.js";
import type {
  AlertSummaryRow,
  ExpirationRiskRow,
  InventorySummary,
  MovementSummaryRow,
  StockByCategoryRow,
} from "../features/bi/inventory-bi-client.js";

const tenantId = "00000000-0000-4000-8000-000000000001";

const products: readonly Product[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    tenantId,
    name: "Leche evaporada",
    sku: "LAC-LEC-001",
    barcode: "7750001000011",
    category: { id: "00000000-0000-4000-8000-000000000201", name: "Lacteos" },
    unitOfMeasure: {
      id: "00000000-0000-4000-8000-000000000101",
      code: "unidad",
      name: "unidad",
      quantityScale: 0,
    },
    status: "ACTIVE",
    minimumStock: 12,
    expiryAlertDays: 14,
    availableStock: 18,
    version: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    tenantId,
    name: "Gaseosa 1L",
    sku: "BEB-GAS-001",
    barcode: "7750001000028",
    category: { id: "00000000-0000-4000-8000-000000000202", name: "Bebidas" },
    unitOfMeasure: {
      id: "00000000-0000-4000-8000-000000000102",
      code: "botella",
      name: "botella",
      quantityScale: 0,
    },
    status: "ACTIVE",
    minimumStock: 20,
    expiryAlertDays: 30,
    availableStock: 34,
    version: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    tenantId,
    name: "Arroz 5kg",
    sku: "ABA-ARR-005",
    barcode: "7750001000035",
    category: {
      id: "00000000-0000-4000-8000-000000000203",
      name: "Abarrotes",
    },
    unitOfMeasure: {
      id: "00000000-0000-4000-8000-000000000103",
      code: "paquete",
      name: "paquete",
      quantityScale: 0,
    },
    status: "ACTIVE",
    minimumStock: 10,
    expiryAlertDays: 60,
    availableStock: 9,
    version: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000304",
    tenantId,
    name: "Detergente 500g",
    sku: "LIM-DET-500",
    barcode: "7750001000042",
    category: { id: "00000000-0000-4000-8000-000000000204", name: "Limpieza" },
    unitOfMeasure: {
      id: "00000000-0000-4000-8000-000000000103",
      code: "paquete",
      name: "paquete",
      quantityScale: 0,
    },
    status: "ACTIVE",
    minimumStock: 8,
    expiryAlertDays: 30,
    availableStock: 16,
    version: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000305",
    tenantId,
    name: "Yogurt familiar",
    sku: "LAC-YOG-FAM",
    barcode: "7750001000059",
    category: { id: "00000000-0000-4000-8000-000000000201", name: "Lacteos" },
    unitOfMeasure: {
      id: "00000000-0000-4000-8000-000000000102",
      code: "botella",
      name: "botella",
      quantityScale: 0,
    },
    status: "ACTIVE",
    minimumStock: 15,
    expiryAlertDays: 10,
    availableStock: 6,
    version: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000306",
    tenantId,
    name: "Aceite 1L",
    sku: "ABA-ACE-001",
    barcode: "7750001000066",
    category: {
      id: "00000000-0000-4000-8000-000000000203",
      name: "Abarrotes",
    },
    unitOfMeasure: {
      id: "00000000-0000-4000-8000-000000000102",
      code: "botella",
      name: "botella",
      quantityScale: 0,
    },
    status: "ACTIVE",
    minimumStock: 10,
    expiryAlertDays: 45,
    availableStock: 52,
    version: 1,
  },
];

const lots: readonly Lot[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    tenantId,
    productId: products[0]?.id ?? "",
    expiresAt: "2026-08-05",
    initialQuantity: 24,
    availableQuantity: 18,
    status: "AVAILABLE",
    version: 1,
    receivedAt: "2026-07-18T10:00:00.000Z",
    unitCost: 3.2,
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    tenantId,
    productId: products[2]?.id ?? "",
    expiresAt: "2027-01-30",
    initialQuantity: 12,
    availableQuantity: 9,
    status: "AVAILABLE",
    version: 1,
    receivedAt: "2026-07-18T10:20:00.000Z",
    unitCost: 18.5,
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    tenantId,
    productId: products[4]?.id ?? "",
    expiresAt: "2026-07-22",
    initialQuantity: 18,
    availableQuantity: 6,
    status: "AVAILABLE",
    version: 1,
    receivedAt: "2026-07-18T10:40:00.000Z",
    unitCost: 7.8,
  },
  {
    id: "00000000-0000-4000-8000-000000000404",
    tenantId,
    productId: products[1]?.id ?? "",
    expiresAt: "2026-07-10",
    initialQuantity: 10,
    availableQuantity: 4,
    status: "EXPIRED",
    version: 1,
    receivedAt: "2026-06-10T11:00:00.000Z",
    unitCost: 4.5,
  },
];

const movements: readonly InventoryMovement[] = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    tenantId,
    productId: products[0]?.id ?? "",
    lotId: lots[0]?.id ?? "",
    type: "RECEIPT",
    quantity: 24,
    quantityDelta: 24,
    balanceBefore: 0,
    balanceAfter: 24,
    reason: "Ingreso demo",
    actorId: "00000000-0000-4000-8000-000000000011",
    createdAt: "2026-07-18T10:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    tenantId,
    productId: products[2]?.id ?? "",
    lotId: lots[1]?.id ?? "",
    type: "POSITIVE_ADJUSTMENT",
    quantity: 2,
    quantityDelta: 2,
    balanceBefore: 7,
    balanceAfter: 9,
    reason: "Conteo fisico demo",
    actorId: "00000000-0000-4000-8000-000000000012",
    createdAt: "2026-07-18T10:30:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000503",
    tenantId,
    productId: products[4]?.id ?? "",
    lotId: lots[2]?.id ?? "",
    type: "WASTE",
    quantity: 3,
    quantityDelta: -3,
    balanceBefore: 9,
    balanceAfter: 6,
    reason: "Merma demo",
    actorId: "00000000-0000-4000-8000-000000000012",
    createdAt: "2026-07-18T10:45:00.000Z",
  },
];

const balances: readonly InventoryBalance[] = lots.map((lot) => ({
  tenantId,
  productId: lot.productId,
  lotId: lot.id,
  availableQuantity: lot.availableQuantity,
  ...(lot.unitCost === undefined ? {} : { unitCost: lot.unitCost }),
}));

const alerts: readonly InventoryAlert[] = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    tenantId,
    productId: products[2]?.id ?? "",
    lotId: null,
    type: "LOW_STOCK",
    status: "ACTIVE",
    observedValue: 9,
    thresholdValue: 10,
    triggeredAt: "2026-07-18T11:00:00.000Z",
    resolvedAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000602",
    tenantId,
    productId: products[4]?.id ?? "",
    lotId: lots[2]?.id ?? "",
    type: "EXPIRING_SOON",
    status: "ACTIVE",
    observedValue: 3,
    thresholdValue: 10,
    triggeredAt: "2026-07-18T11:05:00.000Z",
    resolvedAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000603",
    tenantId,
    productId: products[1]?.id ?? "",
    lotId: lots[3]?.id ?? "",
    type: "EXPIRED",
    status: "ACTIVE",
    observedValue: -8,
    thresholdValue: 0,
    triggeredAt: "2026-07-18T11:10:00.000Z",
    resolvedAt: null,
  },
];

const fefo: FefoResult = {
  productId: products[4]?.id ?? "",
  requestedQuantity: 4,
  canFulfill: true,
  items: [
    {
      lotId: lots[2]?.id ?? "",
      expiresAt: lots[2]?.expiresAt ?? "",
      availableQuantity: lots[2]?.availableQuantity ?? 0,
      suggestedQuantity: 4,
    },
  ],
};

export interface DemoInventoryData {
  readonly role: InventoryWebRole;
  readonly products: readonly Product[];
  readonly lots: readonly Lot[];
  readonly movements: readonly InventoryMovement[];
  readonly balances: readonly InventoryBalance[];
  readonly alerts: readonly InventoryAlert[];
  readonly fefo: FefoResult;
  readonly bi: {
    readonly summary: InventorySummary;
    readonly stockByCategory: readonly StockByCategoryRow[];
    readonly expirationRisk: readonly ExpirationRiskRow[];
    readonly movementSummary: readonly MovementSummaryRow[];
    readonly alertsSummary: readonly AlertSummaryRow[];
  };
}

export function createDemoInventoryData(
  role: InventoryWebRole,
): DemoInventoryData {
  const canViewCosts = role !== "seller";
  return {
    role,
    products,
    lots,
    movements,
    balances,
    alerts,
    fefo,
    bi: {
      summary: {
        totalProducts: products.length,
        totalStockAvailable: products.reduce(
          (total, product) => total + (product.availableStock ?? 0),
          0,
        ),
        lowStockProducts: 2,
        productsExpiringSoon: 1,
        productsExpired: 1,
        activeAlerts: alerts.length,
        ...(canViewCosts ? { inventoryValuation: 680.6 } : {}),
      },
      stockByCategory: [
        {
          categoryId: "00000000-0000-4000-8000-000000000201",
          categoryName: "Lacteos",
          stockAvailable: 24,
          lowStockProducts: 1,
          ...(canViewCosts ? { inventoryValuation: 104.4 } : {}),
        },
        {
          categoryId: "00000000-0000-4000-8000-000000000202",
          categoryName: "Bebidas",
          stockAvailable: 34,
          lowStockProducts: 0,
          ...(canViewCosts ? { inventoryValuation: 153 } : {}),
        },
        {
          categoryId: "00000000-0000-4000-8000-000000000203",
          categoryName: "Abarrotes",
          stockAvailable: 61,
          lowStockProducts: 1,
          ...(canViewCosts ? { inventoryValuation: 423.2 } : {}),
        },
      ],
      expirationRisk: [
        {
          lotId: lots[2]?.id ?? "",
          productId: products[4]?.id ?? "",
          productName: "Yogurt familiar",
          categoryName: "Lacteos",
          expiresAt: "2026-07-22",
          availableQuantity: 6,
          riskState: "EXPIRING_SOON",
          ...(canViewCosts ? { estimatedLoss: 46.8 } : {}),
        },
        {
          lotId: lots[3]?.id ?? "",
          productId: products[1]?.id ?? "",
          productName: "Gaseosa 1L",
          categoryName: "Bebidas",
          expiresAt: "2026-07-10",
          availableQuantity: 4,
          riskState: "EXPIRED",
          ...(canViewCosts ? { estimatedLoss: 18 } : {}),
        },
      ],
      movementSummary: [
        { type: "RECEIPT", movementCount: 1, quantity: 24 },
        { type: "POSITIVE_ADJUSTMENT", movementCount: 1, quantity: 2 },
        { type: "WASTE", movementCount: 1, quantity: 3 },
      ],
      alertsSummary: [
        { type: "LOW_STOCK", status: "ACTIVE", alertCount: 1 },
        { type: "EXPIRING_SOON", status: "ACTIVE", alertCount: 1 },
        { type: "EXPIRED", status: "ACTIVE", alertCount: 1 },
      ],
    },
  };
}
