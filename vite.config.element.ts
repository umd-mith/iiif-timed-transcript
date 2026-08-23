import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";

type Pkg = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as Pkg;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Externals for the ESM element build, matched by *prefix*: compiled Svelte
 * components import `svelte/internal/client`, not bare `svelte`, so an exact
 * string list would bundle the runtime. Derived from package.json so it
 * cannot drift from `dependencies` / `peerDependencies`.
 */
export const esmExternals: RegExp[] = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
].map((name) => new RegExp(`^${escapeRegExp(name)}(\\/|$)`));

/** Only `src/element/*.svelte` compiles in custom-element mode. */
export function isElementSource(filename: string): boolean {
  return /[\\/]src[\\/]element[\\/][^\\/]+\.svelte$/.test(filename);
}

/**
 * The svelte plugin instance shared by the element build and the `element`
 * Vitest project: custom-element mode for the wrapper only, and no CSS
 * extraction (styles must be injected into the shadow root).
 */
export function elementSveltePlugin() {
  return svelte({
    emitCss: false,
    dynamicCompileOptions: ({ filename }) =>
      isElementSource(filename) ? { customElement: true } : undefined,
  });
}

/**
 * One config, two invocations (Rollup's `external` is per build, so a single
 * build cannot emit an IIFE with hls.js bundled AND an ESM file with hls.js
 * external):
 *
 *   vite build --config vite.config.element.ts --mode element-iife
 *   vite build --config vite.config.element.ts --mode element-esm
 *
 * Both write into dist/element without emptying it (svelte-package owns the
 * rest of dist/ and runs first).
 */
export default defineConfig(({ mode }) => {
  if (mode !== "element-iife" && mode !== "element-esm") {
    throw new Error(
      `vite.config.element.ts: unknown mode "${mode}" — use --mode element-iife or --mode element-esm`,
    );
  }
  const iife = mode === "element-iife";

  return {
    plugins: [elementSveltePlugin()],
    build: {
      outDir: "dist/element",
      emptyOutDir: false,
      target: "es2022",
      sourcemap: true,
      minify: iife ? "esbuild" : false,
      lib: iife
        ? {
            entry: "src/element/iife.ts",
            formats: ["iife"],
            name: "IIIFTranscriptPlayer",
            fileName: () => "iiif-transcript-player.iife.js",
          }
        : {
            entry: "src/element/index.ts",
            formats: ["es"],
            fileName: () => "index.js",
          },
      rollupOptions: {
        // IIFE: bundle everything (Svelte, hls.js, media-captions, zod, …)
        // except dashjs — its dynamic import survives as a bare specifier
        // that fails at runtime and surfaces as a player error (no DASH in
        // the IIFE, documented). ESM: externalize deps + peers by prefix.
        external: iife ? [/^dashjs(\/|$)/] : esmExternals,
        output: iife ? { inlineDynamicImports: true } : {},
      },
    },
  };
});
