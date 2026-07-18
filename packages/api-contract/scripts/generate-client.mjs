import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import { parse } from "yaml";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const sourcePath = resolve(
  repositoryRoot,
  "specs/001-multi-tenant-access/contracts/openapi.yaml",
);
const outputDirectory = resolve(
  repositoryRoot,
  "packages/api-contract/src/generated",
);
const snapshotPath = resolve(outputDirectory, "schema.snapshot.json");
const clientPath = resolve(outputDirectory, "index.ts");

const allowedOperationIds = new Set([
  "createTenantWithFirstOwner",
  "getTechnicalTenantSummary",
  "changeTenantStatus",
  "listCurrentTenantMembers",
  "createMembership",
  "getCurrentTenantMember",
  "issueActivationChallenge",
  "replaceMembershipRoles",
  "changeMembershipStatus",
  "listMemberDevices",
  "revokeMemberDevice",
  "activateDeviceProfile",
  "setupPin",
  "unlockWithPin",
  "rotateRefreshToken",
  "logoutCurrentSession",
  "getMyIdentity",
  "listMyActiveMemberships",
  "selectActiveTenant",
  "listMyDevices",
  "revokeMyDevice",
  "listCurrentTenantAuditEvents",
]);
const httpMethods = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`[api-contract] ${message}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function filterPaths(sourcePaths) {
  const filtered = {};
  for (const [path, item] of Object.entries(sourcePaths ?? {})) {
    const selected = {};
    if (item.parameters !== undefined) {
      selected.parameters = clone(item.parameters);
    }
    for (const [key, operation] of Object.entries(item)) {
      if (
        httpMethods.has(key) &&
        allowedOperationIds.has(operation.operationId)
      ) {
        selected[key] = clone(operation);
      }
    }
    if (Object.keys(selected).some((key) => httpMethods.has(key))) {
      filtered[path] = selected;
    }
  }
  return filtered;
}

function componentReference(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^#\/components\/([^/]+)\/([^/]+)$/u);
  return match === null ? null : { group: match[1], name: match[2] };
}

function collectComponents(document, paths) {
  const selected = {};
  const visited = new Set();

  function walk(value) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;

    const reference = componentReference(value.$ref);
    if (reference !== null) {
      const key = `${reference.group}/${reference.name}`;
      if (!visited.has(key)) {
        visited.add(key);
        const source = document.components?.[reference.group]?.[reference.name];
        invariant(
          source !== undefined,
          `Unresolved component reference ${value.$ref}.`,
        );
        selected[reference.group] ??= {};
        selected[reference.group][reference.name] = clone(source);
        walk(source);
      }
    }
    for (const nested of Object.values(value)) walk(nested);
  }

  walk(paths);
  return selected;
}

function requiredFields(document, schemaName) {
  const schema = document.components?.schemas?.[schemaName];
  invariant(schema !== undefined, `Missing ${schemaName}.`);
  return new Set(schema.required ?? []);
}

function requireFields(document, schemaName, fields) {
  const required = requiredFields(document, schemaName);
  for (const field of fields) {
    invariant(required.has(field), `${schemaName}.${field} must be required.`);
  }
}

const source = parse(await readFile(sourcePath, "utf8"));
const paths = filterPaths(source.paths);
const components = collectComponents(source, paths);
const mvpDocument = {
  openapi: source.openapi,
  info: {
    ...clone(source.info),
    title: `${source.info.title} - MVP client subset`,
  },
  servers: clone(source.servers ?? []),
  paths,
  components,
};

const generatedOperations = new Set();
for (const item of Object.values(paths)) {
  for (const [key, operation] of Object.entries(item)) {
    if (httpMethods.has(key)) generatedOperations.add(operation.operationId);
  }
}
invariant(
  generatedOperations.size === allowedOperationIds.size &&
    [...allowedOperationIds].every((operation) =>
      generatedOperations.has(operation),
    ),
  "The generated MVP operation set does not match its allowlist.",
);

requireFields(mvpDocument, "ActivationChallengeIssueResponse", [
  "qrSecret",
  "qrPayload",
  "manualCode",
  "expiresAt",
]);
requireFields(mvpDocument, "ActivationConsumeResponse", [
  "deviceProfileId",
  "pinSetupToken",
  "expiresAt",
]);
requireFields(mvpDocument, "SessionCreationResponse", [
  "accessToken",
  "refreshToken",
  "absoluteExpiresAt",
]);
requireFields(mvpDocument, "RefreshRotationResponse", [
  "accessToken",
  "refreshToken",
  "absoluteExpiresAt",
]);
requireFields(mvpDocument, "TenantSelectionResponse", [
  "accessToken",
  "activeTenant",
  "contextVersion",
]);
invariant(
  mvpDocument.components.schemas.TenantSelectionResponse.properties
    .refreshToken === undefined,
  "TenantSelectionResponse must not expose refreshToken.",
);

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  snapshotPath,
  `${JSON.stringify(mvpDocument, null, 2)}\n`,
  "utf8",
);
const ast = await openapiTS(mvpDocument, {
  alphabetize: true,
  exportType: true,
  immutable: true,
  silent: true,
});
await writeFile(clientPath, `${COMMENT_HEADER}${astToString(ast)}`, "utf8");

process.stdout.write(
  `Generated ${generatedOperations.size} MVP operations from ${sourcePath}.\n`,
);
