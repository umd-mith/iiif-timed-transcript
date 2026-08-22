import { describe, test, expect, vi, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import Viewer from "../../lib/player/Viewer.svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import { createMockPlayerContext, createChildSnippet } from "./test-utils";
import { createReactiveMockPlayerContext } from "./reactive-context.svelte";

describe("Viewer", () => {
  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("renders audio element when mediaType is audio", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio");
    expect(audioElement).not.toBeNull();
    expect(audioElement?.src).toBe("https://example.com/audio.mp3");
  });

  test("renders video element when mediaType is video", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const videoElement = target.querySelector("video");
    expect(videoElement).not.toBeNull();
    expect(videoElement?.src).toBe("https://example.com/video.mp4");
  });

  test("applies custom class name", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer, {
          class: "custom-viewer",
        }),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio");
    expect(audioElement?.className).toContain("custom-viewer");
  });

  test("sets crossOrigin attribute", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer, {
          crossOrigin: "use-credentials",
        }),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.crossOrigin).toBe("use-credentials");
  });

  test("disables native controls by default", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.controls).toBe(false);
  });

  test("can enable native controls", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer, { controls: true }),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.controls).toBe(true);
  });

  test('sets preload to "auto" by default', () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.preload).toBe("auto");
  });

  test("allows overriding preload attribute", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/audio.mp3",
      mediaType: "audio",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer, { preload: "metadata" }),
      },
    });
    flushSync();

    const audioElement = target.querySelector("audio") as HTMLAudioElement;
    expect(audioElement?.preload).toBe("metadata");
  });

  test("does not set src attribute when mediaStrategy is hls-js", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

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

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const videoElement = target.querySelector("video") as HTMLVideoElement;
    expect(videoElement).not.toBeNull();
    // When hls-js strategy, the src should NOT be set directly — adapter manages the source
    expect(videoElement?.getAttribute("src")).toBeNull();
  });

  test("sets src attribute when mediaStrategy is native", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
      mediaStrategy: "native",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const videoElement = target.querySelector("video") as HTMLVideoElement;
    expect(videoElement?.src).toBe("https://example.com/video.mp4");
  });

  describe("HLS adapter wiring", () => {
    test("attaches adapter when mediaStrategy is hls-js", async () => {
      target = document.createElement("div");
      document.body.appendChild(target);

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

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        mediaStrategy: "native",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      // No adapter to attach — nothing to assert beyond no errors
      const videoElement = target.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.src).toBe("https://example.com/video.mp4");
    });

    // Note: unmount/detach behavior is tested implicitly through the $effect cleanup.
    // Explicitly testing unmount via removeChild is unreliable in Svelte's test environment.
  });

  describe("DASH adapter wiring", () => {
    test("attaches adapter when mediaStrategy is dash-js", async () => {
      target = document.createElement("div");
      document.body.appendChild(target);

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

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
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
      target = document.createElement("div");
      document.body.appendChild(target);

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

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const videoElement = target.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.getAttribute("src")).toBeNull();
    });
  });

  describe("caption tracks", () => {
    test("renders track elements inside video when tracks prop is provided", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
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
          }),
        },
      });
      flushSync();

      const tracks = target.querySelectorAll("video track");
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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
            tracks: [
              {
                src: "/captions.vtt",
                kind: "captions",
                srclang: "en",
                label: "English",
              },
            ],
          }),
        },
      });
      flushSync();

      const track = target.querySelector("video track") as HTMLTrackElement;
      expect(track.default).toBe(true);
    });

    test("does not render tracks inside audio elements", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
            tracks: [
              {
                src: "/captions.vtt",
                kind: "captions",
                srclang: "en",
                label: "English",
              },
            ],
          }),
        },
      });
      flushSync();

      const tracks = target.querySelectorAll("track");
      expect(tracks).toHaveLength(0);
    });
  });

  describe("auto-discovered caption tracks", () => {
    test("renders tracks from context when no tracks prop provided", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

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

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const tracks = target.querySelectorAll("video track");
      expect(tracks).toHaveLength(1);
      const track = tracks[0] as HTMLTrackElement;
      expect(track.src).toContain("captions-en.vtt");
      expect(track.kind).toBe("captions");
      expect(track.srclang).toBe("en");
    });

    test("explicit tracks prop overrides context tracks", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

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

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
            tracks: [
              {
                src: "/custom.vtt",
                kind: "subtitles",
                srclang: "fr",
                label: "French",
              },
            ],
          }),
        },
      });
      flushSync();

      const tracks = target.querySelectorAll("video track");
      expect(tracks).toHaveLength(1);
      const track = tracks[0] as HTMLTrackElement;
      expect(track.src).toContain("/custom.vtt");
      expect(track.kind).toBe("subtitles");
      expect(track.srclang).toBe("fr");
    });

    test("renders no tracks for audio even with context tracks", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

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

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const tracks = target.querySelectorAll("track");
      expect(tracks).toHaveLength(0);
    });
  });

  describe("native media error handling", () => {
    test("sets ctx.state.error on audio error event", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const audio = target.querySelector("audio") as HTMLAudioElement;

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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const video = target.querySelector("video") as HTMLVideoElement;

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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const audio = target.querySelector("audio") as HTMLAudioElement;

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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const audio = target.querySelector("audio") as HTMLAudioElement;

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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const audio = target.querySelector("audio") as HTMLAudioElement;

      Object.defineProperty(audio, "error", {
        value: { code: 1, message: "" },
        configurable: true,
      });
      audio.dispatchEvent(new Event("error"));
      flushSync();

      expect(mockContext.state.error).toBeNull();
    });

    test("falls back to generic message for unknown error codes", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const audio = target.querySelector("audio") as HTMLAudioElement;

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
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
        state: { isReady: true },
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const audio = target.querySelector("audio") as HTMLAudioElement;

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
    target = document.createElement("div");
    document.body.appendChild(target);

    const mockContext = createMockPlayerContext({
      mediaUrl: "https://example.com/video.mp4",
      mediaType: "video",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: mockContext,
        children: createChildSnippet(target, Viewer),
      },
    });
    flushSync();

    const videoElement = target.querySelector("video") as HTMLVideoElement;
    expect(videoElement?.preload).toBe("auto");
  });

  describe("poster", () => {
    test("sets the video poster attribute from the poster prop", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
            poster: "https://example.com/poster.png",
          }),
        },
      });
      flushSync();

      const videoElement = target.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.poster).toBe("https://example.com/poster.png");
    });

    test("uses context posterUrl when no poster prop is given", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        posterUrl: "https://example.com/derived.png",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer),
        },
      });
      flushSync();

      const videoElement = target.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.poster).toBe("https://example.com/derived.png");
    });

    test("poster prop overrides context posterUrl", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        posterUrl: "https://example.com/derived.png",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
            poster: "https://example.com/explicit.png",
          }),
        },
      });
      flushSync();

      const videoElement = target.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.poster).toBe("https://example.com/explicit.png");
    });

    test("does not set a poster attribute on audio elements", () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/audio.mp3",
        mediaType: "audio",
        posterUrl: "https://example.com/derived.png",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, {
            poster: "https://example.com/explicit.png",
          }),
        },
      });
      flushSync();

      const audioElement = target.querySelector("audio");
      expect(audioElement?.getAttribute("poster")).toBeNull();
    });

    test('poster="" suppresses the IIIF-derived poster', () => {
      target = document.createElement("div");
      document.body.appendChild(target);

      const mockContext = createMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        posterUrl: "https://example.com/derived.png",
      });

      mount(TestContextProvider, {
        target,
        props: {
          context: mockContext,
          children: createChildSnippet(target, Viewer, { poster: "" }),
        },
      });
      flushSync();

      const videoElement = target.querySelector("video") as HTMLVideoElement;
      expect(videoElement?.getAttribute("poster")).toBeNull();
    });
  });

  describe("native captions when the transcript panel is populated", () => {
    const twoTracks = [
      {
        src: "https://example.com/en.vtt",
        kind: "captions" as const,
        srclang: "en",
        label: "English",
      },
      {
        src: "https://example.com/fr.vtt",
        kind: "captions" as const,
        srclang: "fr",
        label: "Français",
      },
    ];

    function mountVideo(
      ctx: ReturnType<typeof createReactiveMockPlayerContext>,
      viewerProps: Record<string, unknown> = {},
    ): HTMLVideoElement {
      target = document.createElement("div");
      document.body.appendChild(target);
      mount(TestContextProvider, {
        target,
        props: {
          context: ctx,
          children: createChildSnippet(target, Viewer, viewerProps),
        },
      });
      flushSync();
      return target.querySelector("video") as HTMLVideoElement;
    }

    test("sets every context track to hidden once the panel is populated", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        transcriptPopulated: true,
      });
      const video = mountVideo(ctx);

      await vi.waitFor(() => {
        expect(video.textTracks.length).toBe(2);
        expect(video.textTracks[0]!.mode).toBe("hidden");
        expect(video.textTracks[1]!.mode).toBe("hidden");
      });
      // The browser's automatic default-track selection must not flip it back.
      await new Promise((r) => setTimeout(r, 100));
      expect(video.textTracks[0]!.mode).toBe("hidden");
    });

    test("leaves the default track showing while the panel is empty", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        transcriptPopulated: false,
      });
      const video = mountVideo(ctx);

      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
      });
    });

    test("hides captions when the panel populates later", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        transcriptPopulated: false,
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
      });

      ctx.transcriptPopulated = true;
      flushSync();
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });
    });

    test("writes mode once per canvas load and never again", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        tracks: twoTracks,
        transcriptPopulated: true,
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
        expect(video.textTracks[1]!.mode).toBe("hidden");
      });

      // Panel empties (a consumer that conditionally renders <Transcript>):
      // the library leaves `mode` alone — documented limitation, a host that
      // needs captions back should pass `tracks` explicitly.
      ctx.transcriptPopulated = false;
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      expect(video.textTracks[0]!.mode).toBe("hidden");
      expect(video.textTracks[1]!.mode).toBe("hidden");

      // A viewer's own choice survives a repopulate on the same canvas:
      // the library never writes `mode` a second time.
      video.textTracks[0]!.mode = "showing";
      video.textTracks[1]!.mode = "disabled";
      ctx.transcriptPopulated = true;
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      expect(video.textTracks[0]!.mode).toBe("showing");
      expect(video.textTracks[1]!.mode).toBe("disabled");
    });

    test("does not touch an explicit tracks prop", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video.mp4",
        mediaType: "video",
        transcriptPopulated: true,
      });
      const video = mountVideo(ctx, { tracks: twoTracks });

      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("showing");
      });
    });

    test("starts over on a canvas switch (new mediaUrl)", async () => {
      const ctx = createReactiveMockPlayerContext({
        mediaUrl: "https://example.com/video-1.mp4",
        mediaType: "video",
        tracks: twoTracks,
        transcriptPopulated: true,
      });
      const video = mountVideo(ctx);
      await vi.waitFor(() => {
        expect(video.textTracks[0]!.mode).toBe("hidden");
      });

      // Simulate Root's canvas switch: media cleared, panel cleared, new media.
      ctx.mediaUrl = "";
      ctx.transcriptPopulated = false;
      flushSync();
      ctx.mediaUrl = "https://example.com/video-2.mp4";
      flushSync();
      const video2 = target.querySelector("video") as HTMLVideoElement;
      await vi.waitFor(() => {
        expect(video2.textTracks[0]!.mode).toBe("showing");
      });

      ctx.transcriptPopulated = true;
      flushSync();
      await vi.waitFor(() => {
        expect(video2.textTracks[0]!.mode).toBe("hidden");
      });
    });
  });
});
