import { createContext } from "svelte";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import type { HlsAdapter } from "../media/hlsUtils";
import type { Annotation } from "../sync/types";

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
 */
export type MediaStrategy = "native" | "hls-js";

export interface PlayerContext {
  state: PlayerState;
  mediaElement: HTMLMediaElement | null;
  mediaUrl: string;
  mediaType: "audio" | "video";
  readonly mediaStrategy: MediaStrategy;
  readonly hlsAdapter: HlsAdapter | null;
  readonly annotations: Annotation[];
  readonly chapters: Chapter[];
  readonly activeChapterId: string | null;
  readonly tracks: TrackDefinition[];
  readonly canvasIndex: number;
  readonly canvasCount: number;
  readonly canvases: CanvasInfo[];
  actions: PlayerActions;
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
  } catch {
    return null;
  }
}
