import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import process from "node:process";
import { log } from "node:console";
import { fileURLToPath, URL } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const port = Number.parseInt(process.env["PORT"] ?? "5173", 10);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function resolvePath(url) {
  const pathname = new URL(url ?? "/", `http://127.0.0.1:${port}`).pathname;
  const requested =
    pathname === "/" ? join(root, "demo", "index.html") : join(root, pathname);
  const normalized = normalize(requested);
  const insideRoot = !relative(root, normalized).startsWith("..");
  return insideRoot ? normalized : null;
}

const server = createServer((request, response) => {
  void (async () => {
    const filePath = resolvePath(request.url);
    if (filePath === null) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("NOT_FILE");
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type":
          mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(
        "Demo asset not found. Run: corepack pnpm --dir apps/web build",
      );
    }
  })();
});

server.listen(port, "127.0.0.1", () => {
  log(`BodegIA MVP demo available at http://127.0.0.1:${port}`);
});
