import { describe, test, expect, afterEach, vi } from "vitest";

// The grep-based checks in scripts/postbuild-element.mjs verify the IIFE's
// *text* (no leaked ESM syntax, dashjs still referenced) but never execute
// it — the distribution mode most hosts actually use (a bare <script src>)
// had no executable coverage. This test loads the real built artifact as a
// classic script, exactly as examples/element/*.html do, and asserts it
// registers the element and produces a working shadow root.
//
// `import.meta.glob` only matches files present on disk at request time, so
// when dist/element hasn't been built yet (a fresh checkout, before
// `pnpm build`) the glob is empty and the whole suite is skipped rather than
// failing — this test is a build-artifact check, not a build step.
const iifeModules = import.meta.glob(
  "../../dist/element/iiif-transcript-player.iife.js",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const iifeUrl = Object.values(iifeModules)[0];

describe.skipIf(!iifeUrl)("<iiif-transcript-player> built IIFE", () => {
  afterEach(() => {
    document
      .querySelectorAll("iiif-transcript-player")
      .forEach((n) => n.remove());
    document
      .querySelectorAll("script[data-iife-smoke]")
      .forEach((n) => n.remove());
  });

  test("registers the element and renders an open shadow root when loaded as a classic <script>", async () => {
    const source = await (await fetch(iifeUrl!)).text();
    const script = document.createElement("script");
    script.setAttribute("data-iife-smoke", "true");
    script.textContent = source;
    document.head.appendChild(script);

    await vi.waitFor(() => {
      expect(customElements.get("iiif-transcript-player")).toBeDefined();
    });

    const el = document.createElement("iiif-transcript-player");
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(el.shadowRoot).toBeTruthy();
    });
    expect(el.shadowRoot!.mode).toBe("open");
  });
});
