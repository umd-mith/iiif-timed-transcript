import { describe, test, expect } from "vitest";
import { requireBuiltArtifact } from "./built-artifacts";

// The postbuild probe (scripts/postbuild-element.mjs) imports from
// "./index.js", which under moduleResolution "bundler" resolves to
// dist/element/index.d.ts — it checks the hand-maintained types against
// themselves and would still pass if a runtime re-export were dropped from
// src/element/index.ts. This test imports the built ESM for real and pins
// its runtime export names, so drift in either direction fails.
//
// Not `?url` + a bare `import(url)`: the built ESM externalizes svelte, so
// it has to go through Vite's resolution. `import.meta.glob` without `eager`
// gives a lazy, fully transformed import of the artifact.
const esmModules = import.meta.glob("../../dist/element/index.js");
const [esmPath, loadEsm] = Object.entries(esmModules)[0] ?? [];

const skip = requireBuiltArtifact(esmPath, "ESM entry (index.js)");

/**
 * Every runtime (value) export documented in src/element/public-types.d.ts.
 * Type-only exports vanish at runtime and are covered by the postbuild tsc
 * probe instead.
 */
const DOCUMENTED_VALUE_EXPORTS = [
  "DEFAULT_TAG",
  "IIIFTranscriptPlayerElement",
  "register",
  "registerTranslation",
];

describe.skipIf(skip)("<iiif-transcript-player> built ESM", () => {
  test("exports exactly the documented runtime names, with the documented shapes", async () => {
    const mod = (await loadEsm!()) as Record<string, unknown>;

    expect(Object.keys(mod).sort()).toEqual(DOCUMENTED_VALUE_EXPORTS);
    expect(typeof mod["register"]).toBe("function");
    expect(typeof mod["registerTranslation"]).toBe("function");
    expect(mod["DEFAULT_TAG"]).toBe("iiif-transcript-player");
    expect(typeof mod["IIIFTranscriptPlayerElement"]).toBe("function");
    expect(
      (mod["IIIFTranscriptPlayerElement"] as new () => unknown).prototype,
    ).toBeInstanceOf(HTMLElement);
  });
});
