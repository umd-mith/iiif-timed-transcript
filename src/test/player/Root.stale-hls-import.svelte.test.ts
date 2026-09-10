import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestRootContextCapture from "./TestRootContextCapture.svelte";
import type { PlayerContext } from "../../lib/player/context";
import { mockFetchManifest, buildStaleHlsManifest } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";

// Regression test for the loadGeneration async-race guard itself
// (resolveHlsAdapter's `generation !== loadGeneration` check in Root.svelte).
// Separate file from Root.svelte.test.ts because it needs to module-mock
// "hls.js" with a controlled, deferred promise so the import can be held
// genuinely pending while a canvas switch fires — vi.mock is hoisted and
// applies for the whole file, so this scenario gets its own file the same
// way Root.missing-hls.svelte.test.ts does.
const { hlsImport } = vi.hoisted(() => {
  let resolve!: (v: { default: unknown }) => void;
  const promise = new Promise<{ default: unknown }>((r) => {
    resolve = r;
  });
  return { hlsImport: { promise, resolve } };
});
vi.mock("hls.js", () => hlsImport.promise);

describe("Root stale HLS import (loadGeneration guard)", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    manifestCache.clear();
  });

  test("a stale HLS import resolved after a canvas switch is dropped, not attached", async () => {
    // This Chromium build under Playwright reports canPlayType("maybe") for
    // HLS mime types (see hlsUtils.test.ts), so force native support off to
    // deterministically reach the hls-js resolver this test targets.
    const canPlayTypeSpy = vi
      .spyOn(HTMLMediaElement.prototype, "canPlayType")
      .mockReturnValue("");

    try {
      // Canvas 0 is HLS, canvas 1 is plain audio (from MANIFEST_MULTI_CANVAS).
      const url = "https://example.com/stale-hls-deferred.json";
      const manifest = buildStaleHlsManifest(url);
      mockFetchManifest(manifest);

      let capturedCtx: PlayerContext | null = null;
      render(TestRootContextCapture, {
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaStrategy).toBe("hls-js");
      });

      // Switch canvases while the hls.js import is still genuinely
      // pending — this is the in-flight race the loadGeneration guard
      // exists for.
      capturedCtx!.actions.switchCanvas(1);
      flushSync();
      expect(capturedCtx!.canvasIndex).toBe(1);
      expect(capturedCtx!.mediaStrategy).toBe("native");

      // Now let the stale import resolve with a working constructor. If the
      // generation guard were missing, this would attach an adapter for the
      // canvas already navigated away from.
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
      // The mocked hls.js module resolves through a real dynamic-import
      // pipeline (not just a microtask hop), so give it a real macrotask
      // tick before asserting — matching the wait used by the sibling
      // performCanvasSwitch regression test in Root.svelte.test.ts.
      await new Promise((r) => setTimeout(r, 100));
      flushSync();

      expect(capturedCtx!.canvasIndex).toBe(1);
      expect(capturedCtx!.mediaStrategy).toBe("native");
      expect(capturedCtx!.hlsAdapter).toBeNull();
      expect(capturedCtx!.state.error).toBeNull();
    } finally {
      canPlayTypeSpy.mockRestore();
    }
  });
});
