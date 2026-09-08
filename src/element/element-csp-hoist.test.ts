import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { register } from "./register";
import {
  mountElement,
  shadow,
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
  MANIFEST_WITH_VTT_CAPTIONS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import { vi } from "vitest";

const MANIFEST_STUB = withStubMedia(MANIFEST_WITH_EMBEDDED_TRANSCRIPT);
// MANIFEST_WITH_EMBEDDED_TRANSCRIPT's painting body is `Sound` (audio-only),
// so it never mounts a <video> element — needed below to exercise the
// video-scoped width rule. MANIFEST_WITH_VTT_CAPTIONS's painting body is
// `Video`, matching the existing withStubMedia(MANIFEST_WITH_VTT_CAPTIONS)
// pattern used elsewhere in this test project (e.g. element-canvas.test.ts).
const MANIFEST_VIDEO_STUB = withStubMedia(MANIFEST_WITH_VTT_CAPTIONS);

describe("<iiif-transcript-player> CSP style hoist", () => {
  beforeAll(() => {
    register();
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
  });

  test("Svelte-injected <style> nodes are hoisted to adoptedStyleSheets and emptied in place", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const url = "https://example.com/csp-hoist.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, ".iiif-tp");
    await vi.waitFor(() => {
      const nonEmpty = Array.from(shadow(el).querySelectorAll("style")).filter(
        (n) => (n.textContent ?? "").length > 0,
      );
      expect(nonEmpty).toHaveLength(0);
    });
    expect(shadow(el).querySelectorAll("style").length).toBeGreaterThan(0);
    expect(el.shadowRoot!.adoptedStyleSheets.length).toBeGreaterThan(0);
  });

  test("no inline style= attribute remains on the video; a hoisted rule sets its width", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const url = "https://example.com/csp-hoist-inline.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_VIDEO_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });
    const video = await untilShadow(el, "video");
    expect(video.getAttribute("style")).toBeNull();
    const hasWidthRule = el.shadowRoot!.adoptedStyleSheets.some((sheet) =>
      Array.from(sheet.cssRules).some(
        (rule) =>
          rule.cssText.includes("video") &&
          rule.cssText.includes("width: 100%"),
      ),
    );
    // If this fails, log the actual cssRules to check the exact
    // serialization Chromium uses for the scoped `video { width: 100%; }`
    // rule added to Viewer.svelte in Step 7, then adjust the substring.
    expect(hasWidthRule).toBe(true);
  });
});
