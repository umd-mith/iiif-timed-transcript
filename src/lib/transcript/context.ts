import { getContext, setContext } from 'svelte';
import type { Annotation, IIIFMediaViewerRef } from '../sync/types';

const TRANSCRIPT_CONTEXT_KEY = Symbol('transcript-panel');

export interface TranscriptContext {
  annotations: Annotation[];
  viewer: IIIFMediaViewerRef | null;
  activeAnnotationId: string | null;
  onAnnotationClick: (annotation: Annotation) => void;
}

export function createTranscriptContext(ctx: TranscriptContext): TranscriptContext {
  setContext(TRANSCRIPT_CONTEXT_KEY, ctx);
  return ctx;
}

export function getTranscriptContext(): TranscriptContext {
  const ctx = getContext<TranscriptContext>(TRANSCRIPT_CONTEXT_KEY);
  if (!ctx) {
    throw new Error(
      'Transcript.Panel context not found. Component must be used inside <Transcript.Panel>'
    );
  }
  return ctx;
}
