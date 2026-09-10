import { createContext } from "svelte";
import type { Annotation } from "../sync/types.js";

export interface TranscriptState {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  searchMatches: Annotation[];
  currentMatchIndex: number;
  highlightedIds: Set<string>;
  currentMatchId: string | null;
  /**
   * Configured search-seek behavior (`Transcript`'s `searchSeekBehavior`
   * prop). `"activate"` is what makes `TranscriptSearch` show the "Go to
   * match" activation control and route seeking through
   * `handleMatchActivate` instead of `handleMatchChange`.
   */
  searchSeekBehavior: "change" | "activate";
  /**
   * `true` while this panel is Browsing — the reader has detached the
   * transcript from playback (mirrors `Transcript`'s bindable
   * `readingMode`). `false` is Following. Panel-local: two `Transcript`
   * instances under the same player track this independently.
   */
  readingMode: boolean;
}

export interface TranscriptActions {
  handleAnnotationClick: (annotation: Annotation) => void;
  handleMatchChange: (matches: Annotation[], index: number) => void;
  /**
   * Explicit search-result activation (Enter in the search input, or the
   * "Go to match" button). Seeks once to the annotation's start time
   * regardless of `searchSeekBehavior` — this is the only seek path when
   * `searchSeekBehavior` is `"activate"`.
   */
  handleMatchActivate: (annotation: Annotation, index: number) => void;
  /**
   * Synchronous query-input intent, forwarded from `Search`'s
   * `onqueryinput`. Reserved for the reading-mode step (entering Browsing
   * on input while `searchSeekBehavior` is `"activate"`); optional until
   * that step implements it, so `TranscriptSearch` can wire the seam now
   * without every context needing to provide it yet.
   */
  handleQueryInput?: (value: string) => void;
  /**
   * Enters Browsing. Idempotent — safe to call when already Browsing. A
   * custom (host-built) "Follow along" control calls this to turn the
   * switch off.
   */
  enterBrowsing: () => void;
  /**
   * Returns to Following: scrolls the passage at the media's current time
   * into view (never seeks) and exits Browsing. Same effect as turning
   * "Follow along" back on — a custom "Jump to current" control calls this.
   * Idempotent when already Following.
   */
  returnToFollowing: () => void;
  /**
   * Scroll a specific annotation into view within the transcript panel.
   * Returns true if the annotation was found, false otherwise.
   * Respects prefers-reduced-motion by default.
   */
  scrollToAnnotation: (
    annotationId: string,
    options?: ScrollIntoViewOptions,
  ) => boolean;
}

export interface TranscriptContext {
  state: TranscriptState;
  actions: TranscriptActions;
}

export const [getTranscriptContext, setTranscriptContext] =
  createContext<TranscriptContext>();

/**
 * Returns the transcript context if called inside IIIFPlayer.Transcript, or null otherwise.
 *
 * Must be called during component initialization (top-level `<script>`),
 * not inside event handlers, `$effect`, or async callbacks.
 */
export function tryGetTranscriptContext(): TranscriptContext | null {
  try {
    return getTranscriptContext();
  } catch (error) {
    if (error instanceof Error && !error.message.includes("missing_context")) {
      throw error;
    }
    return null;
  }
}
