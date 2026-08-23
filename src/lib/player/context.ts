import { createContext } from "svelte";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import type { HlsAdapter } from "../media/hlsUtils.js";
import type { DashAdapter } from "../media/dashUtils.js";
import type { Annotation } from "../sync/types.js";

export interface TrackDefinition {
  src: string;
  kind: "captions" | "subtitles" | "descriptions" | "chapters" | "metadata";
  srclang: string;
  label: string;
}

export interface CanvasInfo {
  index: number;
  id: string;
  label: string;
  duration?: number;
  mediaType: "audio" | "video";
}

export interface PlayerState {
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isReady: boolean;
  error: Error | null;
}

export interface PlayerActions {
  play: () => Promise<void>;
  pause: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  retry: () => Promise<void>;
  seekToChapter: (chapter: Chapter) => void;
  switchCanvas: (index: number) => void;
}

/**
 * How Root decided to handle media source attachment.
 * - 'native': use <audio/video src="..."> (progressive download or native HLS in Safari)
 * - 'hls-js': hls.js manages the source via the hlsAdapter in context
 * - 'dash-js': dash.js manages the source via the dashAdapter in context
 */
export type MediaStrategy = "native" | "hls-js" | "dash-js";

/** Lifecycle of the transcript annotations when Root builds them (`annotations="auto"`). */
export type TranscriptStatus = "idle" | "loading" | "ready" | "error";

/** Where a reported error came from. The element wrapper adds "host" on its side. */
export type PlayerErrorSource =
  | "manifest"
  | "canvas"
  | "media"
  | "playback"
  | "transcript";

export interface PlayerErrorInfo {
  /** `true`: the player will not become usable (manifest/canvas/media). `false`: recoverable (transcript, playback). */
  fatal: boolean;
  source: PlayerErrorSource;
}

export interface PlayerContext {
  state: PlayerState;
  mediaElement: HTMLMediaElement | null;
  mediaUrl: string;
  mediaType: "audio" | "video";
  /** Resolved poster image URL for the current canvas (placeholderCanvas → accompanyingCanvas), or undefined. */
  posterUrl: string | undefined;
  readonly mediaStrategy: MediaStrategy;
  readonly hlsAdapter: HlsAdapter | null;
  readonly dashAdapter: DashAdapter | null;
  readonly annotations: Annotation[];
  readonly chapters: Chapter[];
  readonly activeChapterId: string | null;
  readonly tracks: TrackDefinition[];
  readonly canvasIndex: number;
  readonly canvasCount: number;
  readonly canvases: CanvasInfo[];
  /** Tier-2 transcript fetch lifecycle; "idle" unless Root builds annotations itself. */
  readonly transcriptStatus: TranscriptStatus;
  /**
   * True once any Transcript instance has been populated during the current
   * canvas load; cleared by Root on each canvas load and on an `annotations`
   * mode flip (array <-> "auto"). Transcript never writes
   * `false` (two panels with different effective annotations would otherwise
   * loop). Viewer reads it to switch native captions off once the panel shows
   * the same text. Internal wiring — not on PlayerRef.
   */
  transcriptPopulated: boolean;
  actions: PlayerActions;
}

/**
 * Curated player reference for external orchestration.
 *
 * Exposes orchestration-relevant fields (state, actions, content metadata,
 * canvas navigation) while excluding internal wiring (mediaElement, hlsAdapter,
 * dashAdapter, mediaStrategy, tracks, mediaUrl).
 *
 * At runtime this is the PlayerStateManager instance — reactivity works because
 * the class uses $state and $derived internally.
 *
 * Consumers needing excluded fields should use getPlayerContext() (or
 * tryGetPlayerContext() for optional access) from inside the Root subtree.
 */
export interface PlayerRef {
  readonly state: PlayerState;
  readonly actions: PlayerActions;
  readonly annotations: Annotation[];
  readonly chapters: Chapter[];
  readonly activeChapterId: string | null;
  readonly canvasIndex: number;
  readonly canvasCount: number;
  readonly canvases: CanvasInfo[];
  readonly mediaType: "audio" | "video";
  readonly transcriptStatus: TranscriptStatus;
}

export const [getPlayerContext, setPlayerContext] =
  createContext<PlayerContext>();

/**
 * Returns the player context if called inside IIIFPlayer.Root, or null otherwise.
 *
 * Must be called during component initialization (top-level `<script>`),
 * not inside event handlers, `$effect`, or async callbacks.
 *
 * Useful for dual-mode components that work both with and without the player:
 * ```svelte
 * const player = tryGetPlayerContext();
 * const isPlaying = $derived(player ? player.state.isPlaying : isPlayingProp);
 * ```
 */
export function tryGetPlayerContext(): PlayerContext | null {
  try {
    return getPlayerContext();
  } catch (error) {
    // Only suppress "context not found" (component not inside Root).
    // Let lifecycle errors propagate so developers get a clear stack trace
    // when calling this outside component initialization.
    if (error instanceof Error && !error.message.includes("missing_context")) {
      throw error;
    }
    return null;
  }
}
