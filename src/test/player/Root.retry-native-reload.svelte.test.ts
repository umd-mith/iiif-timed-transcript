import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushSync } from "svelte";
import TestRootViewerTranscript from "./TestRootViewerTranscript.svelte";
import { mockFetchManifest } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";
import type { PlayerContext } from "../../lib/player/context";

// Native (mp4) video canvas, no captions — enough to exercise retry's native
// media reload.
function nativeVideoManifest(url: string) {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: url,
    type: "Manifest",
    label: { en: ["Native video"] },
    items: [
      {
        id: `${url}/canvas/1`,
        type: "Canvas",
        duration: 120,
        items: [
          {
            id: `${url}/canvas/1/page/1`,
            type: "AnnotationPage",
            items: [
              {
                id: `${url}/canvas/1/page/1/annotation/1`,
                type: "Annotation",
                motivation: "painting",
                body: {
                  id: "https://example.com/retry-native.mp4",
                  type: "Video",
                  format: "video/mp4",
                },
                target: `${url}/canvas/1`,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("actions.retry() restarts native media at an unchanged URL", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
    manifestCache.clear();
    vi.restoreAllMocks();
  });

  test("a failed native load recovers: retry clears the error AND re-issues a media load", async () => {
    const url = "https://example.com/manifest-retry-native.json";
    mockFetchManifest(nativeVideoManifest(url));

    let ctx: PlayerContext | null = null;
    mount(TestRootViewerTranscript, {
      target,
      props: {
        manifestUrl: url,
        annotations: [],
        renderTranscript: false,
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.mediaStrategy).toBe("native");
      expect(ctx!.mediaElement).toBeInstanceOf(HTMLVideoElement);
    });
    flushSync();

    const video = ctx!.mediaElement as HTMLVideoElement;

    // Count reloads from here on: load() re-runs the resource-selection
    // algorithm, which fires a fresh `loadstart`. The initial mount's loadstart
    // already fired before this listener attached, so any count is a re-load.
    let reloads = 0;
    video.addEventListener("loadstart", () => {
      reloads++;
    });

    // Simulate a native media failure (unsupported format, code 4).
    Object.defineProperty(video, "error", {
      configurable: true,
      value: { code: 4, message: "" },
    });
    video.dispatchEvent(new Event("error"));
    flushSync();
    expect(ctx!.state.error).toBeInstanceOf(Error);

    // Recover.
    await ctx!.actions.retry();
    flushSync();

    // Clearing the error alone is a trivial pass (retry always does it); the
    // load-bearing signal is that a NEW media load was actually initiated
    // against the same URL — without it the element keeps its dead source.
    expect(ctx!.state.error).toBeNull();
    await vi.waitFor(() => expect(reloads).toBeGreaterThanOrEqual(1));
  });
});
