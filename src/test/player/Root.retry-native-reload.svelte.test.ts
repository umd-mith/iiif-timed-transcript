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

    // Every `loadstart` from here on. load() re-runs the resource-selection
    // algorithm, which fires a fresh loadstart — the browser's own reaction to
    // a real load, not a spy on our own call.
    let loadStarts = 0;
    video.addEventListener("loadstart", () => {
      loadStarts++;
    });

    // Establish an explicit baseline load that this listener provably caught,
    // rather than assuming the mount's loadstart already fired before attach —
    // otherwise a stray initial event could be miscounted as the retry's.
    video.load();
    await vi.waitFor(() => expect(loadStarts).toBeGreaterThanOrEqual(1));
    const baseline = loadStarts;

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
    // load-bearing signal is that retry initiated ANOTHER native load beyond
    // the established baseline — without it the element keeps its dead source.
    expect(ctx!.state.error).toBeNull();
    await vi.waitFor(() => expect(loadStarts).toBeGreaterThan(baseline));
  });
});
