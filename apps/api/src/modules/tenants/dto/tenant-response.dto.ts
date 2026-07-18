type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

export function serializeTenantBootstrap(value: unknown): unknown {
  const source = record(value);
  const tenant = record(source?.["tenant"]);
  const firstOwner = record(source?.["firstOwner"]);
  if (tenant === undefined || firstOwner === undefined) return {};
  return {
    tenant: {
      id: tenant["id"],
      name: tenant["name"],
      status: tenant["status"],
      version: tenant["version"],
    },
    firstOwner: {
      id: firstOwner["id"],
      tenantId: firstOwner["tenantId"],
      userId: firstOwner["userId"],
      displayName: firstOwner["displayName"],
      status: firstOwner["status"],
      roles: firstOwner["roles"],
      version: firstOwner["version"],
    },
  };
}
