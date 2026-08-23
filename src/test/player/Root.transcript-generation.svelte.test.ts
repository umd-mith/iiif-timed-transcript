import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushSync } from "svelte";
import TestRootAnnotationsWrapper from "./TestRootAnnotationsWrapper.svelte";
import type { PlayerContext } from "../../lib/player/context";
import { mockFetchManifest, buildStaleHlsManifest } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";

// Regression test: the annotations-prop mode flip (array -> "auto") must not
// invalidate an in-flight media-adapter import. Transcript re-derivation has
// its own generation counter (transcriptGeneration); loadGeneration is bumped
// only by loadCanvas. Sharing one counter left mediaStrategy set to "hls-js"
// with hlsAdapter null and no error reported.
//
// Same shape as Root.stale-hls-import.svelte.test.ts: vi.mock is hoisted and
// file-wide, so the deferred "hls.js" module gets its own file.
const { hlsImport } = vi.hoisted(() => {
  let resolve!: (v: { default: unknown }) => void;
  const promise = new Promise<{ default: unknown }>((r) => {
    resolve = r;
  });
  return { hlsImport: { promise, resolve } };
});
vi.mock("hls.js", () => hlsImport.promise);

describe("Root transcript generation vs. in-flight adapter import", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    document.body.removeChild(target);
    manifestCache.clear();
  });

  test('flipping annotations to "auto" mid-import does not drop the HLS adapter', async () => {
    // This Chromium build under Playwright reports canPlayType("maybe") for
    // HLS mime types, so force native support off to reach the hls-js
    // resolver this test targets.
    const canPlayTypeSpy = vi
      .spyOn(HTMLMediaElement.prototype, "canPlayType")
      .mockReturnValue("");

    try {
      const url = "https://example.com/transcript-generation-hls.json";
      mockFetchManifest(buildStaleHlsManifest(url));

      let capturedCtx: PlayerContext | null = null;
      const wrapper = mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          annotations: [],
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaStrategy).toBe("hls-js");
      });

      // Flip the annotations mode while the hls.js import is still genuinely
      // pending. This re-derives the transcript; it must not invalidate the
      // adapter import.
      wrapper.setAnnotations("auto");
      flushSync();

      const MockHls = Object.assign(
        function () {
          return {
            loadSource: vi.fn(),
            attachMedia: vi.fn(),
            destroy: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
          };
        },
        {
          isSupported: () => true,
          Events: {
            MANIFEST_PARSED: "hlsManifestParsed",
            ERROR: "hlsError",
          },
        },
      );
      hlsImport.resolve({ default: MockHls });
      await new Promise((r) => setTimeout(r, 100));
      flushSync();

      expect(capturedCtx!.mediaStrategy).toBe("hls-js");
      expect(capturedCtx!.hlsAdapter).not.toBeNull();
      expect(capturedCtx!.state.error).toBeNull();
    } finally {
      canPlayTypeSpy.mockRestore();
    }
  });
});
