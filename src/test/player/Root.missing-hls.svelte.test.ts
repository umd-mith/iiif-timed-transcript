import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "vitest-browser-svelte";
import TestRootContextCapture from "./TestRootContextCapture.svelte";
import type { PlayerContext } from "../../lib/player/context";
import { MANIFEST_WITH_HLS, mockFetchManifest } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";

// Simulate "hls.js is not installed": the dynamic import resolves to a module
// with no default export, so Root's resolver gets a nullish constructor.
vi.mock("hls.js", () => ({ default: undefined }));

describe("Root without hls.js available", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    manifestCache.clear();
  });

  test("reports a missing HLS library as a fatal media error and renders the error UI", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // This Chromium build under Playwright reports canPlayType("maybe") for
    // HLS mime types (see hlsUtils.test.ts), so force native support off to
    // deterministically reach the hls-js resolver this test targets.
    const canPlayTypeSpy = vi
      .spyOn(HTMLMediaElement.prototype, "canPlayType")
      .mockReturnValue("");
    try {
      mockFetchManifest(MANIFEST_WITH_HLS);
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      const { container } = render(TestRootContextCapture, {
        props: {
          manifestUrl: "https://example.com/missing-hls.json",
          onError,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: true,
        source: "media",
      });
      expect(capturedCtx!.state.error?.message).toMatch(/hls\.js/);
      expect(capturedCtx!.hlsAdapter).toBeNull();
      expect(container.querySelector('[role="alert"]')?.textContent).toMatch(
        /hls\.js/,
      );
    } finally {
      warnSpy.mockRestore();
      canPlayTypeSpy.mockRestore();
    }
  });
});
