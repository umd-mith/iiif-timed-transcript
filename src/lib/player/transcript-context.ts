import { getContext as svelteGetContext } from "svelte";
import type { Annotation } from "../sync/types";

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

export const TRANSCRIPT_CONTEXT_KEY = "iiif-transcript";

export function getTranscriptContext(): TranscriptContext {
  const ctx = svelteGetContext<TranscriptContext>(TRANSCRIPT_CONTEXT_KEY);
  if (!ctx) {
    throw new Error(
      "Transcript context not found. Component must be child of IIIFPlayer.Transcript",
    );
  }
  return ctx;
}
