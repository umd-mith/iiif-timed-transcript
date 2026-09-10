import { describe, test, expect, vi, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import type { Snippet } from "svelte";
import type { PlayerContext, PlayerState } from "../../lib/player/context";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import TestContextProvider from "./TestContextProvider.svelte";
import TestContextConsumer from "./TestContextConsumer.svelte";

describe("getPlayerContext", () => {
  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("throws error when no context available", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    // Consumer without provider should throw
    expect(() => {
      mount(TestContextConsumer, { target, props: { onResult: () => {} } });
      flushSync();
    }).toThrow();
  });

  test("returns context when available", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext: PlayerContext = {
      state: {
        isPlaying: false,
        isBuffering: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        isReady: false,
        error: null,
        hasEnded: false,
        isSeeking: false,
      },
      mediaElement: null,
      mediaUrl: "https://example.com/test.mp3",
      mediaType: "audio",
      posterUrl: undefined,
      mediaStrategy: "native",
      hlsAdapter: null,
      dashAdapter: null,
      annotations: [],
      chapters: [],
      activeChapterId: null,
      tracks: [],
      captionTracks: [],
      loadNonce: 0,
      canvasIndex: 0,
      canvasCount: 1,
      canvases: [],
      transcriptStatus: "idle",
      transcriptPopulated: false,
      captionsState: "unavailable",
      toggleCaptions: vi.fn(),
      reportNativeCaptionChange: vi.fn(),
      reportCaptionTracks: vi.fn(),
      actions: {
        play: vi.fn(),
        pause: vi.fn(),
        seekTo: vi.fn(),
        setPlaybackRate: vi.fn(),
        retry: vi.fn(),
        seekToChapter: vi.fn(),
        switchCanvas: vi.fn(),
      },
    };

    let capturedResult: PlayerContext | null = null;

    // Mount provider with consumer as child
    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: ((_anchor: Node) => {
          mount(TestContextConsumer, {
            target,
            anchor: _anchor,
            props: {
              onResult: (ctx: PlayerContext) => {
                capturedResult = ctx;
              },
            },
          });
        }) as unknown as Snippet,
      },
    });
    flushSync();

    expect(capturedResult).toBe(mockContext);
    expect(target.querySelector('[data-testid="consumer"]')).toBeTruthy();
  });
});

describe("PlayerContext chapter types", () => {
  test("PlayerContext includes chapters and activeChapterId", () => {
    const mockState: PlayerState = {
      isPlaying: false,
      isBuffering: false,
      currentTime: 15,
      duration: 90,
      playbackRate: 1,
      isReady: true,
      error: null,
      hasEnded: false,
      isSeeking: false,
    };

    const chapters: Chapter[] = [
      { id: "ch1", label: "Intro", startTime: 0, endTime: 30 },
      { id: "ch2", label: "Main", startTime: 30, endTime: 90 },
    ];

    const mockContext: PlayerContext = {
      state: mockState,
      mediaElement: null,
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
      posterUrl: undefined,
      mediaStrategy: "native",
      hlsAdapter: null,
      dashAdapter: null,
      annotations: [],
      chapters,
      activeChapterId: "ch1",
      tracks: [],
      captionTracks: [],
      loadNonce: 0,
      canvasIndex: 0,
      canvasCount: 1,
      canvases: [],
      transcriptStatus: "idle",
      transcriptPopulated: false,
      captionsState: "unavailable",
      toggleCaptions: () => {},
      reportNativeCaptionChange: () => {},
      reportCaptionTracks: () => {},
      actions: {
        play: async () => {},
        pause: () => {},
        seekTo: () => {},
        setPlaybackRate: () => {},
        retry: async () => {},
        seekToChapter: () => {},
        switchCanvas: () => {},
      },
    };

    expect(mockContext.chapters).toHaveLength(2);
    expect(mockContext.activeChapterId).toBe("ch1");
    expect(mockContext.actions.seekToChapter).toBeDefined();
  });
});
