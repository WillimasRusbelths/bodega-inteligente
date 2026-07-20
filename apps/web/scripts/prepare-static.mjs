import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceIndex = join(root, "demo", "index.html");
const targetIndex = join(root, "dist", "index.html");
const apiBaseUrl = process.env["VITE_API_BASE_URL"] ?? "";

function escapeForInlineScript(value) {
  return JSON.stringify(value).replaceAll("</script", "<\\/script");
}

const html = await readFile(sourceIndex, "utf8");
const staticHtml = html.replace(
  '<script type="module" src="/dist/src/demo/browser.js"></script>',
  `<script>globalThis.__BODEGIA_API_BASE_URL = ${escapeForInlineScript(apiBaseUrl)};</script>
    <script type="module" src="/src/demo/browser.js"></script>`,
);

await mkdir(dirname(targetIndex), { recursive: true });
await writeFile(targetIndex, staticHtml);
