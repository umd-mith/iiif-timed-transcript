import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/**
 * Minimal static file server enforcing a strict CSP on every response —
 * `style-src 'self'`, no `'unsafe-inline'` — so 2.1's constructable-
 * stylesheet hoist is exercised against real browser CSP enforcement, not
 * a simulated one. `npx serve` / `python3 -m http.server` (used for the
 * manual examples/element/ smoke pages) cannot set response headers, so
 * this exists purely to add the one header those tools can't.
 */
export function startCspServer(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const filePath = normalize(join(repoRoot, relativePath || "index.html"));
      if (!filePath.startsWith(repoRoot)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
        "Content-Security-Policy": "style-src 'self'",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address ? address.port : port;
      resolve({ server, port: actualPort });
    });
  });
}
