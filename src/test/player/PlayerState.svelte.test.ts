import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { PlayerStateManager } from "../../lib/player/PlayerState.svelte";
import type { PlayerContext, PlayerRef } from "../../lib/player/context";
import type { Chapter } from "@umd-mith/iiif-media-parsers";

// Helper to create a mock HTMLMediaElement with the subset of APIs we need
function createMockMediaElement(
  overrides: Partial<HTMLMediaElement> = {},
): HTMLMediaElement {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    currentTime: 0,
    duration: 120,
    playbackRate: 1,
    ...overrides,
  } as unknown as HTMLMediaElement;
}

const sampleChapters: Chapter[] = [
  { id: "ch1", label: "Introduction", startTime: 0, endTime: 30 },
  { id: "ch2", label: "Main", startTime: 30, endTime: 60 },
  { id: "ch3", label: "Conclusion", startTime: 60, endTime: 90 },
];

describe("PlayerStateManager", () => {
  describe("default state", () => {
    test("initializes with default PlayerState values", () => {
      const manager = new PlayerStateManager();

      expect(manager.state.isPlaying).toBe(false);
      expect(manager.state.isBuffering).toBe(false);
      expect(manager.state.currentTime).toBe(0);
      expect(manager.state.duration).toBe(0);
      expect(manager.state.playbackRate).toBe(1);
      expect(manager.state.isReady).toBe(false);
      expect(manager.state.error).toBeNull();
      expect(manager.state.errorSource).toBeNull();
    });

    test("setError records error and source; clearError resets both", () => {
      const manager = new PlayerStateManager();
      const err = new Error("boom");

      manager.setError(err, "manifest");
      expect(manager.state.error).toBe(err);
      expect(manager.state.errorSource).toBe("manifest");

      manager.clearError();
      expect(manager.state.error).toBeNull();
      expect(manager.state.errorSource).toBeNull();
    });

    test("initializes media properties with defaults", () => {
      const manager = new PlayerStateManager();

      expect(manager.mediaElement).toBeNull();
      expect(manager.mediaUrl).toBe("");
      expect(manager.mediaType).toBe("audio");
      expect(manager.mediaStrategy).toBe("native");
      expect(manager.hlsAdapter).toBeNull();
      expect(manager.chapters).toEqual([]);
      expect(manager.tracks).toEqual([]);
    });

    test("initializes transcriptStatus to idle and transcriptPopulated to false", () => {
      const manager = new PlayerStateManager();
      expect(manager.transcriptStatus).toBe("idle");
      expect(manager.transcriptPopulated).toBe(false);
    });
  });

  describe("activeChapterId", () => {
    test("returns matching chapter id for current time", () => {
      const manager = new PlayerStateManager();
      manager.chapters = sampleChapters;
      manager.state.currentTime = 15;
      flushSync();

      expect(manager.activeChapterId).toBe("ch1");
    });

    test("returns null when no chapters exist", () => {
      const manager = new PlayerStateManager();
      manager.state.currentTime = 15;
      flushSync();

      expect(manager.activeChapterId).toBeNull();
    });

    test("returns null when time is at chapter endTime (exclusive boundary)", () => {
      const manager = new PlayerStateManager();
      manager.chapters = sampleChapters;
      manager.state.currentTime = 30; // exactly at ch1.endTime / ch2.startTime
      flushSync();

      // endTime is exclusive, startTime is inclusive — should match ch2
      expect(manager.activeChapterId).toBe("ch2");
    });

    test("returns null when time falls in gap between chapters", () => {
      const gappyChapters: Chapter[] = [
        { id: "ch1", label: "First", startTime: 0, endTime: 10 },
        { id: "ch2", label: "Second", startTime: 20, endTime: 30 },
      ];
      const manager = new PlayerStateManager();
      manager.chapters = gappyChapters;
      manager.state.currentTime = 15; // in the gap
      flushSync();

      expect(manager.activeChapterId).toBeNull();
    });
  });

  describe("actions.seekTo", () => {
    test("warns and returns when media not ready", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const manager = new PlayerStateManager();
      manager.mediaElement = createMockMediaElement();
      // state.isReady is false by default

      manager.actions.seekTo(10);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot seek"),
      );
      expect(manager.mediaElement!.currentTime).toBe(0);
      warnSpy.mockRestore();
    });

    test("warns on NaN time", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const manager = new PlayerStateManager();
      manager.mediaElement = createMockMediaElement();
      manager.state.isReady = true;

      manager.actions.seekTo(NaN);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid seek time"),
      );
      warnSpy.mockRestore();
    });

    test("warns on negative time", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const manager = new PlayerStateManager();
      manager.mediaElement = createMockMediaElement();
      manager.state.isReady = true;

      manager.actions.seekTo(-5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid seek time"),
      );
      warnSpy.mockRestore();
    });

    test("warns on Infinity", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const manager = new PlayerStateManager();
      manager.mediaElement = createMockMediaElement();
      manager.state.isReady = true;

      manager.actions.seekTo(Infinity);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid seek time"),
      );
      warnSpy.mockRestore();
    });

    test("clamps time to duration", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;
      manager.state.isReady = true;
      manager.state.duration = 60;

      manager.actions.seekTo(100);

      expect(el.currentTime).toBe(60);
    });

    test("sets currentTime on valid seek", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;
      manager.state.isReady = true;
      manager.state.duration = 60;

      manager.actions.seekTo(30);

      expect(el.currentTime).toBe(30);
    });
  });

  describe("actions.setPlaybackRate", () => {
    test("clamps rate below 0.25", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;

      manager.actions.setPlaybackRate(0.1);

      expect(el.playbackRate).toBe(0.25);
    });

    test("clamps rate above 4", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;

      manager.actions.setPlaybackRate(10);

      expect(el.playbackRate).toBe(4);
    });

    test("sets valid rate", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;

      manager.actions.setPlaybackRate(1.5);

      expect(el.playbackRate).toBe(1.5);
    });

    test("warns when no media element", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const manager = new PlayerStateManager();

      manager.actions.setPlaybackRate(1.5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot set playback rate"),
      );
      warnSpy.mockRestore();
    });
  });

  describe("actions.play/pause", () => {
    test("play delegates to mediaElement.play()", async () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;

      await manager.actions.play();

      expect(el.play).toHaveBeenCalled();
    });

    test("play catches NotAllowedError and sets state.error", async () => {
      const manager = new PlayerStateManager();
      const notAllowed = new DOMException(
        "play() request was interrupted",
        "NotAllowedError",
      );
      const el = createMockMediaElement({
        play: vi
          .fn()
          .mockRejectedValue(notAllowed) as unknown as () => Promise<void>,
      });
      manager.mediaElement = el;

      await manager.actions.play();

      expect(manager.state.error).toBe(notAllowed);
    });

    test("play silently ignores AbortError", async () => {
      const manager = new PlayerStateManager();
      const abortError = new DOMException(
        "The play() request was interrupted by a call to pause()",
        "AbortError",
      );
      const el = createMockMediaElement({
        play: vi
          .fn()
          .mockRejectedValue(abortError) as unknown as () => Promise<void>,
      });
      manager.mediaElement = el;

      await manager.actions.play();

      expect(manager.state.error).toBeNull();
    });

    test("play wraps non-Error rejection in Error", async () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement({
        play: vi
          .fn()
          .mockRejectedValue("string error") as unknown as () => Promise<void>,
      });
      manager.mediaElement = el;

      await manager.actions.play();

      expect(manager.state.error).toBeInstanceOf(Error);
      expect(manager.state.error!.message).toBe("string error");
    });

    test("play warns when mediaElement is null", async () => {
      const manager = new PlayerStateManager();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await manager.actions.play();

      expect(warnSpy).toHaveBeenCalledWith(
        "[IIIFPlayer] Cannot play: media not ready",
      );
      warnSpy.mockRestore();
    });

    test("pause delegates to mediaElement.pause()", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;

      manager.actions.pause();

      expect(el.pause).toHaveBeenCalled();
    });

    test("play reports a rejection through onPlaybackError and still sets state.error", async () => {
      const onPlaybackError = vi.fn();
      const manager = new PlayerStateManager({ onPlaybackError });
      const notAllowed = new DOMException("blocked", "NotAllowedError");
      manager.mediaElement = createMockMediaElement({
        play: vi
          .fn()
          .mockRejectedValue(notAllowed) as unknown as () => Promise<void>,
      });

      await manager.actions.play();

      expect(onPlaybackError).toHaveBeenCalledTimes(1);
      expect(onPlaybackError).toHaveBeenCalledWith(notAllowed);
      expect(manager.state.error).toBe(notAllowed);
    });

    test("play does not call onPlaybackError for AbortError", async () => {
      const onPlaybackError = vi.fn();
      const manager = new PlayerStateManager({ onPlaybackError });
      manager.mediaElement = createMockMediaElement({
        play: vi
          .fn()
          .mockRejectedValue(
            new DOMException("interrupted", "AbortError"),
          ) as unknown as () => Promise<void>,
      });

      await manager.actions.play();

      expect(onPlaybackError).not.toHaveBeenCalled();
    });
  });

  describe("actions.seekToChapter", () => {
    test("delegates to seekTo with chapter startTime", () => {
      const manager = new PlayerStateManager();
      const el = createMockMediaElement();
      manager.mediaElement = el;
      manager.state.isReady = true;
      manager.state.duration = 90;

      manager.actions.seekToChapter(sampleChapters[1]!);

      expect(el.currentTime).toBe(30);
    });
  });

  describe("actions.retry", () => {
    test("clears error and calls onRetry callback", async () => {
      const onRetry = vi.fn().mockResolvedValue(undefined);
      const manager = new PlayerStateManager({ onRetry });
      manager.state.error = new Error("test error");

      await manager.actions.retry();

      expect(manager.state.error).toBeNull();
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe("type safety", () => {
    test("class satisfies PlayerContext interface", () => {
      // This test verifies compile-time compatibility.
      // If PlayerStateManager doesn't satisfy PlayerContext, TypeScript will error.
      const manager: PlayerContext = new PlayerStateManager();
      expect(manager).toBeDefined();
    });

    test("PlayerStateManager satisfies PlayerRef interface", () => {
      const manager = new PlayerStateManager();
      const ref: PlayerRef = manager;
      expect(ref.state).toBeDefined();
      expect(ref.actions).toBeDefined();
      expect(ref.canvasIndex).toBe(0);
      expect(ref.canvasCount).toBe(0);
      expect(ref.canvases).toEqual([]);
      expect(ref.annotations).toEqual([]);
      expect(ref.chapters).toEqual([]);
      expect(ref.activeChapterId).toBeNull();
      expect(ref.mediaType).toBe("audio");
    });
  });
});
