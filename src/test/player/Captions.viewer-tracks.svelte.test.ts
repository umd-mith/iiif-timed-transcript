import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushSync } from "svelte";
import TestRootViewerCaptions from "./TestRootViewerCaptions.svelte";
import { mockFetchManifest } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";
import type { PlayerContext, TrackDefinition } from "../../lib/player/context";

// A VIDEO canvas whose manifest carries NO caption annotations, so
// getSupplementaryVTTTracks(canvas) returns []. Captions supplied only through
// Viewer's `tracks` prop must still light the CC button.
function videoManifestNoCaptions(url: string) {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: url,
    type: "Manifest",
    label: { en: ["Video, no manifest captions"] },
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
                  id: "https://example.com/video-no-cc.mp4",
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

const propTracks: TrackDefinition[] = [
  {
    src: "https://example.com/prop-en.vtt",
    kind: "captions",
    srclang: "en",
    label: "English",
  },
];

describe("Captions recognizes tracks supplied via Viewer's tracks prop", () => {
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

  test("CC button renders when captions come only from the Viewer tracks prop", async () => {
    const url = "https://example.com/manifest-viewer-tracks-1.json";
    mockFetchManifest(videoManifestNoCaptions(url));

    let ctx: PlayerContext | null = null;
    mount(TestRootViewerCaptions, {
      target,
      props: {
        manifestUrl: url,
        tracks: propTracks,
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.mediaType).toBe("video");
    });
    flushSync();

    // The manifest carried no captions, so the transcript-selection source is
    // empty — but the CC button must still appear from the prop tracks.
    expect(ctx!.tracks.length).toBe(0);
    expect(
      target.querySelector('[data-audio-button="captions"]'),
    ).not.toBeNull();
  });

  test("clicking the CC button drives the prop track's mode: first hidden, then showing", async () => {
    const url = "https://example.com/manifest-viewer-tracks-2.json";
    mockFetchManifest(videoManifestNoCaptions(url));

    let ctx: PlayerContext | null = null;
    mount(TestRootViewerCaptions, {
      target,
      props: {
        manifestUrl: url,
        tracks: propTracks,
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.mediaType).toBe("video");
    });
    flushSync();

    const button = target.querySelector<HTMLButtonElement>(
      '[data-audio-button="captions"]',
    )!;
    const video = ctx!.mediaElement as HTMLVideoElement;
    await vi.waitFor(() => expect(video.textTracks.length).toBe(1));

    // No <Transcript> is mounted, so the machine rests in browserDefault
    // (captions on). The first user toggle hides; the second shows. Asserting
    // the reverse would test an unreachable autoHidden path.
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click();
    flushSync();
    await vi.waitFor(() => expect(video.textTracks[0]!.mode).toBe("hidden"));
    expect(button.getAttribute("aria-pressed")).toBe("false");

    button.click();
    flushSync();
    await vi.waitFor(() => expect(video.textTracks[0]!.mode).toBe("showing"));
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  test("the CC toggle still drives the prop track after actions.retry()", async () => {
    const url = "https://example.com/manifest-viewer-tracks-retry.json";
    mockFetchManifest(videoManifestNoCaptions(url));

    let ctx: PlayerContext | null = null;
    mount(TestRootViewerCaptions, {
      target,
      props: {
        manifestUrl: url,
        tracks: propTracks,
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.mediaType).toBe("video");
    });
    flushSync();

    const button = target.querySelector<HTMLButtonElement>(
      '[data-audio-button="captions"]',
    )!;
    const video = ctx!.mediaElement as HTMLVideoElement;
    await vi.waitFor(() => expect(video.textTracks.length).toBe(1));

    // retry re-runs the manifest/canvas pipeline, which resets the captions
    // machine to unavailable. The prop tracks are unchanged, so the button must
    // stay live and the toggle must keep working — the caption-track report has
    // to be re-asserted after the reset, not only on a canvas/mediaType change.
    await ctx!.actions.retry();
    flushSync();

    expect(button).not.toBeNull();
    expect(
      target.querySelector('[data-audio-button="captions"]'),
    ).not.toBeNull();

    button.click();
    flushSync();
    await vi.waitFor(() => expect(video.textTracks[0]!.mode).toBe("hidden"));
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  test("no CC button on an audio canvas even when a tracks prop is passed", async () => {
    const url = "https://example.com/manifest-viewer-tracks-audio.json";
    mockFetchManifest({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: url,
      type: "Manifest",
      label: { en: ["Audio, tracks prop"] },
      items: [
        {
          id: `${url}/canvas/1`,
          type: "Canvas",
          duration: 90,
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
                    id: "https://example.com/audio-no-cc.mp3",
                    type: "Sound",
                    format: "audio/mp3",
                  },
                  target: `${url}/canvas/1`,
                },
              ],
            },
          ],
        },
      ],
    });

    let ctx: PlayerContext | null = null;
    mount(TestRootViewerCaptions, {
      target,
      props: {
        manifestUrl: url,
        tracks: propTracks,
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.mediaType).toBe("audio");
    });
    flushSync();

    expect(target.querySelector('[data-audio-button="captions"]')).toBeNull();
  });

  test("CC button stays live after switching to a canvas that shares the media URL", async () => {
    const url = "https://example.com/manifest-viewer-tracks-shared.json";
    // Two video canvases, SAME media URL, neither carrying manifest captions —
    // the exact case where a mediaUrl-keyed re-report would miss the switch and
    // leave the button dead on canvas B.
    const canvas = (n: number) => ({
      id: `${url}/canvas/${n}`,
      type: "Canvas",
      duration: 120,
      items: [
        {
          id: `${url}/canvas/${n}/page/1`,
          type: "AnnotationPage",
          items: [
            {
              id: `${url}/canvas/${n}/page/1/annotation/1`,
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/shared-video.mp4",
                type: "Video",
                format: "video/mp4",
              },
              target: `${url}/canvas/${n}`,
            },
          ],
        },
      ],
    });
    mockFetchManifest({
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: url,
      type: "Manifest",
      label: { en: ["Two video canvases, shared URL"] },
      items: [canvas(1), canvas(2)],
    });

    let ctx: PlayerContext | null = null;
    mount(TestRootViewerCaptions, {
      target,
      props: {
        manifestUrl: url,
        tracks: propTracks,
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.canvasCount).toBe(2);
    });
    flushSync();
    expect(
      target.querySelector('[data-audio-button="captions"]'),
    ).not.toBeNull();

    ctx!.actions.switchCanvas(1);
    await vi.waitFor(() => expect(ctx!.canvasIndex).toBe(1));
    flushSync();

    expect(
      target.querySelector('[data-audio-button="captions"]'),
    ).not.toBeNull();
  });
});
