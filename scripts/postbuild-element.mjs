// Post-build checks for the element artifacts. Fails the build on:
//  - missing artifacts
//  - `svelte/internal` source inside the ESM build (externalization failed)
//  - IIFE over the size budget
// Also copies the hand-maintained public types next to the ESM entry.
import { readFileSync, statSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const esm = resolve(root, "dist/element/index.js");
const iife = resolve(root, "dist/element/iiif-transcript-player.iife.js");
const types = resolve(root, "src/element/public-types.d.ts");
const typesOut = resolve(root, "dist/element/index.d.ts");

const IIFE_BUDGET_BYTES = 1 * 1024 * 1024; // 1 MB minified (spec: "Size budget")

const fail = (msg) => {
  console.error(`[postbuild-element] ${msg}`);
  process.exit(1);
};

for (const file of [esm, iife, types]) {
  if (!existsSync(file)) fail(`missing ${file}`);
}

const esmSource = readFileSync(esm, "utf8");
// Compiled Svelte 5 output legitimately *imports from* "svelte/internal/client"
// (and "svelte/internal/disclose-version") when externalized correctly — those
// import lines are the expected, healthy shape. What must never appear is the
// runtime's actual internal source inlined into the bundle, which would show
// up as "svelte/internal" text outside of an import/from declaration.
const nonImportLines = esmSource
  .split("\n")
  .filter((line) => !/^\s*import\b/.test(line))
  .join("\n");
if (/svelte\/internal/.test(nonImportLines)) {
  fail(
    "dist/element/index.js bundles svelte/internal — ESM externals did not match by prefix",
  );
}
if (!/from\s+["']svelte(\/|["'])/.test(esmSource)) {
  fail(
    "dist/element/index.js has no external svelte import — is it really externalized?",
  );
}

const iifeBytes = statSync(iife).size;
if (iifeBytes > IIFE_BUDGET_BYTES) {
  fail(`IIFE is ${iifeBytes} bytes, over the ${IIFE_BUDGET_BYTES}-byte budget`);
}
const iifeSource = readFileSync(iife, "utf8");
if (/^\s*import\s/m.test(iifeSource) || /export\s+\{/.test(iifeSource)) {
  fail("IIFE contains ESM syntax");
}
if (!/dashjs/.test(iifeSource)) {
  fail(
    "IIFE no longer references dashjs — the external dynamic import should survive",
  );
}

copyFileSync(types, typesOut);
console.log(
  `[postbuild-element] ok — ESM ${statSync(esm).size} B, IIFE ${iifeBytes} B (budget ${IIFE_BUDGET_BYTES} B), types copied`,
);
