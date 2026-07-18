import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 3000;

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  body: Readonly<Record<string, unknown>>,
): void {
  const payload = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(payload));
  response.end(payload);
}

function correlationId(request: IncomingMessage): string {
  const candidate = request.headers["x-correlation-id"];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : randomUUID();
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.length === 0) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

/**
 * Minimal test/performance HTTP boundary. Domain endpoints are intentionally
 * not mounted here; they belong to their approved functional tasks.
 */
export function createApiServer() {
  return createServer((request, response) => {
    request.resume();
    const id = correlationId(request);

    if (request.method === "GET" && request.url === "/health") {
      jsonResponse(response, 200, {
        status: "ok",
        service: "api",
        correlationId: id,
      });
      return;
    }

    jsonResponse(response, 404, {
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Resource not found",
        correlationId: id,
      },
    });
  });
}

function start(): void {
  const server = createApiServer();
  const port = parsePort(process.env["PORT"]);
  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`API test server listening on port ${port}\n`);
  });

  const shutdown = (signal: string): void => {
    server.close(() => {
      process.stdout.write(`API test server stopped (${signal})\n`);
      process.exit(0);
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) start();
