import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import type { PlayerContext, PlayerState } from "../../lib/player/context";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import TestContextHarness from "./TestContextHarness.svelte";
import TestContextConsumer from "./TestContextConsumer.svelte";

describe("getPlayerContext", () => {
  test("throws error when no context available", () => {
    // Consumer without provider should throw
    expect(() => {
      render(TestContextConsumer, { props: { onResult: () => {} } });
      flushSync();
    }).toThrow();
  });

  test("returns context when available", () => {
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

    // Provider (harness) sets context; consumer reads it back.
    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: TestContextConsumer,
        props: {
          onResult: (ctx: PlayerContext) => {
            capturedResult = ctx;
          },
        },
      },
    });
    flushSync();

    expect(capturedResult).toBe(mockContext);
    expect(container.querySelector('[data-testid="consumer"]')).toBeTruthy();
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
