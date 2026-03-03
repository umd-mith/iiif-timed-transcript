import { getContext as svelteGetContext } from "svelte";
import type { Annotation } from "../sync/types";

export interface TranscriptState {
  annotations: Annotation[];
  allowHtmlAnnotations: boolean | null;
  activeAnnotationId: string | null;
  searchMatches: Annotation[];
  currentMatchIndex: number;
  highlightedIds: Set<string>;
  currentMatchId: string | null;
}

export interface TranscriptActions {
  handleAnnotationClick: (annotation: Annotation) => void;
  handleMatchChange: (matches: Annotation[], index: number) => void;
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
