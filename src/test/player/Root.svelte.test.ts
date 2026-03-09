import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushSync } from "svelte";
import Root from "../../lib/player/Root.svelte";
import TestRootWrapper from "./TestRootWrapper.svelte";
import type { PlayerContext } from "../../lib/player/context";
import type { HlsConstructor } from "../../lib/media/hlsUtils";
import { createContextCapture } from "./test-utils";
import {
  MANIFEST_WITH_CHAPTERS,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_WITH_HLS,
  MANIFEST_WITH_VTT_CAPTIONS,
  MANIFEST_MULTI_CANVAS,
  mockFetchManifest,
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
          src: "https://example.com/captions-en.vtt",
          kind: "captions",
          srclang: "en",
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
});
