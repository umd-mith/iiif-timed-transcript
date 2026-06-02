import { createContext } from "svelte";
import type { Annotation } from "../sync/types.js";

export interface TranscriptState {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  searchMatches: Annotation[];
  currentMatchIndex: number;
  highlightedIds: Set<string>;
  currentMatchId: string | null;
}

export interface TranscriptActions {
  handleAnnotationClick: (annotation: Annotation) => void;
  handleMatchChange: (matches: Annotation[], index: number) => void;
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
