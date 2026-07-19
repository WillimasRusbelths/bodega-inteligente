import type { AlertRule } from "@prisma/client";
import type { PrismaModule } from "../../../infrastructure/prisma/prisma.module.js";
import {
  isTenantContext,
  type TenantContext,
} from "../../access/context/tenant-context.js";
import { TenantSessionInvalidError } from "../../access/guards/authorization-errors.js";

export class AlertRuleRepository {
  public constructor(private readonly prisma: PrismaModule) {}

  public findByProduct(
    context: TenantContext,
    productId: string,
  ): Promise<AlertRule | null> {
    if (!isTenantContext(context)) throw new TenantSessionInvalidError();
    return this.prisma.execute((client) =>
      client.alertRule.findUnique({
        where: {
          tenantId_productId: { tenantId: context.tenantId, productId },
        },
      }),
    );
  }
}
