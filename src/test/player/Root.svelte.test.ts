import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushSync, unmount } from "svelte";
import Root from "../../lib/player/Root.svelte";
import TestRootWrapper from "./TestRootWrapper.svelte";
import TestRootAnnotationsWrapper from "./TestRootAnnotationsWrapper.svelte";
import TestRootViewerTranscript from "./TestRootViewerTranscript.svelte";
import type { PlayerContext } from "../../lib/player/context";
import type { HlsConstructor } from "../../lib/media/hlsUtils";
import { createContextCapture } from "./test-utils";
import {
  MANIFEST_WITH_CHAPTERS,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_WITH_HLS,
  MANIFEST_WITH_CHOICE_HLS,
  MANIFEST_WITH_VTT_CAPTIONS,
  MANIFEST_MULTI_CANVAS,
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
  MANIFEST_INITIAL_INDEX,
  VTT_FIXTURE_OK,
  VTT_FIXTURE_MALFORMED,
  VTT_FIXTURE_PARTIAL,
  mockFetchManifest,
  mockFetchRoutes,
  deferred,
  buildStaleHlsManifest,
} from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";

describe("Root component", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    if (document.body.contains(target)) {
      document.body.removeChild(target);
    }
    manifestCache.clear();
  });

  const mockManifest = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: "https://example.com/manifest",
    type: "Manifest",
    label: { en: ["Test Manifest"] },
    items: [
      {
        id: "canvas1",
        type: "Canvas",
        duration: 60,
        items: [
          {
            id: "page1",
            type: "AnnotationPage",
            items: [
              {
                id: "annotation1",
                type: "Annotation",
                motivation: "painting",
                body: {
                  id: "https://example.com/audio.mp3",
                  type: "Sound",
                  format: "audio/mp3",
                },
                target: "canvas1",
              },
            ],
          },
        ],
      },
    ],
  };

  // Use unique URLs per test to avoid module-level cache cross-contamination
  test("renders without errors", () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    mount(Root, {
      target,
      props: { manifestUrl: "https://example.com/render-test.json" },
    });
    flushSync();

    expect(target.querySelector(".iiif-player-root")).toBeTruthy();
  });

  test("does not re-fetch manifest for same URL when mounted twice", async () => {
    const url = "https://example.com/cache-dedup-test.json";
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    // Mount first instance
    mount(Root, {
      target,
      props: { manifestUrl: url },
    });
    flushSync();

    // Wait for first fetch to complete
    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // Mount second instance with same URL
    const target2 = document.createElement("div");
    document.body.appendChild(target2);

    mount(Root, {
      target: target2,
      props: { manifestUrl: url },
    });
    flushSync();

    // Wait a tick for onMount to fire
    await new Promise((r) => setTimeout(r, 50));

    // Should still only have fetched once
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    document.body.removeChild(target2);
  });

  test("fetches different URLs separately", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    mount(Root, {
      target,
      props: { manifestUrl: "https://example.com/separate-a.json" },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const target2 = document.createElement("div");
    document.body.appendChild(target2);

    mount(Root, {
      target: target2,
      props: { manifestUrl: "https://example.com/separate-b.json" },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    document.body.removeChild(target2);
  });

  describe("chapters parsing", () => {
    test("exposes chapters from manifest with structures", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/chapters-with-structures.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        // Context uses getters so .chapters reads the latest value
        expect(capturedCtx!.chapters).toBeDefined();
        expect(capturedCtx!.chapters.length).toBe(2);
        expect(capturedCtx!.chapters[0]).toMatchObject({
          id: "https://example.com/range/1",
          label: "Introduction",
          startTime: 0,
          endTime: 30,
        });
        expect(capturedCtx!.chapters[1]).toMatchObject({
          id: "https://example.com/range/2",
          label: "Main Discussion",
          startTime: 30,
          endTime: 90,
        });
      });
    });

    test("returns empty chapters when manifest has no structures", async () => {
      mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/chapters-without-structures.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.chapters).toBeDefined();
        expect(capturedCtx!.chapters).toEqual([]);
        expect(capturedCtx!.state.error).toBeNull();
      });
    });

    test("activeChapterId starts as null (with chapters manifest)", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/active-chapter-id-null.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.activeChapterId).toBeNull();
      });
    });
  });

  describe("annotations prop", () => {
    test("exposes annotations from prop via context", async () => {
      mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

      const testAnnotations = [
        { id: "a1", startTime: 0, endTime: 5, text: "First" },
        { id: "a2", startTime: 5, endTime: 10, text: "Second" },
      ];

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/annotations-test.json",
          annotations: testAnnotations,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.annotations).toEqual(testAnnotations);
      });
    });

    test("annotations defaults to empty array in context", async () => {
      mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/annotations-default.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.annotations).toEqual([]);
      });
    });
  });

  describe("HLS detection", () => {
    test("sets mediaStrategy to hls-js for .m3u8 URLs when native not supported", async () => {
      mockFetchManifest(MANIFEST_WITH_HLS);

      // Create a mock HLS constructor for Root to use
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
      ) as unknown as HlsConstructor;

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/hls-manifest.json",
          hlsConstructor: MockHls,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBe(
          "https://example.com/stream/master.m3u8",
        );
        // In Chromium, native HLS may be supported, so strategy could be 'native' or 'hls-js'
        // The key assertion: it detected HLS content and the adapter exists when strategy is hls-js
        const strategy = capturedCtx!.mediaStrategy;
        if (strategy === "hls-js") {
          expect(capturedCtx!.hlsAdapter).not.toBeNull();
        } else {
          expect(strategy).toBe("native");
        }
      });
    });

    test("sets mediaStrategy to native for non-HLS URLs", async () => {
      mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/non-hls-manifest.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaStrategy).toBe("native");
        expect(capturedCtx!.hlsAdapter).toBeNull();
      });
    });

    test("plays a Choice of HLS renditions (first Video member) instead of failing", async () => {
      mockFetchManifest(MANIFEST_WITH_CHOICE_HLS);
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
          Events: { MANIFEST_PARSED: "hlsManifestParsed", ERROR: "hlsError" },
        },
      ) as unknown as HlsConstructor;
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/choice-hls.json",
          hlsConstructor: MockHls,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBe(
          "https://example.com/choice/high.m3u8",
        );
      });
      expect(capturedCtx!.mediaType).toBe("video");
      expect(capturedCtx!.state.error).toBeNull();
    });
  });

  describe("VTT caption discovery", () => {
    test("discovers VTT tracks from canvas annotations", async () => {
      mockFetchManifest(MANIFEST_WITH_VTT_CAPTIONS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/vtt-manifest.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.tracks).toBeDefined();
        expect(capturedCtx!.tracks).toHaveLength(1);
        expect(capturedCtx!.tracks[0]).toMatchObject({
          src: "https://example.com/captions-fr.vtt",
          kind: "captions",
          srclang: "fr",
          label: "Sous-titres",
        });
      });
    });

    test("returns empty tracks when manifest has no VTT annotations", async () => {
      mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/no-vtt-manifest.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.tracks).toBeDefined();
        expect(capturedCtx!.tracks).toEqual([]);
      });
    });
  });

  describe("initialTime and autoplay", () => {
    /**
     * Helper: simulate media becoming ready by attaching a mock media element
     * and setting isReady + duration, then flushing Svelte effects.
     */
    function simulateMediaReady(
      ctx: PlayerContext,
      duration: number = 90,
    ): HTMLAudioElement {
      const el = document.createElement("audio");
      // Stub play() to return a resolved promise (browsers require user gesture)
      el.play = vi.fn().mockResolvedValue(undefined);
      ctx.mediaElement = el;
      ctx.state.duration = duration;
      ctx.state.isReady = true;
      flushSync();
      return el;
    }

    test("initialTime seeks to specified time after media ready", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/initial-time-test.json",
          initialTime: 30,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      const el = simulateMediaReady(capturedCtx!);

      // seekTo should have set currentTime to 30
      expect(el.currentTime).toBe(30);
    });

    test("initialTime does not re-apply after canvas switch", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/initial-time-no-reapply.json",
          initialTime: 30,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      // First canvas becomes ready — initialTime applied
      const el1 = simulateMediaReady(capturedCtx!, 90);
      expect(el1.currentTime).toBe(30);

      // Switch to canvas 1 (resets isReady)
      capturedCtx!.actions.switchCanvas(1);

      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(1);
      });

      // Second canvas becomes ready — initialTime should NOT re-apply
      const el2 = simulateMediaReady(capturedCtx!, 120);
      expect(el2.currentTime).toBe(0);
    });

    test("autoplay calls play after media ready", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/autoplay-test.json",
          autoplay: true,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      const el = simulateMediaReady(capturedCtx!);

      expect(el.play).toHaveBeenCalled();
    });

    test("autoplay re-triggers after canvas switch", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/autoplay-canvas-switch.json",
          autoplay: true,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      // First canvas ready — autoplay fires
      const el1 = simulateMediaReady(capturedCtx!);
      expect(el1.play).toHaveBeenCalledTimes(1);

      // Switch canvas
      capturedCtx!.actions.switchCanvas(1);
      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(1);
      });

      // Second canvas ready — autoplay fires again
      const el2 = simulateMediaReady(capturedCtx!, 120);
      expect(el2.play).toHaveBeenCalledTimes(1);
    });

    test("initialTime and autoplay together: seeks then plays", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/both-props-test.json",
          initialTime: 15,
          autoplay: true,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      const el = simulateMediaReady(capturedCtx!);

      // Both should have fired
      expect(el.currentTime).toBe(15);
      expect(el.play).toHaveBeenCalled();
    });
  });

  describe("multi-canvas navigation", () => {
    test("exposes canvasIndex, canvasCount, and canvases from context", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.canvasIndex).toBe(0);
        expect(capturedCtx!.canvasCount).toBe(2);
        expect(capturedCtx!.canvases).toHaveLength(2);
        expect(capturedCtx!.canvases[0]).toMatchObject({
          index: 0,
          id: "https://example.com/canvas/1",
          label: "Interview Part 1",
          mediaType: "audio",
        });
        expect(capturedCtx!.canvases[1]).toMatchObject({
          index: 1,
          id: "https://example.com/canvas/2",
          label: "Interview Part 2",
          mediaType: "video",
        });
      });
    });

    test("filters chapters to current canvas", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-chapters.json",
          canvasIndex: 0,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        // Canvas 0 has 2 chapters: Introduction and Early Life
        expect(capturedCtx!.chapters).toHaveLength(2);
        expect(capturedCtx!.chapters[0]).toMatchObject({
          label: "Introduction",
          startTime: 0,
          endTime: 30,
        });
        expect(capturedCtx!.chapters[1]).toMatchObject({
          label: "Early Life",
          startTime: 30,
          endTime: 90,
        });
      });
    });

    test("loads correct media for canvasIndex=1", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-idx1.json",
          canvasIndex: 1,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/video2.mp4");
        expect(capturedCtx!.mediaType).toBe("video");
        expect(capturedCtx!.canvasIndex).toBe(1);
        // Canvas 1 has 2 chapters: Career Beginnings and Later Years
        expect(capturedCtx!.chapters).toHaveLength(2);
        expect(capturedCtx!.chapters[0]).toMatchObject({
          label: "Career Beginnings",
        });
        // Canvas 1 has VTT tracks
        expect(capturedCtx!.tracks).toHaveLength(1);
      });
    });

    test("switchCanvas changes active canvas", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-switch.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      // Wait for initial load
      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/audio1.mp3");
      });

      // Switch to canvas 1
      capturedCtx!.actions.switchCanvas(1);

      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(1);
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/video2.mp4");
        expect(capturedCtx!.mediaType).toBe("video");
        expect(capturedCtx!.chapters).toHaveLength(2);
        expect(capturedCtx!.chapters[0]).toMatchObject({
          label: "Career Beginnings",
        });
      });
    });

    test("switchCanvas fires onCanvasChange callback", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;
      const onCanvasChange = vi.fn();

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-callback.json",
          onCanvasChange,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      capturedCtx!.actions.switchCanvas(1);

      await vi.waitFor(() => {
        expect(onCanvasChange).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            index: 1,
            id: "https://example.com/canvas/2",
            label: "Interview Part 2",
          }),
        );
      });
    });

    test("switchCanvas ignores out-of-bounds index", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-bounds.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      capturedCtx!.actions.switchCanvas(99);

      // Should still be on canvas 0
      expect(capturedCtx!.canvasIndex).toBe(0);
      expect(capturedCtx!.mediaUrl).toBe("https://example.com/audio1.mp3");
    });

    test("switchCanvas ignores a non-integer index", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-non-integer.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBeTruthy();
      });

      // NaN passes every ordering guard (`NaN < 0`, `NaN >= len` and
      // `NaN === 0` are all false), so without an explicit integer check it
      // would tear down the media, set canvasIndex to NaN and silently
      // reload canvas 0 with no onCanvasChange.
      capturedCtx!.actions.switchCanvas(Number.NaN);
      expect(capturedCtx!.canvasIndex).toBe(0);
      expect(capturedCtx!.mediaUrl).toBe("https://example.com/audio1.mp3");

      capturedCtx!.actions.switchCanvas(1.5);
      expect(capturedCtx!.canvasIndex).toBe(0);
      expect(capturedCtx!.mediaUrl).toBe("https://example.com/audio1.mp3");
    });

    test("prop canvasIndex change before manifest loads is honored", async () => {
      // Create a deferred promise so we control when fetch resolves
      let resolveFetch!: (value: unknown) => void;
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      let capturedCtx: PlayerContext | null = null;

      // Mount wrapper with canvasIndex=0
      const wrapper = mount(TestRootWrapper, {
        target,
        props: {
          manifestUrl: "https://example.com/multi-canvas-prop-change.json",
          canvasIndex: 0,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      // Change canvasIndex prop to 1 BEFORE manifest resolves
      wrapper.setCanvasIndex(1);
      flushSync();

      // Now resolve the fetch
      resolveFetch({
        ok: true,
        json: async () => MANIFEST_MULTI_CANVAS,
      });

      // Canvas 1 should load (video2.mp4), not canvas 0 (audio1.mp3)
      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.canvasIndex).toBe(1);
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/video2.mp4");
      });
    });

    test("single-canvas manifest has canvasCount=1 and empty canvases for CanvasNav", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/single-canvas-nav.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.canvasCount).toBe(1);
        expect(capturedCtx!.canvases).toHaveLength(1);
        expect(capturedCtx!.canvasIndex).toBe(0);
      });
    });

    // Regression test for the performCanvasSwitch null-reset fix (Root.svelte):
    // hlsAdapter/dashAdapter must be cleared when switching away from a
    // canvas that had one attached, even though here the real (unmocked)
    // hls.js import happens to resolve before switchCanvas runs — so this
    // test does NOT exercise the loadGeneration async-race guard. See the
    // next test for that.
    test("switching away from an HLS canvas clears the hlsAdapter (performCanvasSwitch null-reset)", async () => {
      // This Chromium build under Playwright reports canPlayType("maybe") for
      // HLS mime types (see hlsUtils.test.ts), so force native support off to
      // deterministically exercise the hls-js path this test targets.
      const canPlayTypeSpy = vi
        .spyOn(HTMLMediaElement.prototype, "canPlayType")
        .mockReturnValue("");

      try {
        const url = "https://example.com/stale-hls.json";
        mockFetchManifest(buildStaleHlsManifest(url));

        // A constructor whose resolution we control: hlsConstructor is used
        // synchronously, so force the async path by leaving it undefined and
        // relying on the real hls.js import — then switch canvas immediately.
        let capturedCtx: PlayerContext | null = null;
        mount(Root, {
          target,
          props: {
            manifestUrl: url,
            canvasIndex: 0,
            children: createContextCapture(target, (ctx) => {
              capturedCtx = ctx;
            }),
          },
        });
        await vi.waitFor(() => {
          expect(capturedCtx).not.toBeNull();
          expect(capturedCtx!.mediaStrategy).toBe("hls-js");
        });

        // Switch before the dynamic import can settle.
        capturedCtx!.actions.switchCanvas(1);
        flushSync();
        await new Promise((r) => setTimeout(r, 100));

        expect(capturedCtx!.canvasIndex).toBe(1);
        expect(capturedCtx!.mediaStrategy).toBe("native");
        expect(capturedCtx!.hlsAdapter).toBeNull();
        expect(capturedCtx!.state.error).toBeNull();
      } finally {
        canPlayTypeSpy.mockRestore();
      }
    });

    // The loadGeneration async-race guard itself (resolveHlsAdapter's
    // `generation !== loadGeneration` check) needs the hls.js import held
    // genuinely pending across a canvas switch — see the dedicated
    // Root.stale-hls-import.svelte.test.ts, which module-mocks "hls.js"
    // with a controlled deferred promise to do that deterministically.
  });

  describe("onPlayerInit callback", () => {
    test("fires onPlayerInit after manifest loads with populated ref", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      const onPlayerInit = vi.fn();

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/init-callback-basic.json",
          onPlayerInit,
          children: createContextCapture(target, () => {}),
        },
      });

      await vi.waitFor(() => {
        expect(onPlayerInit).toHaveBeenCalledOnce();
      });

      const ref = onPlayerInit.mock.calls[0]![0];
      expect(ref.state).toBeDefined();
      expect(ref.actions).toBeDefined();
      expect(ref.canvases).toHaveLength(1);
      expect(ref.mediaType).toBe("audio");
      expect(ref.chapters).toHaveLength(2);
      expect(ref.annotations).toEqual([]);
      expect(ref.canvasIndex).toBe(0);
      expect(ref.canvasCount).toBe(1);
      // Not yet media-ready at init time
      expect(ref.state.isReady).toBe(false);
    });

    test("does not fire onPlayerInit when manifest fetch fails", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const onPlayerInit = vi.fn();

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/init-callback-fail.json",
          onPlayerInit,
          children: createContextCapture(target, () => {}),
        },
      });

      // Wait for error state to appear
      await vi.waitFor(() => {
        expect(target.querySelector("[role='alert']")).not.toBeNull();
      });

      expect(onPlayerInit).not.toHaveBeenCalled();
    });

    test("fires onPlayerInit once on successful retry after failure", async () => {
      const onPlayerInit = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      // First call fails, second succeeds
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Server Error",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => MANIFEST_WITH_CHAPTERS,
        });

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/init-callback-retry.json",
          onPlayerInit,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      // Wait for error state
      await vi.waitFor(() => {
        expect(target.querySelector("[role='alert']")).not.toBeNull();
      });
      expect(onPlayerInit).not.toHaveBeenCalled();

      // Trigger retry
      capturedCtx!.actions.retry();

      // Wait for successful init
      await vi.waitFor(() => {
        expect(onPlayerInit).toHaveBeenCalledOnce();
      });

      // Verify ref shape
      const ref = onPlayerInit.mock.calls[0]![0];
      expect(ref.canvases).toHaveLength(1);
      expect(ref.mediaType).toBe("audio");
    });

    test("retry keeps an internally-selected canvas", async () => {
      // retry() re-runs fetchManifestData, which reconciles the canvasIndex
      // prop into state. That reconcile must happen on the first load only:
      // here the prop stays at its default 0 while the user switched to
      // canvas 1, and retry must not snap back past performCanvasSwitch.
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      const onCanvasChange = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/retry-keeps-canvas.json",
          onCanvasChange,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/audio1.mp3");
      });

      capturedCtx!.actions.switchCanvas(1);

      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(1);
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/video2.mp4");
      });
      expect(onCanvasChange).toHaveBeenCalledOnce();

      capturedCtx!.actions.retry();

      await vi.waitFor(() => {
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/video2.mp4");
      });
      // Let any stray reconcile + reload settle before asserting.
      await new Promise((r) => setTimeout(r, 30));

      expect(capturedCtx!.canvasIndex).toBe(1);
      expect(capturedCtx!.mediaUrl).toBe("https://example.com/video2.mp4");
      expect(onCanvasChange).toHaveBeenCalledOnce();
    });

    test("does not re-fire onPlayerInit on canvas switch", async () => {
      mockFetchManifest(MANIFEST_MULTI_CANVAS);

      const onPlayerInit = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/init-callback-canvas-switch.json",
          onPlayerInit,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(onPlayerInit).toHaveBeenCalledOnce();
      });

      // Switch canvas
      capturedCtx!.actions.switchCanvas(1);

      // Give time for any potential re-fire
      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(1);
      });

      // Still only called once
      expect(onPlayerInit).toHaveBeenCalledOnce();
    });

    test("does not corrupt state when onPlayerInit callback throws", async () => {
      mockFetchManifest(MANIFEST_WITH_CHAPTERS);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const onPlayerInit = vi.fn(() => {
        throw new Error("consumer bug");
      });

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/init-callback-throws.json",
          onPlayerInit,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(onPlayerInit).toHaveBeenCalledOnce();
      });

      // Callback threw, but player should NOT be in an error state
      expect(capturedCtx!.state.error).toBeNull();
      // Manifest cache should NOT be corrupted (no alert shown)
      expect(target.querySelector("[role='alert']")).toBeNull();
      // Player loaded successfully despite callback error
      expect(capturedCtx!.canvases).toHaveLength(1);
      expect(capturedCtx!.mediaType).toBe("audio");

      expect(errorSpy).toHaveBeenCalledWith(
        "[IIIFPlayer] onPlayerInit callback threw:",
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  describe("poster resolution", () => {
    function videoManifest(extras: Record<string, unknown>) {
      return {
        "@context": "http://iiif.io/api/presentation/3/context.json",
        id: "https://example.com/manifest",
        type: "Manifest",
        label: { en: ["Poster Test"] },
        items: [
          {
            id: "https://example.com/canvas/1",
            type: "Canvas",
            width: 640,
            height: 360,
            duration: 100,
            items: [
              {
                id: "https://example.com/canvas/1/page",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/1/anno",
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: "https://example.com/video.mp4",
                      type: "Video",
                      format: "video/mp4",
                      duration: 100,
                    },
                    target: "https://example.com/canvas/1",
                  },
                ],
              },
            ],
            ...extras,
          },
        ],
      };
    }

    const placeholderCanvas = {
      id: "https://example.com/canvas/1/placeholder",
      type: "Canvas",
      width: 640,
      height: 360,
      items: [
        {
          id: "https://example.com/canvas/1/placeholder/page",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/canvas/1/placeholder/anno",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/poster.png",
                type: "Image",
                format: "image/png",
                width: 640,
                height: 360,
              },
              target: "https://example.com/canvas/1/placeholder",
            },
          ],
        },
      ],
    };

    test("populates context posterUrl from placeholderCanvas", async () => {
      mockFetchManifest(videoManifest({ placeholderCanvas }));

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/poster-placeholder.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.posterUrl).toBe("https://example.com/poster.png");
      });
    });

    test("leaves context posterUrl undefined when no placeholder/accompanying canvas", async () => {
      mockFetchManifest(videoManifest({}));

      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/poster-none.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/video.mp4");
      });
      expect(capturedCtx!.posterUrl).toBeUndefined();
    });
  });

  describe("onError", () => {
    test("reports a failed manifest fetch as fatal manifest and sets state.error", async () => {
      const onError = vi.fn();
      const url = "https://example.com/onerror-404.json";
      mockFetchRoutes({ [url]: { status: 404 } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      const [error, info] = onError.mock.calls[0]!;
      expect(error).toBeInstanceOf(Error);
      expect(info).toEqual({ fatal: true, source: "manifest" });
      expect(capturedCtx!.state.error).toBe(error);
    });

    test("reports a non-AV canvas as fatal canvas", async () => {
      const onError = vi.fn();
      const url = "https://example.com/onerror-image.json";
      const imageManifest = {
        ...mockManifest,
        id: url,
        items: [
          {
            id: "canvas-img",
            type: "Canvas",
            width: 100,
            height: 100,
            items: [
              {
                id: "page-img",
                type: "AnnotationPage",
                items: [
                  {
                    id: "anno-img",
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: "https://example.com/image.jpg",
                      type: "Image",
                      format: "image/jpeg",
                    },
                    target: "canvas-img",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({ [url]: { json: imageManifest } });

      mount(Root, { target, props: { manifestUrl: url, onError } });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: true,
        source: "canvas",
      });
    });

    test("reports a rejected play() as non-fatal playback, exactly once", async () => {
      const onError = vi.fn();
      const url = "https://example.com/onerror-playback.json";
      mockFetchRoutes({ [url]: { json: mockManifest } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });
      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).not.toBe("");
      });

      const notAllowed = new DOMException("blocked", "NotAllowedError");
      capturedCtx!.mediaElement = {
        play: vi.fn().mockRejectedValue(notAllowed),
        pause: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        currentTime: 0,
        duration: 60,
        playbackRate: 1,
        src: "",
      } as unknown as HTMLMediaElement;
      flushSync();

      await capturedCtx!.actions.play();
      flushSync();
      await new Promise((r) => setTimeout(r, 20));

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]).toBe(notAllowed);
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: false,
        source: "playback",
      });
    });

    test("reports an error written to state.error from outside Root as fatal media", async () => {
      const onError = vi.fn();
      const url = "https://example.com/onerror-watcher.json";
      mockFetchRoutes({ [url]: { json: mockManifest } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });
      await vi.waitFor(() => {
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.mediaUrl).not.toBe("");
      });

      const mediaError = new Error(
        "This media format is not supported by your browser.",
      );
      capturedCtx!.state.error = mediaError;
      flushSync();

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![0]).toBe(mediaError);
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: true,
        source: "media",
      });
    });

    test("neither onPlayerInit nor onError fires when Root is unmounted before the manifest settles", async () => {
      const onError = vi.fn();
      const onPlayerInit = vi.fn();
      const url = "https://example.com/onerror-unmount.json";
      const pending = deferred<{ json: unknown }>();
      mockFetchRoutes({ [url]: { promise: pending.promise } });

      const app = mount(Root, {
        target,
        props: { manifestUrl: url, onError, onPlayerInit },
      });
      flushSync();
      await vi.waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      });

      unmount(app);
      pending.resolve({ json: mockManifest });
      await new Promise((r) => setTimeout(r, 30));

      expect(onPlayerInit).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    test("a throwing onError callback is caught and logged", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const url = "https://example.com/onerror-throws.json";
      mockFetchRoutes({ [url]: { status: 500 } });

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          onError: () => {
            throw new Error("consumer bug");
          },
        },
      });

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          "[IIIFPlayer] onError callback threw:",
          expect.any(Error),
        );
      });
      errorSpy.mockRestore();
    });
  });

  describe('annotations="auto"', () => {
    test("builds annotations from embedded TextualBody supplementing annotations (tier 1)", async () => {
      const url = "https://example.com/auto-embedded.json";
      mockFetchRoutes({ [url]: { json: MANIFEST_WITH_EMBEDDED_TRANSCRIPT } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.annotations).toHaveLength(2);
      });
      expect(capturedCtx!.annotations[0]).toMatchObject({
        startTime: 0,
        endTime: 5,
        text: "Welcome to the interview.",
        metadata: { tags: ["Interviewer"] },
      });
      // Duplicate annotation ids (AVAnnotate) are de-duplicated
      expect(capturedCtx!.annotations[0]!.id).not.toBe(
        capturedCtx!.annotations[1]!.id,
      );
      expect(capturedCtx!.transcriptStatus).toBe("ready");
    });

    test("yields [] and status ready for a canvas with neither embedded text nor VTT", async () => {
      const url = "https://example.com/auto-none.json";
      mockFetchRoutes({ [url]: { json: mockManifest } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.mediaUrl).not.toBe("");
      });
      expect(capturedCtx!.annotations).toEqual([]);
      expect(capturedCtx!.transcriptStatus).toBe("ready");
    });

    test("passes transcriptStatus to the children snippet and leaves prop-mode untouched", async () => {
      const url = "https://example.com/auto-prop-mode.json";
      mockFetchRoutes({ [url]: { json: MANIFEST_WITH_EMBEDDED_TRANSCRIPT } });
      const given = [{ id: "p1", startTime: 0, endTime: 1, text: "From prop" }];
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: given,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.mediaUrl).not.toBe("");
      });
      expect(capturedCtx!.annotations).toEqual(given);
      expect(capturedCtx!.transcriptStatus).toBe("idle");
    });

    test("builds annotations from the external VTT track (tier 2) with a loading state in between", async () => {
      const url = "https://example.com/auto-vtt.json";
      const vtt = deferred<{ text: string }>();
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { promise: vtt.promise },
      });
      const onPlayerInit = vi.fn();
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onPlayerInit,
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("loading");
      });
      expect(capturedCtx!.annotations).toEqual([]);
      // playerrefavailable is not widened to wait for the VTT
      expect(onPlayerInit).toHaveBeenCalledTimes(1);
      // Native track still attached
      expect(capturedCtx!.tracks).toHaveLength(1);

      vtt.resolve({ text: VTT_FIXTURE_OK });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.annotations).toEqual([
        { id: "c1", startTime: 0, endTime: 2, text: "First caption & more" },
        { id: "c2", startTime: 2, endTime: 4, text: "Second caption" },
      ]);
      expect(onError).not.toHaveBeenCalled();
      expect(capturedCtx!.state.error).toBeNull();
    });

    test("a 404 VTT is reported as non-fatal transcript; player stays usable", async () => {
      const url = "https://example.com/auto-vtt-404.json";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { status: 404 },
      });
      const onPlayerInit = vi.fn();
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onPlayerInit,
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: false,
        source: "transcript",
      });
      expect(onPlayerInit).toHaveBeenCalledTimes(1);
      expect(capturedCtx!.state.error).toBeNull();
      expect(capturedCtx!.transcriptStatus).toBe("error");
      expect(capturedCtx!.annotations).toEqual([]);
      expect(capturedCtx!.tracks).toHaveLength(1);
    });

    test("a malformed VTT is reported as non-fatal transcript", async () => {
      const url = "https://example.com/auto-vtt-malformed.json";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_MALFORMED },
      });
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: false,
        source: "transcript",
      });
      expect(capturedCtx!.transcriptStatus).toBe("error");
      expect(capturedCtx!.state.error).toBeNull();
    });

    test("a partially malformed VTT populates the panel without an error", async () => {
      const url = "https://example.com/auto-vtt-partial.json";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_PARTIAL },
      });
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.annotations).toHaveLength(1);
      expect(capturedCtx!.annotations[0]!.text).toBe("Only good cue");
      expect(onError).not.toHaveBeenCalled();
    });

    test("a VTT result that arrives after a canvas switch is dropped", async () => {
      // MANIFEST_MULTI_CANVAS: canvas 0 = audio, no VTT; canvas 1 = video + VTT.
      const url = "https://example.com/auto-vtt-stale.json";
      const vtt = deferred<{ text: string }>();
      mockFetchRoutes({
        [url]: { json: MANIFEST_MULTI_CANVAS },
        "https://example.com/captions-en.vtt": { promise: vtt.promise },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 1,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });
      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("loading");
      });

      capturedCtx!.actions.switchCanvas(0);
      flushSync();
      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(0);
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });

      vtt.resolve({ text: VTT_FIXTURE_OK });
      await new Promise((r) => setTimeout(r, 50));

      expect(capturedCtx!.annotations).toEqual([]);
      expect(capturedCtx!.transcriptStatus).toBe("ready");
    });

    test("mounting with canvasIndex=1 never loads canvas 0 (no wasted VTT fetch)", async () => {
      // Canvas 0 carries an external VTT (tier 2), canvas 1 embedded text
      // (tier 1). If the initial load ran against the $state default of 0
      // before the prop was reconciled, canvas 0's VTT would be requested and
      // then discarded.
      const url = "https://example.com/auto-initial-index.json";
      const c0Vtt = "https://example.com/initial-index-c0.vtt";
      mockFetchRoutes({
        [url]: { json: MANIFEST_INITIAL_INDEX },
        [c0Vtt]: { text: VTT_FIXTURE_OK },
      });
      const onCanvasChange = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 1,
          annotations: "auto",
          onCanvasChange,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
        expect(capturedCtx!.annotations).toHaveLength(1);
      });
      // Give any stray canvas-0 tier-2 fetch a chance to be issued.
      await new Promise((r) => setTimeout(r, 30));

      const fetchedUrls = (
        globalThis.fetch as ReturnType<typeof vi.fn>
      ).mock.calls.map((call) => String(call[0]));
      expect(fetchedUrls.filter((u) => u === c0Vtt)).toHaveLength(0);
      expect(capturedCtx!.canvasIndex).toBe(1);
      expect(capturedCtx!.mediaUrl).toBe(
        "https://example.com/initial-index-audio1.mp3",
      );
      expect(capturedCtx!.annotations[0]!.text).toBe("Second canvas text.");
      expect(onCanvasChange).not.toHaveBeenCalled();
    });

    test("mounting with an out-of-range canvasIndex falls back to canvas 0", async () => {
      const url = "https://example.com/auto-initial-index-oob.json";
      const c0Vtt = "https://example.com/initial-index-c0.vtt";
      mockFetchRoutes({
        [url]: { json: MANIFEST_INITIAL_INDEX },
        [c0Vtt]: { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 99,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.canvasIndex).toBe(0);
      expect(capturedCtx!.mediaUrl).toBe(
        "https://example.com/initial-index-video0.mp4",
      );
      expect(capturedCtx!.annotations).toHaveLength(2);
    });

    test("two Roots on one page resolve their own VTT transcripts", async () => {
      const urlA = "https://example.com/auto-two-a.json";
      const urlB = "https://example.com/auto-two-b.json";
      const manifestB = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: urlB,
        items: [
          {
            ...MANIFEST_WITH_VTT_CAPTIONS.items[0],
            annotations: [
              {
                id: "https://example.com/canvas/1/annotations/b",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/1/annotations/b/1",
                    type: "Annotation",
                    motivation: "supplementing",
                    body: {
                      id: "https://example.com/captions-b.vtt",
                      type: "Text",
                      format: "text/vtt",
                      language: "en",
                    },
                    target: "https://example.com/canvas/1",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({
        [urlA]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        [urlB]: { json: manifestB },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_OK },
        "https://example.com/captions-b.vtt": { text: VTT_FIXTURE_PARTIAL },
      });
      let ctxA: PlayerContext | null = null;
      let ctxB: PlayerContext | null = null;
      const target2 = document.createElement("div");
      document.body.appendChild(target2);

      mount(Root, {
        target,
        props: {
          manifestUrl: urlA,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            ctxA = ctx;
          }),
        },
      });
      mount(Root, {
        target: target2,
        props: {
          manifestUrl: urlB,
          annotations: "auto",
          children: createContextCapture(target2, (ctx) => {
            ctxB = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(ctxA!.transcriptStatus).toBe("ready");
        expect(ctxB!.transcriptStatus).toBe("ready");
      });
      expect(ctxA!.annotations).toHaveLength(2);
      expect(ctxB!.annotations).toHaveLength(1);
      document.body.removeChild(target2);
    });

    test("clears annotations and status when a canvas switch lands on a non-AV canvas", async () => {
      // Canvas 0: embedded transcript, tier 1 populates it. Canvas 1: an
      // Image canvas — loadCanvas throws before it can re-derive anything.
      // The failed switch must not leave canvas 0's transcript on screen.
      const url = "https://example.com/auto-switch-to-non-av.json";
      const manifest = {
        ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
        id: url,
        items: [
          ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT.items,
          {
            id: "https://example.com/emb/canvas/2",
            type: "Canvas",
            width: 100,
            height: 100,
            items: [
              {
                id: "https://example.com/emb/canvas/2/page/1",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/emb/canvas/2/page/1/annotation/1",
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: "https://example.com/emb/image.jpg",
                      type: "Image",
                      format: "image/jpeg",
                    },
                    target: "https://example.com/emb/canvas/2",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({ [url]: { json: manifest } });
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onError,
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.annotations.length).toBeGreaterThan(0);
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });

      capturedCtx!.actions.switchCanvas(1);
      flushSync();

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: true,
        source: "canvas",
      });
      expect(capturedCtx!.annotations).toEqual([]);
      expect(capturedCtx!.transcriptStatus).toBe("idle");
    });

    test("only embedded motivations supplementing/commenting/tagging count as tier 1; others fall through to tier 2", async () => {
      // A canvas with a single "describing" annotation (not in the allow
      // list) plus an external VTT supplement must fetch the VTT — the
      // describing note must not permanently suppress tier 2.
      const url = "https://example.com/auto-describing-plus-vtt.json";
      const manifest = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: url,
        items: [
          {
            ...MANIFEST_WITH_VTT_CAPTIONS.items[0],
            annotations: [
              ...MANIFEST_WITH_VTT_CAPTIONS.items[0]!.annotations,
              {
                id: "https://example.com/canvas/1/annotations/note",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/1/annotations/note/1",
                    type: "Annotation",
                    motivation: "describing",
                    body: {
                      type: "TextualBody",
                      value: "An editorial note, not the transcript.",
                      format: "text/plain",
                    },
                    target: "https://example.com/canvas/1#t=0,1",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({
        [url]: { json: manifest },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.annotations).toEqual([
        { id: "c1", startTime: 0, endTime: 2, text: "First caption & more" },
        { id: "c2", startTime: 2, endTime: 4, text: "Second caption" },
      ]);
    });

    test("prefers an embedded commenting annotation (AVAnnotate-shaped) over an external VTT supplement", async () => {
      const url = "https://example.com/auto-commenting-plus-vtt.json";
      const manifest = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: url,
        items: [
          {
            ...MANIFEST_WITH_VTT_CAPTIONS.items[0],
            annotations: [
              ...MANIFEST_WITH_VTT_CAPTIONS.items[0]!.annotations,
              {
                id: "https://example.com/canvas/1/annotations/comment",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/1/annotations/comment/1",
                    type: "Annotation",
                    motivation: "commenting",
                    body: {
                      type: "TextualBody",
                      value: "This is the real transcript text.",
                      format: "text/plain",
                    },
                    target: "https://example.com/canvas/1#t=0,1",
                  },
                ],
              },
            ],
          },
        ],
      };
      // The VTT route is deliberately absent from mockFetchRoutes: if tier 1
      // wins as expected, tier 2 never fetches it.
      mockFetchRoutes({ [url]: { json: manifest } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.annotations).toEqual([
        {
          id: "https://example.com/canvas/1/annotations/comment/1",
          startTime: 0,
          endTime: 1,
          text: "This is the real transcript text.",
        },
      ]);
    });

    test('re-derives when the prop flips from an array to "auto" without a canvas switch', async () => {
      const url = "https://example.com/auto-prop-flip-to-auto.json";
      mockFetchRoutes({ [url]: { json: MANIFEST_WITH_EMBEDDED_TRANSCRIPT } });
      const given = [{ id: "p1", startTime: 0, endTime: 1, text: "From prop" }];
      let capturedCtx: PlayerContext | null = null;

      const wrapper = mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          annotations: given,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.mediaUrl).not.toBe("");
      });
      expect(capturedCtx!.annotations).toEqual(given);
      expect(capturedCtx!.transcriptStatus).toBe("idle");

      wrapper.setAnnotations("auto");
      flushSync();

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.annotations).not.toEqual(given);
      expect(capturedCtx!.annotations.length).toBeGreaterThan(0);
    });

    test('re-derives when the prop flips from "auto" to an array without a canvas switch', async () => {
      const url = "https://example.com/auto-prop-flip-to-array.json";
      mockFetchRoutes({ [url]: { json: MANIFEST_WITH_EMBEDDED_TRANSCRIPT } });
      let capturedCtx: PlayerContext | null = null;

      const wrapper = mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          annotations: "auto",
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.annotations.length).toBeGreaterThan(0);

      const given = [
        { id: "p1", startTime: 0, endTime: 1, text: "Consumer-supplied" },
      ];
      wrapper.setAnnotations(given);
      flushSync();

      expect(capturedCtx!.annotations).toEqual(given);
      expect(capturedCtx!.transcriptStatus).toBe("idle");
    });

    test('drops an in-flight VTT fetch when the prop flips "auto" -> array', async () => {
      const url = "https://example.com/auto-flip-drops-inflight-vtt.json";
      const gate = deferred<{ text: string }>();
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { promise: gate.promise },
      });
      let capturedCtx: PlayerContext | null = null;

      const wrapper = mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          annotations: "auto",
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("loading");
      });

      const given = [
        { id: "p1", startTime: 0, endTime: 1, text: "Consumer-supplied" },
      ];
      wrapper.setAnnotations(given);
      flushSync();
      expect(capturedCtx!.annotations).toEqual(given);
      expect(capturedCtx!.transcriptStatus).toBe("idle");

      // The fetch started before the flip must not land on the consumer's
      // array (README: status is "idle" when you pass annotations yourself).
      gate.resolve({ text: VTT_FIXTURE_OK });
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(capturedCtx!.annotations).toEqual(given);
      expect(capturedCtx!.transcriptStatus).toBe("idle");
    });

    test("a failed canvas switch clears tracks, chapters and the current canvas, so a later re-derive resurrects nothing", async () => {
      const url = "https://example.com/auto-failed-canvas-clears-tracks.json";
      const vttUrl = "https://example.com/captions-fr.vtt";
      const canvas0 = MANIFEST_WITH_VTT_CAPTIONS.items[0]!;
      const manifest = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: url,
        items: [
          {
            ...canvas0,
            // Canvas 0 also carries an embedded (tier-1) transcript. If a
            // failed switch left it as the "current canvas", a later flip
            // back to "auto" would re-derive *this* text next to the error
            // banner — no fetch involved, so clearing tracks alone does not
            // catch it.
            annotations: [
              ...canvas0.annotations,
              {
                id: "https://example.com/canvas/1/annotations/2",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/1/annotations/2/annotation/1",
                    type: "Annotation",
                    motivation: "supplementing",
                    body: {
                      type: "TextualBody",
                      value: "Embedded transcript line",
                      format: "text/plain",
                    },
                    target: "https://example.com/canvas/1#t=0,5",
                  },
                ],
              },
            ],
          },
          {
            id: "https://example.com/canvas/2",
            type: "Canvas",
            width: 100,
            height: 100,
            items: [
              {
                id: "https://example.com/canvas/2/page/1",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/2/page/1/annotation/1",
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: "https://example.com/image.jpg",
                      type: "Image",
                      format: "image/jpeg",
                    },
                    target: "https://example.com/canvas/2",
                  },
                ],
              },
            ],
          },
        ],
        // Canvas 0 has a chapter range; canvas 1 has none. A failed switch
        // must not leave canvas 0's chapters in the navigation.
        structures: [
          {
            id: "https://example.com/range/1",
            type: "Range",
            label: { en: ["Introduction"] },
            items: [
              { id: "https://example.com/canvas/1#t=0,5", type: "Canvas" },
            ],
          },
        ],
      };
      mockFetchRoutes({
        [url]: { json: manifest },
        [vttUrl]: { text: VTT_FIXTURE_OK },
      });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const vttCalls = () =>
        fetchMock.mock.calls.filter((c) => String(c[0]) === vttUrl).length;
      const onError = vi.fn();
      let capturedCtx: PlayerContext | null = null;

      const wrapper = mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          annotations: "auto",
          onError,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      expect(capturedCtx!.tracks).toHaveLength(1);
      expect(capturedCtx!.annotations.length).toBeGreaterThan(0);
      expect(capturedCtx!.chapters).toHaveLength(1);
      const callsAfterFirstCanvas = vttCalls();

      capturedCtx!.actions.switchCanvas(1);
      flushSync();
      await vi.waitFor(() => {
        expect(capturedCtx!.state.error).not.toBeNull();
      });

      // The non-AV canvas has no tracks or chapters of its own; canvas 0's
      // must not linger.
      expect(capturedCtx!.tracks).toEqual([]);
      expect(capturedCtx!.chapters).toEqual([]);

      // A mode flip back to "auto" re-derives — it must not resurrect the
      // previous canvas's embedded transcript or its VTT.
      wrapper.setAnnotations([]);
      flushSync();
      wrapper.setAnnotations("auto");
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(capturedCtx!.annotations).toEqual([]);
      expect(capturedCtx!.transcriptStatus).toBe("idle");
      expect(vttCalls()).toBe(callsAfterFirstCanvas);
    });

    test('flipping to "auto" with no resolved canvas takes ownership and clears the stale array', async () => {
      // After a failed canvas there is nothing to derive against, but "auto"
      // still means Root owns `annotations`: the consumer's old array must not
      // keep rendering next to the error banner.
      const url = "https://example.com/auto-flip-no-canvas.json";
      const vttUrl = "https://example.com/captions-fr.vtt";
      const canvas0 = MANIFEST_WITH_VTT_CAPTIONS.items[0]!;
      const manifest = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: url,
        items: [
          canvas0,
          {
            id: "https://example.com/canvas/2",
            type: "Canvas",
            width: 100,
            height: 100,
            items: [
              {
                id: "https://example.com/canvas/2/page/1",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/2/page/1/annotation/1",
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: "https://example.com/image.jpg",
                      type: "Image",
                      format: "image/jpeg",
                    },
                    target: "https://example.com/canvas/2",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({
        [url]: { json: manifest },
        [vttUrl]: { text: VTT_FIXTURE_OK },
      });
      const given = [
        { id: "given1", startTime: 0, endTime: 4, text: "Consumer supplied" },
      ];
      let capturedCtx: PlayerContext | null = null;

      const wrapper = mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          canvasIndex: 0,
          annotations: given,
          onError: () => {},
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.annotations).toEqual(given);
      });

      capturedCtx!.actions.switchCanvas(1);
      flushSync();
      await vi.waitFor(() => {
        expect(capturedCtx!.state.error).not.toBeNull();
      });

      wrapper.setAnnotations("auto");
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(capturedCtx!.annotations).toEqual([]);
      expect(capturedCtx!.transcriptStatus).toBe("idle");
    });

    test("ignores blank embedded annotations so the VTT tier still wins", async () => {
      // buildTranscriptAnnotations can return TextualBody annotations whose
      // text is "". Those must not count as a tier-1 hit — otherwise the panel
      // shows blank segments and the canvas's real VTT is never fetched.
      const url = "https://example.com/auto-blank-embedded.json";
      const vttUrl = "https://example.com/captions-fr.vtt";
      const canvas0 = MANIFEST_WITH_VTT_CAPTIONS.items[0]!;
      const manifest = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: url,
        items: [
          {
            ...canvas0,
            annotations: [
              ...canvas0.annotations,
              {
                id: "https://example.com/canvas/1/annotations/2",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/1/annotations/2/annotation/1",
                    type: "Annotation",
                    motivation: "supplementing",
                    body: {
                      type: "TextualBody",
                      value: "",
                      format: "text/plain",
                    },
                    target: "https://example.com/canvas/1#t=0,5",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({
        [url]: { json: manifest },
        [vttUrl]: { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(TestRootAnnotationsWrapper, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
      });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]) === vttUrl).length,
      ).toBe(1);
      expect(capturedCtx!.annotations.length).toBe(2);
      expect(capturedCtx!.annotations.every((a) => a.text.trim() !== "")).toBe(
        true,
      );
    });
  });

  describe('Root + Viewer + Transcript wiring (annotations="auto")', () => {
    // These mount the real composition — Root deriving annotations, Viewer
    // reading textTracks, and Transcript publishing transcriptPopulated on
    // the same PlayerContext instance — rather than a hand-built mock
    // context, so a wiring mistake between the two components (writing to a
    // different context object, gating on the wrong field, effect ordering)
    // would actually fail these tests.
    test("hides the native track once the VTT-derived panel populates", async () => {
      const url = "https://example.com/wiring-vtt.json";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(TestRootViewerTranscript, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
        expect(capturedCtx!.annotations.length).toBe(2);
      });

      const video = target.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      await vi.waitFor(() => {
        expect(video.textTracks).toHaveLength(1);
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });
    });

    test("leaves the native track showing when nothing renders the transcript panel", async () => {
      const url = "https://example.com/wiring-vtt-no-panel.json";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(TestRootViewerTranscript, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          renderTranscript: false,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
        expect(capturedCtx!.annotations.length).toBe(2);
      });

      const video = target.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      await vi.waitFor(() => {
        expect(video.textTracks).toHaveLength(1);
      });
      // No <Transcript> in the tree, so transcriptPopulated is never set —
      // the track keeps its browser-default mode.
      await new Promise((r) => setTimeout(r, 50));
      expect(video.textTracks[0]!.mode).toBe("showing");
    });

    test("does not hide the next canvas's captions on the previous canvas's populated panel", async () => {
      // Viewer's effect runs before Transcript's in tree order, so on a canvas
      // switch it sees canvas A's `transcriptPopulated` unless loadCanvas
      // clears it. If it does not, canvas B's tracks are hidden and the latch
      // is spent before B's panel populates — and when B's transcript fails,
      // the viewer is left with neither captions nor transcript.
      const url = "https://example.com/wiring-switch-to-failing-vtt.json";
      const vttA = "https://example.com/captions-fr.vtt";
      const vttB = "https://example.com/canvas-2-missing.vtt";
      const manifest = {
        ...MANIFEST_WITH_VTT_CAPTIONS,
        id: url,
        items: [
          MANIFEST_WITH_VTT_CAPTIONS.items[0],
          {
            id: "https://example.com/canvas/2",
            type: "Canvas",
            duration: 120,
            items: [
              {
                id: "https://example.com/canvas/2/page/1",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/2/page/1/annotation/1",
                    type: "Annotation",
                    motivation: "painting",
                    body: {
                      id: "https://example.com/video-2.mp4",
                      type: "Video",
                      format: "video/mp4",
                    },
                    target: "https://example.com/canvas/2",
                  },
                ],
              },
            ],
            annotations: [
              {
                id: "https://example.com/canvas/2/annotations/1",
                type: "AnnotationPage",
                items: [
                  {
                    id: "https://example.com/canvas/2/annotations/1/annotation/1",
                    type: "Annotation",
                    motivation: "supplementing",
                    body: {
                      id: vttB,
                      type: "Text",
                      format: "text/vtt",
                      language: "en",
                      label: { en: ["Captions"] },
                    },
                    target: "https://example.com/canvas/2",
                  },
                ],
              },
            ],
          },
        ],
      };
      mockFetchRoutes({
        [url]: { json: manifest },
        [vttA]: { text: VTT_FIXTURE_OK },
        [vttB]: { status: 404, text: "" },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(TestRootViewerTranscript, {
        target,
        props: {
          manifestUrl: url,
          annotations: "auto",
          onError: () => {},
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      // Canvas A: panel populates, its native track goes hidden.
      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("ready");
        expect(capturedCtx!.annotations.length).toBe(2);
      });
      const videoA = target.querySelector("video") as HTMLVideoElement;
      await vi.waitFor(() => {
        expect(videoA.textTracks[0]!.mode).toBe("hidden");
      });

      // Canvas B: its VTT 404s, so the panel never populates.
      capturedCtx!.actions.switchCanvas(1);
      flushSync();
      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("error");
      });
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      const videoB = target.querySelector("video") as HTMLVideoElement;
      expect(capturedCtx!.tracks.map((t) => t.src)).toEqual([vttB]);
      await vi.waitFor(() => {
        expect(videoB.textTracks).toHaveLength(1);
      });
      expect(capturedCtx!.annotations).toEqual([]);
      expect(target.textContent).toContain("No transcript available.");
      expect(videoB.textTracks[0]!.mode).not.toBe("hidden");
    });
  });

  describe("Root + Viewer + Transcript wiring (annotations array)", () => {
    // The documented primary path: the consumer passes their own annotations.
    // loadCanvas clears transcriptPopulated on every canvas load, so Transcript
    // has to re-publish it truthfully even though the array itself never
    // changes — otherwise the flag latches false and native captions are never
    // hidden for array consumers at all.
    const given = [
      { id: "given1", startTime: 0, endTime: 4, text: "Consumer supplied" },
      { id: "given2", startTime: 4, endTime: 8, text: "Second line" },
    ];

    test("hides the native track for a consumer-supplied annotations array", async () => {
      const url = "https://example.com/wiring-array-annotations.json";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        "https://example.com/captions-fr.vtt": { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(TestRootViewerTranscript, {
        target,
        props: {
          manifestUrl: url,
          annotations: given,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.tracks).toHaveLength(1);
        expect(capturedCtx!.annotations).toEqual(given);
      });

      const video = target.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      await vi.waitFor(() => {
        expect(video.textTracks).toHaveLength(1);
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });
    });

    test("hides the next canvas's native track after a canvas switch in array mode", async () => {
      const url = "https://example.com/wiring-array-multi-canvas.json";
      mockFetchRoutes({
        [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } },
        "https://example.com/captions-en.vtt": { text: VTT_FIXTURE_OK },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(TestRootViewerTranscript, {
        target,
        props: {
          manifestUrl: url,
          annotations: given,
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.annotations).toEqual(given);
      });

      capturedCtx!.actions.switchCanvas(1);
      flushSync();
      await vi.waitFor(() => {
        expect(capturedCtx!.canvasIndex).toBe(1);
        expect(capturedCtx!.tracks).toHaveLength(1);
      });

      const video = target.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      await vi.waitFor(() => {
        expect(video.textTracks).toHaveLength(1);
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });
    });

    test('clears transcriptPopulated when the prop flips array -> "auto" and the VTT fails', async () => {
      // A mode flip is a transcript-ownership change with the same convergence
      // property as loadCanvas: Transcript re-publishes `true` on the next
      // flush if the panel is still populated. Without the clear, a flip whose
      // re-derive ends up EMPTY leaves a stale `true` on the context.
      const url = "https://example.com/wiring-array-flip-to-auto.json";
      const vtt = "https://example.com/captions-fr.vtt";
      mockFetchRoutes({
        [url]: { json: MANIFEST_WITH_VTT_CAPTIONS },
        [vtt]: { status: 404, text: "" },
      });
      let capturedCtx: PlayerContext | null = null;

      const wrapper = mount(TestRootViewerTranscript, {
        target,
        props: {
          manifestUrl: url,
          annotations: given,
          onError: () => {},
          onResult: (ctx: PlayerContext) => {
            capturedCtx = ctx;
          },
        },
      });

      // Array mode: the panel populates and the native track goes hidden.
      await vi.waitFor(() => {
        expect(capturedCtx!.tracks).toHaveLength(1);
        expect(capturedCtx!.annotations).toEqual(given);
        expect(capturedCtx!.transcriptPopulated).toBe(true);
      });
      const video = target.querySelector("video") as HTMLVideoElement;
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });

      // Flip to "auto": the canvas's only VTT 404s, so the panel empties.
      wrapper.setAnnotations("auto");
      flushSync();
      await vi.waitFor(() => {
        expect(capturedCtx!.transcriptStatus).toBe("error");
      });
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(capturedCtx!.annotations).toEqual([]);
      expect(target.textContent).toContain("No transcript available.");
      expect(capturedCtx!.transcriptPopulated).toBe(false);
      // The one-time write already happened for this (canvasIndex, mediaUrl)
      // load and is never undone — a flip does not re-arm Viewer's latch.
      expect(video.textTracks[0]!.mode).toBe("hidden");
    });
  });

  describe("preprocessManifest", () => {
    test("runs before validation: a manifest with a missing type loads once the hook adds it", async () => {
      const url = "https://example.com/preprocess-type.json";
      const { type: _omitted, ...withoutType } = MANIFEST_WITHOUT_CHAPTERS;
      mockFetchRoutes({ [url]: { json: { ...withoutType, id: url } } });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          preprocessManifest: (raw) => ({
            ...(raw as Record<string, unknown>),
            type: "Manifest",
          }),
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.mediaUrl).toBe("https://example.com/audio.mp3");
      });
      expect(capturedCtx!.state.error).toBeNull();
    });

    test("the same manifest without the hook is a fatal manifest error", async () => {
      const url = "https://example.com/preprocess-type-nohook.json";
      const { type: _omitted, ...withoutType } = MANIFEST_WITHOUT_CHAPTERS;
      mockFetchRoutes({ [url]: { json: { ...withoutType, id: url } } });
      const onError = vi.fn();

      mount(Root, { target, props: { manifestUrl: url, onError } });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: true,
        source: "manifest",
      });
    });

    test("raw is the preprocessed document: chapters come from the hook's structures", async () => {
      const url = "https://example.com/preprocess-raw.json";
      mockFetchRoutes({
        [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
      });
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          preprocessManifest: (raw) => ({
            ...(raw as Record<string, unknown>),
            structures: MANIFEST_WITH_CHAPTERS.structures,
          }),
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });

      await vi.waitFor(() => {
        expect(capturedCtx!.chapters).toHaveLength(2);
      });
      expect(capturedCtx!.chapters[0]!.label).toBe("Introduction");
    });

    test("a throwing hook is reported as a fatal manifest error", async () => {
      const url = "https://example.com/preprocess-throws.json";
      mockFetchRoutes({
        [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
      });
      const onError = vi.fn();

      mount(Root, {
        target,
        props: {
          manifestUrl: url,
          preprocessManifest: () => {
            throw new Error("hook failed");
          },
          onError,
        },
      });

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError.mock.calls[0]![0].message).toBe("hook failed");
      expect(onError.mock.calls[0]![1]).toEqual({
        fatal: true,
        source: "manifest",
      });
    });

    test("bypasses the module cache entirely when set — including delete on error", async () => {
      const url = "https://example.com/preprocess-cache.json";
      mockFetchRoutes({
        [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
      });

      // 1. A plain instance populates the cache.
      mount(Root, { target, props: { manifestUrl: url } });
      await vi.waitFor(() => {
        expect(manifestCache.has(url)).toBe(true);
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // 2. A preprocessing instance whose hook throws: fetches again (no cache
      //    read), does not evict the plain entry (no cache delete).
      const target2 = document.createElement("div");
      document.body.appendChild(target2);
      const onError = vi.fn();
      mount(Root, {
        target: target2,
        props: {
          manifestUrl: url,
          preprocessManifest: () => {
            throw new Error("nope");
          },
          onError,
        },
      });
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(manifestCache.has(url)).toBe(true);

      // 3. A second plain instance is served from the surviving cache entry.
      const target3 = document.createElement("div");
      document.body.appendChild(target3);
      mount(Root, { target: target3, props: { manifestUrl: url } });
      await new Promise((r) => setTimeout(r, 30));
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      document.body.removeChild(target2);
      document.body.removeChild(target3);
    });
  });

  describe("captions machine wiring", () => {
    test("USER_TOGGLE mid-load wins over a later TRANSCRIPT_POPULATED", async () => {
      mockFetchManifest(MANIFEST_WITH_VTT_CAPTIONS);
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/captions-mid-load-toggle.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });
      flushSync();

      await vi.waitFor(() => {
        expect(capturedCtx?.captionsState).toBe("browserDefault");
      });

      // User toggles captions off before the transcript panel populates.
      capturedCtx!.toggleCaptions();
      flushSync();
      expect(capturedCtx!.captionsState).toBe("hidden");

      // The transcript panel populates afterwards — must NOT override it.
      capturedCtx!.transcriptPopulated = true;
      flushSync();
      expect(capturedCtx!.captionsState).toBe("hidden");
    });

    test("a native CC menu change (via Viewer) updates the machine end-to-end", async () => {
      mockFetchManifest(MANIFEST_WITH_VTT_CAPTIONS);
      let capturedCtx: PlayerContext | null = null;

      mount(Root, {
        target,
        props: {
          manifestUrl: "https://example.com/captions-native-change.json",
          children: createContextCapture(target, (ctx) => {
            capturedCtx = ctx;
          }),
        },
      });
      flushSync();

      await vi.waitFor(() => {
        expect(capturedCtx?.captionsState).toBe("browserDefault");
      });

      capturedCtx!.reportNativeCaptionChange("hidden");
      flushSync();
      expect(capturedCtx!.captionsState).toBe("hidden");
    });
  });
});
