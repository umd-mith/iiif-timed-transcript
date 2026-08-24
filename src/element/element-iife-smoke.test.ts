import { describe, test, expect, afterEach, vi } from "vitest";
import { requireBuiltArtifact } from "./built-artifacts";

// scripts/postbuild-element.mjs checks the IIFE's *text* (size budget,
// dashjs still referenced) but never executes it — the distribution mode
// most hosts actually use (a bare <script src>) had no executable coverage.
// This test loads the real built artifact as a classic script, exactly as
// examples/element/*.html do, and asserts it registers the element and
// produces a working shadow root.
const iifeModules = import.meta.glob(
  "../../dist/element/iiif-transcript-player.iife.js",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const iifeUrl = Object.values(iifeModules)[0];

const skip = requireBuiltArtifact(iifeUrl, "IIFE bundle");

describe.skipIf(skip)("<iiif-transcript-player> built IIFE", () => {
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

    // The documented global surface (what ./element/iife's types declare):
    // Vite's `build.lib.name` turns the entry's exports into properties of
    // window.IIIFTranscriptPlayer, and there are no module exports at all.
    const globalApi = (
      window as unknown as {
        IIIFTranscriptPlayer?: Record<string, unknown>;
      }
    ).IIIFTranscriptPlayer;
    expect(typeof globalApi?.["register"]).toBe("function");
    expect(globalApi?.["DEFAULT_TAG"]).toBe("iiif-transcript-player");
    expect(typeof globalApi?.["IIIFTranscriptPlayerElement"]).toBe("function");
    expect(typeof globalApi?.["registerTranslation"]).toBe("function");

    const el = document.createElement("iiif-transcript-player");
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(el.shadowRoot).toBeTruthy();
    });
    expect(el.shadowRoot!.mode).toBe("open");
  });
});
