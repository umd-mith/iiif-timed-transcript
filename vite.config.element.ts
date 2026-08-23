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

// The build itself (two modes) is added in a later task. Until then the
// default export is a placeholder that refuses to build.
export default defineConfig(() => {
  throw new Error(
    "vite.config.element.ts: build config not yet implemented (see plan Task 9)",
  );
});
