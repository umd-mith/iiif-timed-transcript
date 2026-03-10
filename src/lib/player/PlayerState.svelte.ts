/**
 * PlayerStateManager — reactive class encapsulating player state, derivations, and actions.
 *
 * Extracted from Root.svelte so that action logic (seekTo clamping, playbackRate
 * validation, activeChapterId derivation) can be unit-tested without DOM mounting.
 *
 * DOM effects (media event listeners, cleanup) remain in Root.svelte.
 */

import type {
  PlayerContext,
  PlayerState,
  PlayerActions,
  MediaStrategy,
  TrackDefinition,
  CanvasInfo,
} from "./context";
import type { HlsAdapter } from "../media/hlsUtils";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import type { Annotation } from "../sync/types";

export interface PlayerStateManagerOptions {
  onRetry?: () => Promise<void>;
  onSwitchCanvas?: (index: number) => void;
}

export class PlayerStateManager implements PlayerContext {
  // PlayerState (grouped object so consumers can read `manager.state.isPlaying`)
  state = $state<PlayerState>({
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    isReady: false,
    error: null,
  });

  // Media properties
  mediaElement = $state.raw<HTMLMediaElement | null>(null);
  mediaUrl = $state("");
  mediaType = $state<"audio" | "video">("audio");
  mediaStrategy = $state<MediaStrategy>("native");
  hlsAdapter = $state.raw<HlsAdapter | null>(null);
  annotations = $state.raw<Annotation[]>([]);
  chapters = $state.raw<Chapter[]>([]);
  tracks = $state.raw<TrackDefinition[]>([]);

  // Canvas navigation
  canvasIndex = $state(0);
  canvases = $state<CanvasInfo[]>([]);

  get canvasCount(): number {
    return this.canvases.length;
  }

  // Derived
  readonly activeChapterId: string | null = $derived.by(() => {
    const time = this.state.currentTime;
    for (const chapter of this.chapters) {
      if (time >= chapter.startTime && time < chapter.endTime) {
        return chapter.id;
      }
    }
    return null;
  });

  // Actions (arrow functions to preserve `this` when destructured)
  actions: PlayerActions = {
    play: async () => {
      if (!this.mediaElement) {
        console.warn("[IIIFPlayer] Cannot play: media not ready");
        return;
      }
      try {
        await this.mediaElement.play();
      } catch (error) {
        // AbortError is benign — play() interrupted by pause/seek, expected during normal usage
        if (error instanceof DOMException && error.name === "AbortError") return;
        this.state.error =
          error instanceof Error ? error : new Error(String(error));
      }
    },
    pause: () => {
      this.mediaElement?.pause();
    },
    seekTo: (time: number) => {
      if (!this.mediaElement || !this.state.isReady) {
        console.warn("[IIIFPlayer] Cannot seek: media not ready");
        return;
      }
      if (!isFinite(time) || time < 0) {
        console.warn(`[IIIFPlayer] Invalid seek time: ${time}`);
        return;
      }
      const clampedTime = Math.min(time, this.state.duration);
      this.mediaElement.currentTime = clampedTime;
    },
    setPlaybackRate: (rate: number) => {
      if (!this.mediaElement) {
        console.warn(
          "[IIIFPlayer] Cannot set playback rate: element not initialized",
        );
        return;
      }
      const clampedRate = Math.max(0.25, Math.min(4, rate));
      this.mediaElement.playbackRate = clampedRate;
    },
    retry: async () => {
      this.state.error = null;
      await this.onRetry?.();
    },
    seekToChapter: (chapter: Chapter) => {
      this.actions.seekTo(chapter.startTime);
    },
    switchCanvas: (index: number) => {
      this.onSwitchCanvas?.(index);
    },
  };

  private onRetry: (() => Promise<void>) | undefined;
  private onSwitchCanvas: ((index: number) => void) | undefined;

  constructor(options?: PlayerStateManagerOptions) {
    this.onRetry = options?.onRetry;
    this.onSwitchCanvas = options?.onSwitchCanvas;
  }
}
