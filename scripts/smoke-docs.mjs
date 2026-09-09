// Smoke-checks the built docs site: every page must return 200 and throw no
// uncaught JS error. Serves docs/dist through `astro preview` so the Astro
// `base` path is honored. Run AFTER building the docs (docs/dist must exist).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const BASE = "/iiif-timed-transcript"; // keep in sync with docs/astro.config.mjs
const PORT = 4321;
const ORIGIN = `http://localhost:${PORT}`;
const DIST = "docs/dist";

if (!existsSync(DIST)) {
  console.error(`[smoke] ${DIST} not found — build the docs first.`);
  process.exit(1);
}

// Collect built routes from every index.html / *.html under docs/dist.
function collectRoutes(dir) {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...collectRoutes(full));
    } else if (entry.name.endsWith(".html")) {
      const rel = relative(DIST, full)
        .replace(/index\.html$/, "")
        .replace(/\.html$/, "");
      const path = "/" + rel.replace(/\/$/, "");
      routes.push(path === "/" ? "" : path);
    }
  }
  return routes;
}

// Every docs page mounts an IIIFPlayer, so each must render a media element
// (audio/video) once hydrated — that proves the player actually came up, not
// just the page shell.
//
// Routes with a known, tracked breakage are exempt from *failing* the build,
// but every run logs a loud SKIP so the breakage stays visible and isn't
// forgotten. Remove an entry once its underlying issue is fixed.
const KNOWN_BROKEN_ROUTES = new Map(); // currently none

const routes = [...new Set(collectRoutes(DIST))].sort();
if (routes.length === 0) {
  console.error("[smoke] no built pages found.");
  process.exit(1);
}
console.log(`[smoke] ${routes.length} route(s) to check.`);

// Start `astro preview` for the docs package (honors base + serves docs/dist).
const preview = spawn(
  "pnpm",
  [
    "--filter",
    "iiif-timed-transcript-docs",
    "exec",
    "astro",
    "preview",
    "--port",
    String(PORT),
  ],
  { stdio: "inherit" },
);

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return; // server is up
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server did not start within ${timeoutMs}ms`);
}

let failures = [];
try {
  await waitForServer(`${ORIGIN}${BASE}/`);
  const browser = await chromium.launch();
  for (const route of routes) {
    const url = `${ORIGIN}${BASE}${route}/`.replace(/\/+$/, "/");
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    // Track 5xx responses from *other* origins (the IIIF manifest, media, or
    // caption servers a demo streams from). A demo that points at a live third
    // party — e.g. the Avalon page loads a production Indiana University
    // manifest — can't mount its player when that server is down, and that is
    // an upstream outage, not a regression in this repo. We collect these so a
    // "no player mounted" result caused solely by an upstream 5xx can SKIP
    // instead of failing (and blocking) the build.
    const upstreamServerErrors = [];
    page.on("response", (res) => {
      const url = res.url();
      if (res.status() >= 500 && !url.startsWith(ORIGIN)) {
        upstreamServerErrors.push(`${res.status()} ${url}`);
      }
    });
    const response = await page.goto(url, {
      waitUntil: "load",
      timeout: 20000,
    });
    // Settle: this app fetches its IIIF manifest and mounts components AFTER
    // `load`, so give async crashes a window to surface as `pageerror` before
    // we snapshot. `networkidle` may never arrive (media streams / polling),
    // so cap it and move on.
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});
    const status = response ? response.status() : 0;
    const bodyLen = (await page.textContent("body"))?.trim().length ?? 0;
    // Did the player mount? A hydrated IIIFPlayer.Viewer renders <audio>/<video>
    // only after the manifest is fetched and parsed — so this asserts the player
    // came up, not just that the doc shell rendered.
    const mediaCount = await page.locator("audio, video").count();
    const ok =
      status === 200 && errors.length === 0 && bodyLen > 0 && mediaCount > 0;
    // The page itself is healthy (served, no JS error, shell rendered) and the
    // *only* reason no player mounted is that an upstream media source returned
    // a 5xx. That's a third-party outage, not a regression here — skip it so a
    // dependency being down can't block our deploy, but log loudly so it stays
    // visible.
    const upstreamDown =
      !ok &&
      status === 200 &&
      errors.length === 0 &&
      bodyLen > 0 &&
      mediaCount === 0 &&
      upstreamServerErrors.length > 0;
    const knownBroken = KNOWN_BROKEN_ROUTES.get(route);
    if (ok) {
      console.log(`[smoke] PASS ${status} ${url}`);
    } else if (upstreamDown) {
      console.log(
        `[smoke] SKIP ${status} ${url} — upstream media source unavailable: ${upstreamServerErrors[0]}`,
      );
    } else if (knownBroken) {
      console.log(
        `[smoke] SKIP ${status} ${url} — known broken: ${knownBroken}`,
      );
    } else {
      const why = mediaCount === 0 ? " (no player mounted)" : "";
      console.log(`[smoke] FAIL ${status} ${url}${why}`);
      failures.push({ url, status, errors, bodyLen, mediaCount });
    }
    await page.close();
  }
  await browser.close();
} finally {
  preview.kill("SIGTERM");
}

if (failures.length) {
  console.error(`[smoke] ${failures.length} page(s) failed:`);
  for (const f of failures) console.error(JSON.stringify(f, null, 2));
  process.exit(1);
}
console.log("[smoke] all pages passed.");
