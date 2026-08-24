import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { startCspServer } from "./server.mjs";

const iifePath = fileURLToPath(
  new URL("../../dist/element/iiif-transcript-player.iife.js", import.meta.url),
);

if (!existsSync(iifePath)) {
  console.error(
    "[csp-harness] dist/element/iiif-transcript-player.iife.js is missing " +
      "— run `pnpm run build:element` first.",
  );
  process.exit(1);
}

const { server, port } = await startCspServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("[page]", msg.text());
  });
  await page.goto(`http://127.0.0.1:${port}/scripts/csp-harness/page.html`);
  await page.waitForFunction(() => {
    const el = document.getElementById("p");
    return Boolean(
      el && el.shadowRoot && el.shadowRoot.querySelector(".iiif-tp"),
    );
  });

  const bg = await page.evaluate(() => {
    const el = document.getElementById("p");
    const root = el.shadowRoot.querySelector(".iiif-tp");
    return getComputedStyle(root).backgroundColor;
  });
  assert.equal(
    bg,
    "rgb(255, 255, 255)",
    `expected .iiif-tp background to apply under CSP, got "${bg}"`,
  );

  // Let the MutationObserver pass settle before checking emptiness.
  await page.waitForTimeout(200);
  const nonEmptyStyleCount = await page.evaluate(() => {
    const el = document.getElementById("p");
    return Array.from(el.shadowRoot.querySelectorAll("style")).filter(
      (n) => (n.textContent ?? "").length > 0,
    ).length;
  });
  assert.equal(
    nonEmptyStyleCount,
    0,
    `expected 0 non-empty <style> nodes in the shadow root, found ${nonEmptyStyleCount}`,
  );

  // NOT asserted to 0: the spec (2.1, "why it works under CSP") is explicit
  // that Svelte's *original* <style> insertion is expected to be blocked —
  // "reading the blocked node's textContent still works even when the style
  // itself is not applied." The browser evaluates style-src-elem
  // synchronously as part of appendChild/textContent-set, before any JS
  // (including an immediate same-tick hoist) can run — so a violation report
  // for the original node is an inherent, harmless byproduct of this
  // recovery strategy, not a regression. What the pinned tests actually
  // require (spec 2.1(a)/(b), verified above) is that the computed style
  // still applies via the adopted CSSOM sheet, and that no non-empty
  // <style> node is left behind — both already asserted.
  const cspViolationCount = await page.evaluate(
    () => window.__cspViolations.length,
  );
  console.log(
    `[csp-harness] ${cspViolationCount} style-src violation report(s) for Svelte's original <style> insertion (expected — see comment above)`,
  );

  console.log("[csp-harness] PASS");
} finally {
  await browser.close();
  server.close();
}
