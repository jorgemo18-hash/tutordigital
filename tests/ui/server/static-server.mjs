// Servidor estático mínimo para servir el repo durante los tests de UI —
// sin backend real, sin dependencias externas (solo Node core). Arrancado
// por Playwright vía `webServer` en playwright.config.mjs.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function createStaticServer(rootDir = REPO_ROOT) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      const filePath = join(rootDir, safePath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const info = await stat(filePath).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      const body = await readFile(filePath);
      const contentType = MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(`Server error: ${err.message}`);
    }
  });
}

// Permite ejecutarlo directo: `node tests/ui/server/static-server.mjs [puerto]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || process.env.UI_TEST_PORT || 8934);
  createStaticServer().listen(port, () => {
    console.log(`[tests/ui] static server on http://localhost:${port}`);
  });
}
