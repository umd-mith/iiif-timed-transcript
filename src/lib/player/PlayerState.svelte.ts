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
  TranscriptStatus,
  CaptionsVerdict,
} from "./context.js";
import type { HlsAdapter } from "../media/hlsUtils.js";
import type { DashAdapter } from "../media/dashUtils.js";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import type { Annotation } from "../sync/types.js";

export interface PlayerStateManagerOptions {
  onRetry?: () => Promise<void>;
  onSwitchCanvas?: (index: number) => void;
  /** A rejected `play()` (e.g. blocked autoplay, NotAllowedError). Not called for AbortError. */
  onPlaybackError?: (error: Error) => void;
  /** USER_TOGGLE on the captions machine. */
  onToggleCaptions?: () => void;
  /** NATIVE_CHANGE on the captions machine, from Viewer's textTracks 'change' listener. */
  onNativeCaptionChange?: (mode: "showing" | "hidden") => void;
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
  posterUrl = $state<string | undefined>(undefined);
  mediaStrategy = $state<MediaStrategy>("native");
  hlsAdapter = $state.raw<HlsAdapter | null>(null);
  dashAdapter = $state.raw<DashAdapter | null>(null);
  annotations = $state.raw<Annotation[]>([]);
  chapters = $state.raw<Chapter[]>([]);
  tracks = $state.raw<TrackDefinition[]>([]);
  transcriptStatus = $state<TranscriptStatus>("idle");
  transcriptPopulated = $state(false);
  captionsState = $state<CaptionsVerdict>("unavailable");

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
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        const err = error instanceof Error ? error : new Error(String(error));
        this.state.error = err;
        this.onPlaybackError?.(err);
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

  toggleCaptions: () => void = () => {
    this.onToggleCaptions?.();
  };

  reportNativeCaptionChange: (mode: "showing" | "hidden") => void = (mode) => {
    this.onNativeCaptionChange?.(mode);
  };

  private onRetry: (() => Promise<void>) | undefined;
  private onSwitchCanvas: ((index: number) => void) | undefined;
  private onPlaybackError: ((error: Error) => void) | undefined;
  private onToggleCaptions: (() => void) | undefined;
  private onNativeCaptionChange:
    | ((mode: "showing" | "hidden") => void)
    | undefined;

  constructor(options?: PlayerStateManagerOptions) {
    this.onRetry = options?.onRetry;
    this.onSwitchCanvas = options?.onSwitchCanvas;
    this.onPlaybackError = options?.onPlaybackError;
    this.onToggleCaptions = options?.onToggleCaptions;
    this.onNativeCaptionChange = options?.onNativeCaptionChange;
  }
}
