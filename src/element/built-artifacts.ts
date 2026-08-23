/**
 * Shared guard for the two built-artifact smoke tests (IIFE and ESM).
 *
 * `import.meta.glob` only matches files present on disk at request time, so
 * when dist/element hasn't been built yet (a fresh checkout, before
 * `pnpm build`) the glob is empty and the suite skips rather than failing —
 * these are build-artifact checks, not build steps.
 *
 * In CI, skipping silently would lose the only executable coverage of the
 * published bundles, so a missing artifact is a failure there instead. CI
 * builds before it tests: `pnpm install --frozen-lockfile` runs the
 * `prepare` script (`husky && pnpm run build`), and .github/workflows/ci.yml
 * runs `pnpm test` after that install.
 */
declare const __CI__: boolean;

export function requireBuiltArtifact(url: string | undefined, what: string) {
  if (url) return false;
  const message = `[smoke] dist/element ${what} not found — run \`pnpm build\` to cover the published bundle`;
  if (__CI__) throw new Error(message);
  console.warn(`${message}; skipping`);
  return true;
}
