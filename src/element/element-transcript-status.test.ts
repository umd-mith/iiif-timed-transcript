import { describe, test, expect, vi, beforeAll, afterEach } from "vitest";
import { register, DEFAULT_TAG } from "./register";
import {
  shadow,
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  deferred,
  MANIFEST_WITH_VTT_CAPTIONS,
} from "../test/player/test-fixtures";
import type { FetchRoute } from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

// File-local copy whose media is a `data:` stub (see withStubMedia): no
// request leaves the browser for the media element, so a media-tier error
// can't race the transcript-tier assertions below.
const MANIFEST_VTT_UNPLAYABLE_MEDIA = withStubMedia(MANIFEST_WITH_VTT_CAPTIONS);

describe("<iiif-transcript-player> transcript status announcements (A5)", () => {
  beforeAll(() => {
    register();
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
  });

  test("the live region is mounted before the VTT fetch resolves, and announces failure once it 404s, with the panel staying mounted", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    const url = "https://example.com/el-a11y-vtt-status.json";
    const pending = deferred<FetchRoute>();
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_VTT_UNPLAYABLE_MEDIA, id: url } },
      "https://example.com/captions-fr.vtt": { promise: pending.promise },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement;
    el.setAttribute("manifest-url", url);
    document.body.appendChild(el);

    await untilShadow(el, ".transcript-panel");
    const liveRegionWhileLoading = shadow(el).querySelector(".sr-only");
    expect(liveRegionWhileLoading).not.toBeNull();
    expect(liveRegionWhileLoading?.textContent).toBe("");

    pending.resolve({ status: 404 });

    await vi.waitFor(() => {
      expect(shadow(el).querySelector(".sr-only")?.textContent).toContain(
        "Transcript unavailable",
      );
    });
    // The wrapper mount-condition fix (IIIFTranscriptPlayerElement.svelte:384)
    // keeps the panel — and its live region — mounted on transcript error.
    expect(shadow(el).querySelector(".transcript-panel")).not.toBeNull();
  });
});
