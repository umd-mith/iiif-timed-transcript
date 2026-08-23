// Post-build checks for the element artifacts. Fails the build on:
//  - missing artifacts
//  - `svelte/internal` source inside the ESM build (externalization failed)
//  - IIFE over the size budget
// Also copies the two hand-maintained public type files into dist/element:
// public-types.d.ts (the ESM entry's types) and iife-global.d.ts (the IIFE's,
// which declare a window global and no module exports).
import {
  readFileSync,
  statSync,
  copyFileSync,
  existsSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// fileURLToPath, not `.pathname`: the latter keeps percent-encoding (a repo
// checked out under a path with a space) and yields "/C:/…" on Windows.
const root = fileURLToPath(new URL("..", import.meta.url));
const esm = resolve(root, "dist/element/index.js");
const iife = resolve(root, "dist/element/iiif-transcript-player.iife.js");
const types = resolve(root, "src/element/public-types.d.ts");
const typesOut = resolve(root, "dist/element/index.d.ts");
const iifeTypes = resolve(root, "src/element/iife-global.d.ts");
const iifeTypesOut = resolve(
  root,
  "dist/element/iiif-transcript-player.iife.d.ts",
);

const IIFE_BUDGET_BYTES = 1 * 1024 * 1024; // 1 MB minified (spec: "Size budget")

const fail = (msg) => {
  console.error(`[postbuild-element] ${msg}`);
  process.exit(1);
};

for (const file of [esm, iife, types, iifeTypes]) {
  if (!existsSync(file)) fail(`missing ${file}`);
}

const esmSource = readFileSync(esm, "utf8");
// Compiled Svelte 5 output legitimately *imports from* "svelte/internal/client"
// (and "svelte/internal/disclose-version") when externalized correctly — those
// import lines are the expected, healthy shape. What must never appear is the
// runtime's actual internal source inlined into the bundle, which would show
// up as "svelte/internal" text outside of an import/from declaration.
// Both `import … from "svelte/…"` and `export … from "svelte/…"` are healthy
// externalized-module lines, so filter on the `from "svelte/` clause rather
// than on the leading keyword — a re-export line would otherwise be read as
// inlined runtime source.
const nonImportLines = esmSource
  .split("\n")
  .filter(
    (line) => !/^\s*import\b/.test(line) && !/\bfrom\s+["']svelte\//.test(line),
  )
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
// A text-based ESM-syntax grep used to run here (`^import`/`export {`,
// anchored to line start). Two problems killed it: esbuild minifies the
// IIFE into a handful of very long lines, so a `^`-anchored check never
// sees a leaked import/export sitting mid-line; and un-anchoring it turns
// up false positives from ordinary bundled *text* (e.g. hls.js has a
// template-literal error message containing the literal substring
// `} from "`). Minified JS cannot be reliably classified as "leaked ESM
// syntax" vs. "ordinary string content" with a regex. The real guarantee
// is executable: element-iife-smoke.test.ts loads this exact file as a
// classic <script> in a real browser and asserts the element registers —
// which a build that failed to externalize/bundle correctly would fail.
if (!/dashjs/.test(iifeSource)) {
  fail(
    "IIFE no longer references dashjs — the external dynamic import should survive",
  );
}

copyFileSync(types, typesOut);
copyFileSync(iifeTypes, iifeTypesOut);

// public-types.d.ts is hand-maintained and, unlike src/**, is never compiled
// by `pnpm typecheck` (tsconfig.json excludes dist and sets skipLibCheck).
// Compile the *shipped* copy for real so a drift between it and the code it
// describes (a self-import that does not resolve, a syntax error) fails the
// build instead of shipping silently. moduleResolution "bundler" + module
// "esnext" is required (over tsc's classic default) for the self-import of
// "@umd-mith/svelte-iiif-transcript-player" inside public-types.d.ts to
// resolve via the package's own "exports" map.
//
// Compiling index.d.ts *on its own* only checks that it is internally
// well-formed — it does NOT catch "forgot to re-export a type", since an
// unused import is not a type error. So this also compiles a probe file
// that imports every documented named export (value and type) from
// "./index.js" and uses each one, the way a real consumer would — that
// fails to compile if a re-export is missing or a type mismatches.
// Written OUTSIDE dist/ — dist is the publishable tree and must never hold a
// build-time scratch file, however briefly.
const probeDir = resolve(root, ".tmp");
mkdirSync(probeDir, { recursive: true });
const probe = resolve(probeDir, "postbuild-probe.ts");
const probeSource = `
import { register, DEFAULT_TAG, IIIFTranscriptPlayerElement } from "../dist/element/index.js";
import type {
  Annotation,
  CanvasInfo,
  PlayerRef,
  ElementErrorSource,
  PlayerErrorDetail,
  PlayerRefAvailableDetail,
  CanvasChangeDetail,
  ErrorCallback,
  IIIFTranscriptPlayerElementEventMap,
} from "../dist/element/index.js";

declare const annotation: Annotation;
declare const eventMap: IIIFTranscriptPlayerElementEventMap;
declare const canvas: CanvasInfo;
declare const playerRef: PlayerRef;
declare const source: ElementErrorSource;
declare const errorDetail: PlayerErrorDetail;
declare const refAvailable: PlayerRefAvailableDetail;
declare const canvasChange: CanvasChangeDetail;
declare const errorCallback: ErrorCallback;
void [
  register,
  DEFAULT_TAG,
  IIIFTranscriptPlayerElement,
  annotation,
  canvas,
  playerRef,
  source,
  errorDetail,
  refAvailable,
  canvasChange,
  errorCallback,
  eventMap,
];
`;
writeFileSync(probe, probeSource);

const tsc = resolve(root, "node_modules/.bin/tsc");
const tscArgs = [
  "--noEmit",
  "--skipLibCheck",
  "false",
  "--strict",
  "--moduleResolution",
  "bundler",
  "--module",
  "esnext",
  "--target",
  "es2022",
];
try {
  execFileSync(tsc, [...tscArgs, typesOut], { cwd: root, stdio: "pipe" });
  // The IIFE's own types declare a global and nothing else; compiling them
  // catches a drift between that declaration and the entry's real exports.
  execFileSync(tsc, [...tscArgs, iifeTypesOut], { cwd: root, stdio: "pipe" });
  execFileSync(tsc, [...tscArgs, probe], { cwd: root, stdio: "pipe" });
  rmSync(probeDir, { force: true, recursive: true });
} catch (err) {
  // `fail()` calls process.exit(), which would skip a `finally` cleanup —
  // remove the probe file before it, not after.
  rmSync(probeDir, { force: true, recursive: true });
  fail(
    `dist/element types do not compile (standalone or against a real import of their exports):\n${err.stdout?.toString() ?? err.message}`,
  );
}

console.log(
  `[postbuild-element] ok — ESM ${statSync(esm).size} B, IIFE ${iifeBytes} B (budget ${IIFE_BUDGET_BYTES} B), types copied`,
);
