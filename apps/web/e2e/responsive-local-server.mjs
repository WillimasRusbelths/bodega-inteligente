import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

// Reuse Vite installed with Vitest; no install or remote service is needed.
const require = createRequire(import.meta.url);
const testRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(
  pathToFileURL(testRequire.resolve("vite")).href
);
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  plugins: [
    {
      name: "responsive-local-entry",
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url !== "/") {
            next();
            return;
          }
          void readFile(new URL("../demo/index.html", import.meta.url), "utf8")
            .then((html) =>
              vite.transformIndexHtml(
                "/",
                html.replace(
                  "/dist/src/demo/browser.js",
                  "/src/demo/browser.ts",
                ),
              ),
            )
            .then((html) => {
              response.setHeader("Content-Type", "text/html; charset=utf-8");
              response.end(html);
            })
            .catch(next);
        });
      },
    },
  ],
});
await server.listen();
server.printUrls();
