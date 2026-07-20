import { PrismaClient } from "@prisma/client";
import process from "node:process";

const prisma = new PrismaClient();
const demoTransactionOptions = {
  maxWait: 15_000,
  timeout: 120_000,
};
const ids = {
  tenant: "00000000-0000-4000-8000-000000000001",
  users: {
    owner: "00000000-0000-4000-8000-000000000011",
    manager: "00000000-0000-4000-8000-000000000012",
    seller: "00000000-0000-4000-8000-000000000013",
  },
  memberships: {
    owner: "00000000-0000-4000-8000-000000000101",
    manager: "00000000-0000-4000-8000-000000000102",
    seller: "00000000-0000-4000-8000-000000000103",
  },
};

const categories = [
  ["00000000-0000-4000-8000-000000000201", "Bebidas"],
  ["00000000-0000-4000-8000-000000000202", "Abarrotes"],
  ["00000000-0000-4000-8000-000000000203", "Lácteos"],
  ["00000000-0000-4000-8000-000000000204", "Limpieza"],
];
const units = [
  ["00000000-0000-4000-8000-000000000301", "unidad", "Unidad"],
  ["00000000-0000-4000-8000-000000000302", "botella", "Botella"],
  ["00000000-0000-4000-8000-000000000303", "paquete", "Paquete"],
  ["00000000-0000-4000-8000-000000000304", "caja", "Caja"],
];

function day(offset) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  return value;
}

function requireDemoSeedPermission() {
  const nodeEnv = process.env["NODE_ENV"] ?? "development";
  const allowDemoSeed = process.env["ALLOW_DEMO_SEED"] === "true";
  if (nodeEnv === "production" && !allowDemoSeed) {
    throw new Error(
      "Refusing to run demo seed with NODE_ENV=production. Set ALLOW_DEMO_SEED=true only for an approved demo database.",
    );
  }
}

function product(
  id,
  name,
  sku,
  categoryId,
  unitOfMeasureId,
  minimumStock,
  expiryAlertDays,
  salePrice,
) {
  return {
    id,
    tenantId: ids.tenant,
    name,
    normalizedName: name.toLocaleLowerCase("es-PE"),
    sku,
    barcode: null,
    categoryId,
    unitOfMeasureId,
    minimumStock,
    expiryAlertDays,
    salePrice,
    status: "ACTIVE",
  };
}

async function main() {
  requireDemoSeedPermission();
  const now = new Date();
  const ownerUser = ids.users.owner;
  await prisma.$transaction(async (tx) => {
    await tx.tenant.upsert({
      where: { id: ids.tenant },
      update: {
        name: "Bodega San Cristóbal",
        status: "ACTIVE",
        operatingTimeZone: "America/Lima",
        locationText: "Ayacucho, Peru",
        currencyCode: "PEN",
        referenceSchedule: "Lunes a domingo, 7:00 a 22:00",
      },
      create: {
        id: ids.tenant,
        name: "Bodega San Cristóbal",
        status: "ACTIVE",
        createdByTechnicalAdminId: ownerUser,
        operatingTimeZone: "America/Lima",
        locationText: "Ayacucho, Peru",
        currencyCode: "PEN",
        referenceSchedule: "Lunes a domingo, 7:00 a 22:00",
      },
    });
    for (const [id, displayName, phoneE164] of [
      [ids.users.owner, "Propietario demo", "+51999900001"],
      [ids.users.manager, "Encargado de inventario demo", "+51999900002"],
      [ids.users.seller, "Vendedor demo", "+51999900003"],
    ]) {
      await tx.user.upsert({
        where: { id },
        update: { displayName, phoneE164, status: "ACTIVE" },
        create: { id, displayName, phoneE164, status: "ACTIVE" },
      });
    }
    for (const [id, userId] of Object.entries(ids.memberships).map(
      ([key, id]) => [
        id,
        ids.users[
          key === "owner" ? "owner" : key === "manager" ? "manager" : "seller"
        ],
      ],
    )) {
      await tx.membership.upsert({
        where: { id },
        update: {
          tenantId: ids.tenant,
          userId,
          status: "ACTIVE",
          joinedAt: now,
        },
        create: {
          id,
          tenantId: ids.tenant,
          userId,
          status: "ACTIVE",
          joinedAt: now,
        },
      });
    }
    const roleSpecs = [
      ["owner_admin", "Owner administrador"],
      ["inventory_manager", "Responsable de inventario"],
      ["seller", "Vendedor"],
    ];
    const permissionCodes = [
      "inventory.products.read",
      "inventory.products.write",
      "inventory.lots.read",
      "inventory.lots.write",
      "inventory.stock.read",
      "inventory.stock.adjust",
      "inventory.movements.read",
      "inventory.movements.write",
      "inventory.alerts.read",
      "inventory.alerts.write",
      "sales.read",
      "sales.write",
    ];
    const permissions = new Map();
    for (const code of permissionCodes) {
      const permission = await tx.permission.upsert({
        where: { code },
        update: { domain: "inventory" },
        create: { code, domain: "inventory" },
      });
      permissions.set(code, permission.id);
    }
    const roles = new Map();
    for (const [code, name] of roleSpecs) {
      const role = await tx.role.upsert({
        where: { code },
        update: { name, catalogVersion: 2 },
        create: { code, name, catalogVersion: 2 },
      });
      roles.set(code, role.id);
    }
    const adminPermissions = permissionCodes;
    const sellerPermissions = [
      "inventory.products.read",
      "inventory.lots.read",
      "inventory.stock.read",
      "inventory.movements.read",
      "inventory.alerts.read",
      "sales.read",
      "sales.write",
    ];
    await tx.rolePermission.createMany({
      data: adminPermissions.flatMap((code) =>
        ["owner_admin", "inventory_manager"].map((roleCode) => ({
          roleId: roles.get(roleCode),
          permissionId: permissions.get(code),
        })),
      ),
      skipDuplicates: true,
    });
    await tx.rolePermission.deleteMany({
      where: {
        roleId: roles.get("seller"),
        permissionId: {
          in: permissionCodes.map((code) => permissions.get(code)),
        },
      },
    });
    await tx.rolePermission.createMany({
      data: sellerPermissions.map((code) => ({
        roleId: roles.get("seller"),
        permissionId: permissions.get(code),
      })),
      skipDuplicates: true,
    });
    await tx.membershipRole.deleteMany({ where: { tenantId: ids.tenant } });
    for (const [membershipId, roleCode] of [
      [ids.memberships.owner, "owner_admin"],
      [ids.memberships.manager, "inventory_manager"],
      [ids.memberships.seller, "seller"],
    ]) {
      await tx.membershipRole.create({
        data: {
          tenantId: ids.tenant,
          membershipId,
          roleId: roles.get(roleCode),
          assignedByMembershipId: ids.memberships.owner,
        },
      });
    }
    await tx.inventoryAlert.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.saleItem.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.sale.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.alertRule.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.inventoryBalance.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.inventoryMovement.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.lot.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.product.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.unitOfMeasure.deleteMany({ where: { tenantId: ids.tenant } });
    await tx.productCategory.deleteMany({ where: { tenantId: ids.tenant } });
    for (const [id, name] of categories) {
      await tx.productCategory.create({
        data: {
          id,
          tenantId: ids.tenant,
          name,
          normalizedName: name.toLocaleLowerCase("es-PE"),
        },
      });
    }
    for (const [id, code, name] of units) {
      await tx.unitOfMeasure.create({
        data: {
          id,
          tenantId: ids.tenant,
          code,
          name,
          normalizedName: name.toLocaleLowerCase("es-PE"),
          quantityScale: 0,
        },
      });
    }
    const categoryId = Object.fromEntries(
      categories.map(([id, name]) => [name, id]),
    );
    const unitId = Object.fromEntries(units.map(([id, code]) => [code, id]));
    const products = [
      product(
        "00000000-0000-4000-8000-000000000401",
        "Leche evaporada",
        "LEC-001",
        categoryId["Lácteos"],
        unitId["unidad"],
        10,
        14,
        5.5,
      ),
      product(
        "00000000-0000-4000-8000-000000000402",
        "Gaseosa 1L",
        "GAS-001",
        categoryId["Bebidas"],
        unitId["botella"],
        30,
        10,
        6.0,
      ),
      product(
        "00000000-0000-4000-8000-000000000403",
        "Arroz 5kg",
        "ARR-001",
        categoryId["Abarrotes"],
        unitId["paquete"],
        5,
        30,
        22.0,
      ),
      product(
        "00000000-0000-4000-8000-000000000404",
        "Detergente 500g",
        "DET-001",
        categoryId["Limpieza"],
        unitId["unidad"],
        8,
        0,
        9.5,
      ),
      product(
        "00000000-0000-4000-8000-000000000405",
        "Yogurt familiar",
        "YOG-001",
        categoryId["Lácteos"],
        unitId["unidad"],
        5,
        7,
        8.0,
      ),
      product(
        "00000000-0000-4000-8000-000000000406",
        "Aceite 1L",
        "ACE-001",
        categoryId["Abarrotes"],
        unitId["botella"],
        10,
        30,
        12.0,
      ),
    ];
    for (const data of products) await tx.product.create({ data });
    const lots = [
      [
        "00000000-0000-4000-8000-000000000501",
        products[0].id,
        -40,
        40,
        40,
        4.5,
      ],
      ["00000000-0000-4000-8000-000000000502", products[1].id, 7, 30, 26, 3.2],
      ["00000000-0000-4000-8000-000000000503", products[2].id, -7, 10, 2, 8.9],
      ["00000000-0000-4000-8000-000000000504", products[3].id, 35, 35, 35, 6.4],
      ["00000000-0000-4000-8000-000000000505", products[4].id, 3, 12, 12, 2.8],
      ["00000000-0000-4000-8000-000000000506", products[5].id, 30, 25, 20, 7.1],
    ];
    for (const [
      index,
      [
        id,
        productId,
        expiryOffset,
        initialQuantity,
        availableQuantity,
        unitCost,
      ],
    ] of lots.entries()) {
      const receivedAt = new Date(now.getTime() - (index + 1) * 86_400_000);
      await tx.lot.create({
        data: {
          id,
          tenantId: ids.tenant,
          productId,
          receivedAt,
          expiresAt: day(expiryOffset),
          initialQuantity,
          availableQuantity,
          unitCost,
          status: "AVAILABLE",
          createdBy: ownerUser,
        },
      });
      await tx.inventoryBalance.create({
        data: {
          tenantId: ids.tenant,
          productId,
          lotId: id,
          availableQuantity,
          reservedQuantity: 0,
        },
      });
    }
    const movementSpecs = [
      [
        "00000000-0000-4000-8000-000000000601",
        lots[0][0],
        products[0].id,
        "RECEIPT",
        40,
        0,
        40,
        "Ingreso demo",
      ],
      [
        "00000000-0000-4000-8000-000000000602",
        lots[1][0],
        products[1].id,
        "RECEIPT",
        30,
        0,
        30,
        "Ingreso demo",
      ],
      [
        "00000000-0000-4000-8000-000000000603",
        lots[1][0],
        products[1].id,
        "WASTE",
        4,
        30,
        26,
        "Merma demo",
      ],
      [
        "00000000-0000-4000-8000-000000000604",
        lots[2][0],
        products[2].id,
        "RECEIPT",
        10,
        0,
        10,
        "Ingreso demo",
      ],
      [
        "00000000-0000-4000-8000-000000000605",
        lots[2][0],
        products[2].id,
        "NEGATIVE_ADJUSTMENT",
        8,
        10,
        2,
        "Ajuste demo",
      ],
      [
        "00000000-0000-4000-8000-000000000606",
        lots[3][0],
        products[3].id,
        "RECEIPT",
        30,
        0,
        30,
        "Ingreso demo",
      ],
      [
        "00000000-0000-4000-8000-000000000607",
        lots[3][0],
        products[3].id,
        "POSITIVE_ADJUSTMENT",
        5,
        30,
        35,
        "Ajuste demo",
      ],
      [
        "00000000-0000-4000-8000-000000000608",
        lots[4][0],
        products[4].id,
        "RECEIPT",
        12,
        0,
        12,
        "Ingreso demo",
      ],
      [
        "00000000-0000-4000-8000-000000000609",
        lots[5][0],
        products[5].id,
        "RECEIPT",
        25,
        0,
        25,
        "Ingreso demo",
      ],
      [
        "00000000-0000-4000-8000-000000000610",
        lots[5][0],
        products[5].id,
        "WASTE",
        5,
        25,
        20,
        "Merma demo",
      ],
    ];
    for (const [
      id,
      lotId,
      productId,
      type,
      quantity,
      balanceBefore,
      balanceAfter,
      reason,
    ] of movementSpecs) {
      await tx.inventoryMovement.create({
        data: {
          id,
          tenantId: ids.tenant,
          productId,
          lotId,
          type,
          quantity,
          quantityDelta:
            type === "RECEIPT" || type === "POSITIVE_ADJUSTMENT"
              ? quantity
              : -quantity,
          balanceBefore,
          balanceAfter,
          reason,
          actorId: ownerUser,
        },
      });
    }
    const alerts = [
      [
        "00000000-0000-4000-8000-000000000701",
        products[1].id,
        null,
        "LOW_STOCK",
        26,
        30,
      ],
      [
        "00000000-0000-4000-8000-000000000702",
        products[1].id,
        lots[1][0],
        "EXPIRING_SOON",
        7,
        10,
      ],
      [
        "00000000-0000-4000-8000-000000000703",
        products[2].id,
        lots[2][0],
        "LOW_STOCK",
        2,
        5,
      ],
      [
        "00000000-0000-4000-8000-000000000704",
        products[2].id,
        lots[2][0],
        "EXPIRED",
        0,
        0,
      ],
      [
        "00000000-0000-4000-8000-000000000705",
        products[4].id,
        lots[4][0],
        "EXPIRING_SOON",
        3,
        7,
      ],
    ];
    for (const [
      id,
      productId,
      lotId,
      type,
      observedValue,
      thresholdValue,
    ] of alerts) {
      await tx.inventoryAlert.create({
        data: {
          id,
          tenantId: ids.tenant,
          productId,
          lotId,
          type,
          status: "ACTIVE",
          observedValue,
          thresholdValue,
        },
      });
    }
    for (const data of products) {
      await tx.alertRule.create({
        data: {
          tenantId: ids.tenant,
          productId: data.id,
          minimumStock: data.minimumStock,
          expiryAlertDays: data.expiryAlertDays,
        },
      });
    }
  }, demoTransactionOptions);
  globalThis.console.log(`Demo seed ready for tenant ${ids.tenant}.`);
  globalThis.console.log(
    "Demo web users: propietario/100001, inventario/100002, vendedor/100003.",
  );
}

main()
  .catch((error) => {
    globalThis.console.error(
      "Demo seed failed.",
      error instanceof Error ? error.message : "unknown error",
    );
    globalThis.process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
