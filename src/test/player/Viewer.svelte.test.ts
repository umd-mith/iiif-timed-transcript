import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Viewer from "../../lib/player/Viewer.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";
import { createReactiveMockPlayerContext } from "./reactive-context.svelte";
import type { TrackDefinition } from "../../lib/player/context";

describe("Viewer", () => {
  test("renders audio element when mediaType is audio", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio");
    expect(audioElement).not.toBeNull();
    expect(audioElement?.src).toBe("https://example.com/audio.mp3");
  });

  test("renders video element when mediaType is video", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const videoElement = container.querySelector("video");
    expect(videoElement).not.toBeNull();
    expect(videoElement?.src).toBe("https://example.com/video.mp4");
  });

  test("applies custom class name", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
        props: {
          class: "custom-viewer",
        },
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio");
    expect(audioElement?.className).toContain("custom-viewer");
  });

  test("sets crossOrigin attribute", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
        props: {
          crossOrigin: "use-credentials",
        },
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.crossOrigin).toBe("use-credentials");
  });

  test("disables native controls by default", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.controls).toBe(false);
  });

  test("can enable native controls", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
        props: { controls: true },
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.controls).toBe(true);
  });

  test('sets preload to "auto" by default', () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.preload).toBe("auto");
  });

  test("allows overriding preload attribute", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
        props: { preload: "metadata" },
      },
    });
    flushSync();

    const audioElement = container.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.preload).toBe("metadata");
  });

  test("does not set src attribute when mediaStrategy is hls-js", () => {
    const mockAdapter = {
      attach: vi.fn(),
      detach: vi.fn(),
      isSupported: () => true,
    };

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/stream/master.m3u8",
      mediaType: "video",
      mediaStrategy: "hls-js",
      hlsAdapter: mockAdapter,
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const videoElement = container.querySelector("video") as HTMLVideoElement;
    expect(videoElement).not.toBeNull();
    // When hls-js strategy, the src should NOT be set directly — adapter manages the source
    expect(videoElement?.getAttribute("src")).toBeNull();
  });

  test("sets src attribute when mediaStrategy is native", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
      mediaStrategy: "native",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const videoElement = container.querySelector("video") as HTMLVideoElement;
    expect(videoElement?.src).toBe("https://example.com/video.mp4");
  });

  describe("HLS adapter wiring", () => {
    test("attaches adapter when mediaStrategy is hls-js", async () => {
      const mockAdapter = {
        attach: vi.fn(),
        detach: vi.fn(),
        isSupported: () => true,
      };

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/stream/master.m3u8",
        mediaType: "video",
        mediaStrategy: "hls-js",
        hlsAdapter: mockAdapter,
      });

      render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      await vi.waitFor(() => {
        expect(mockAdapter.attach).toHaveBeenCalledWith(
          expect.any(HTMLVideoElement),
          "https://example.com/stream/master.m3u8",
          expect.objectContaining({ onError: expect.any(Function) }),
        );
      });
    });

    test("does not attach adapter when mediaStrategy is native", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        mediaStrategy: "native",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      // No adapter to attach — nothing to assert beyond no errors
      const videoElement = container.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.src).toBe("https://example.com/video.mp4");
    });

    // Note: unmount/detach behavior is tested implicitly through the $effect cleanup.
    // Explicitly testing unmount via removeChild is unreliable in Svelte's test environment.
  });

  describe("DASH adapter wiring", () => {
    test("attaches adapter when mediaStrategy is dash-js", async () => {
      const mockAdapter = {
        attach: vi.fn(),
        detach: vi.fn(),
        isSupported: () => true,
      };

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/stream.mpd",
        mediaType: "video",
        mediaStrategy: "dash-js",
        dashAdapter: mockAdapter,
      });

      render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      await vi.waitFor(() => {
        expect(mockAdapter.attach).toHaveBeenCalledWith(
          expect.any(HTMLVideoElement),
          "https://example.com/stream.mpd",
          expect.objectContaining({ onError: expect.any(Function) }),
        );
      });
    });

    test("does not set src attribute when mediaStrategy is dash-js", () => {
      const mockAdapter = {
        attach: vi.fn(),
        detach: vi.fn(),
        isSupported: () => true,
      };

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/stream.mpd",
        mediaType: "video",
        mediaStrategy: "dash-js",
        dashAdapter: mockAdapter,
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const videoElement = container.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.getAttribute("src")).toBeNull();
    });
  });

  describe("caption tracks", () => {
    test("renders track elements inside video when tracks prop is provided", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            tracks: [
              {
                src: "/captions-en.vtt",
                kind: "captions",
                srclang: "en",
                label: "English",
              },
              {
                src: "/subs-es.vtt",
                kind: "subtitles",
                srclang: "es",
                label: "Spanish",
              },
            ],
          },
        },
      });
      flushSync();

      const tracks = container.querySelectorAll("video track");
      expect(tracks).toHaveLength(2);

      const firstTrack = tracks[0] as HTMLTrackElement;
      expect(firstTrack.src).toContain("/captions-en.vtt");
      expect(firstTrack.kind).toBe("captions");
      expect(firstTrack.srclang).toBe("en");
      expect(firstTrack.label).toBe("English");

      const secondTrack = tracks[1] as HTMLTrackElement;
      expect(secondTrack.kind).toBe("subtitles");
      expect(secondTrack.srclang).toBe("es");
    });

    test("marks first captions track as default", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            tracks: [
              {
                src: "/captions.vtt",
                kind: "captions",
                srclang: "en",
                label: "English",
              },
            ],
          },
        },
      });
      flushSync();

      const track = container.querySelector("video track") as HTMLTrackElement;
      expect(track.default).toBe(true);
    });

    test("does not render tracks inside audio elements", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            tracks: [
              {
                src: "/captions.vtt",
                kind: "captions",
                srclang: "en",
                label: "English",
              },
            ],
          },
        },
      });
      flushSync();

      const tracks = container.querySelectorAll("track");
      expect(tracks).toHaveLength(0);
    });
  });

  describe("auto-discovered caption tracks", () => {
    test("renders tracks from context when no tracks prop provided", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: [
          {
            src: "https://example.com/captions-en.vtt",
            kind: "captions",
            srclang: "en",
            label: "English",
          },
        ],
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const tracks = container.querySelectorAll("video track");
      expect(tracks).toHaveLength(1);
      const track = tracks[0] as HTMLTrackElement;
      expect(track.src).toContain("captions-en.vtt");
      expect(track.kind).toBe("captions");
      expect(track.srclang).toBe("en");
    });

    test("explicit tracks prop overrides context tracks", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: [
          {
            src: "https://example.com/auto-en.vtt",
            kind: "captions",
            srclang: "en",
            label: "Auto English",
          },
        ],
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            tracks: [
              {
                src: "/custom.vtt",
                kind: "subtitles",
                srclang: "fr",
                label: "French",
              },
            ],
          },
        },
      });
      flushSync();

      const tracks = container.querySelectorAll("video track");
      expect(tracks).toHaveLength(1);
      const track = tracks[0] as HTMLTrackElement;
      expect(track.src).toContain("/custom.vtt");
      expect(track.kind).toBe("subtitles");
      expect(track.srclang).toBe("fr");
    });

    test("renders no tracks for audio even with context tracks", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
        tracks: [
          {
            src: "https://example.com/captions.vtt",
            kind: "captions",
            srclang: "en",
            label: "English",
          },
        ],
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const tracks = container.querySelectorAll("track");
      expect(tracks).toHaveLength(0);
    });
  });

  describe("native media error handling", () => {
    test("sets ctx.state.error on audio error event", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Simulate a network error (code 2)
      Object.defineProperty(audio, "error", {
        value: { code: 2, message: "" },
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error).toBeInstanceOf(Error);
      expect(mockContext.state.error?.message).toContain("network connection");
    });

    test("sets ctx.state.error on video error event", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const video = container.querySelector("video") as HTMLVideoElement;

      // Simulate unsupported format (code 4)
      Object.defineProperty(video, "error", {
        value: { code: 4, message: "" },
      });
      video.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error).toBeInstanceOf(Error);
      expect(mockContext.state.error?.message).toContain("not supported");
    });

    test("treats decode error (code 3) as fatal when no metadata loaded", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // duration defaults to NaN when no metadata loaded
      Object.defineProperty(audio, "error", {
        value: { code: 3, message: "" },
        configurable: true,
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error?.message).toBe(
        "This media file could not be played. The file may be damaged.",
      );
    });

    test("ignores transient decode error (code 3) when metadata already loaded", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Simulate metadata already loaded (duration is set)
      Object.defineProperty(audio, "duration", {
        value: 5102,
        configurable: true,
      });
      Object.defineProperty(audio, "error", {
        value: { code: 3, message: "" },
        configurable: true,
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error).toBeNull();
      expect(mockContext.state.isReady).not.toBe(false);
    });

    test("ignores MEDIA_ERR_ABORTED (code 1) — triggered by canvas switching", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const audio = container.querySelector("audio") as HTMLAudioElement;

      Object.defineProperty(audio, "error", {
        value: { code: 1, message: "" },
        configurable: true,
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error).toBeNull();
    });

    test("falls back to generic message for unknown error codes", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const audio = container.querySelector("audio") as HTMLAudioElement;

      Object.defineProperty(audio, "error", {
        value: { code: 99, message: "" },
        configurable: true,
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error?.message).toBe(
        "Media playback failed (code 99).",
      );
    });

    test("sets isReady to false on media error", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
        state: { isReady: true },
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const audio = container.querySelector("audio") as HTMLAudioElement;

      Object.defineProperty(audio, "error", {
        value: { code: 2, message: "" },
        configurable: true,
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.isReady).toBe(false);
    });
  });

  test("sets preload on video elements too", () => {
    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: mockContext,
        component: Viewer,
      },
    });
    flushSync();

    const videoElement = container.querySelector("video") as HTMLVideoElement;
    expect(videoElement?.preload).toBe("auto");
  });

  describe("poster", () => {
    test("sets the video poster attribute from the poster prop", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            poster: "https://example.com/poster.png",
          },
        },
      });
      flushSync();

      const videoElement = container.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.poster).toBe("https://example.com/poster.png");
    });

    test("uses context posterUrl when no poster prop is given", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        posterUrl: "https://example.com/derived.png",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
        },
      });
      flushSync();

      const videoElement = container.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.poster).toBe("https://example.com/derived.png");
    });

    test("poster prop overrides context posterUrl", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        posterUrl: "https://example.com/derived.png",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            poster: "https://example.com/explicit.png",
          },
        },
      });
      flushSync();

      const videoElement = container.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.poster).toBe("https://example.com/explicit.png");
    });

    test("does not set a poster attribute on audio elements", () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
        posterUrl: "https://example.com/derived.png",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: {
            poster: "https://example.com/explicit.png",
          },
        },
      });
      flushSync();

      const audioElement = container.querySelector("audio");
      expect(audioElement?.getAttribute("poster")).toBeNull();
    });

    test('poster="" suppresses the IIIF-derived poster', () => {
      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        posterUrl: "https://example.com/derived.png",
      });

      const { container } = render(TestContextHarness, {
        props: {
          context: mockContext,
          component: Viewer,
          props: { poster: "" },
        },
      });
      flushSync();

      const videoElement = container.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.getAttribute("poster")).toBeNull();
    });
  });

  describe("captions verdict application (machine-driven)", () => {
    const twoTracks: TrackDefinition[] = [
      {
        src: "https://example.com/en.vtt",
        kind: "captions",
        srclang: "en",
        label: "English",
      },
      {
        src: "https://example.com/fr.vtt",
        kind: "captions",
        srclang: "fr",
        label: "Français",
      },
    ];

    function mountVideo(
      ctx: ReturnType<typeof createReactiveMockPlayerContext>,
    ): HTMLVideoElement {
      const { container } = render(TestContextHarness, {
        props: {
          context: ctx,
          component: Viewer,
        },
      });
      flushSync();
      return container.querySelector("video") as HTMLVideoElement;
    }

    test("browserDefault leaves the browser's own default-track selection alone", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        captionsState: "browserDefault",
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
      });
    });

    test("autoHidden hides the selected track", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        captionsState: "autoHidden",
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });
    });

    test("showing/hidden verdicts apply to the selected track", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        captionsState: "hidden",
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });

      ctx.captionsState = "showing";
      flushSync();
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
      });
    });

    test("only the selected track ever leaves disabled on a multi-track canvas", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        captionsState: "showing",
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
        expect(video.textTracks[1]!.mode).toBe("disabled");
      });

      // Toggling the verdict never promotes the second track either.
      ctx.captionsState = "hidden";
      flushSync();
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
        expect(video.textTracks[1]!.mode).toBe("disabled");
      });
    });

    test("a native textTracks 'change' reports the selected track's mode back to the context", async () => {
      const reportNativeCaptionChange = vi.fn();
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        captionsState: "showing",
        reportNativeCaptionChange,
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
      });
      reportNativeCaptionChange.mockClear();

      // Simulate the user picking "Off" from the browser's native CC menu.
      video.textTracks[0]!.mode = "hidden";
      video.textTracks.dispatchEvent(new Event("change"));

      await vi.waitFor(() => {
        expect(reportNativeCaptionChange).toHaveBeenCalledWith("hidden");
      });
    });
  });
});
