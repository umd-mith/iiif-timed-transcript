<script lang="ts">
  import { getContext } from "svelte";
  import Segment from "../transcript/Segment.svelte";
  import { getNextIndex, focusSegmentAtIndex } from "../transcript/keyboardNav";
  import {
    TRANSCRIPT_CONTEXT_KEY,
    type TranscriptContext,
  } from "./transcript-context";
  import type { Annotation } from "../sync/types";

  interface Props {
    annotations?: Annotation[];
    allowHtmlAnnotations?: boolean;
    activeAnnotationId?: string | null;
    highlightedIds?: Set<string>;
    currentMatchId?: string | null;
    onclick?: (annotation: Annotation) => void;
    class?: string;
  }

  let {
    annotations: annotationsProp,
    allowHtmlAnnotations: allowHtmlAnnotationsProp,
    activeAnnotationId: activeAnnotationIdProp,
    highlightedIds: highlightedIdsProp,
    currentMatchId: currentMatchIdProp,
    onclick: onclickProp,
    class: className = "",
  }: Props = $props();

  // Try to read TranscriptContext (available when inside Transcript)
  const transcriptCtx = getContext<TranscriptContext | undefined>(
    TRANSCRIPT_CONTEXT_KEY,
  );

  // Use context values when available, fall back to props
  const annotations = $derived(
    annotationsProp ?? transcriptCtx?.state.annotations ?? [],
  );
  const allowHtmlAnnotations = $derived(
    allowHtmlAnnotationsProp ??
      transcriptCtx?.state.allowHtmlAnnotations ??
      false,
  );
  const activeAnnotationId = $derived(
    activeAnnotationIdProp ?? transcriptCtx?.state.activeAnnotationId ?? null,
  );
  const highlightedIds = $derived(
    highlightedIdsProp ??
      transcriptCtx?.state.highlightedIds ??
      new Set<string>(),
  );
  const currentMatchId = $derived(
    currentMatchIdProp ?? transcriptCtx?.state.currentMatchId ?? null,
  );
  const onclick = $derived(
    onclickProp ?? transcriptCtx?.actions.handleAnnotationClick,
  );

  // Roving tabindex state — tracks which segment index is in the tab order
  let focusedIndex = $state(0);

  // Reset focused index when annotations change
  $effect(() => {
    if (annotations.length > 0 && focusedIndex >= annotations.length) {
      focusedIndex = 0;
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (annotations.length === 0) return;
    const nextIndex = getNextIndex(event.key, focusedIndex, annotations.length);
    if (nextIndex !== null) {
      event.preventDefault();
      focusedIndex = nextIndex;
      focusSegmentAtIndex(event.currentTarget as HTMLElement, nextIndex);
    }
  }
</script>

{#if annotations.length === 0}
  <p class="empty-message">No segments available.</p>
{:else}
  <div
    class="segments-container {className}"
    role="group"
    aria-label="Transcript segments"
    tabindex="-1"
    onkeydown={handleKeydown}
  >
    {#each annotations as annotation, i (annotation.id)}
      <Segment
        {annotation}
        {allowHtmlAnnotations}
        isActive={activeAnnotationId === annotation.id}
        isHighlighted={highlightedIds.has(annotation.id) &&
          currentMatchId !== annotation.id}
        isCurrentMatch={currentMatchId === annotation.id}
        onclick={() => onclick?.(annotation)}
        tabindex={i === focusedIndex ? 0 : -1}
      />
    {/each}
  </div>
{/if}

<style>
  .segments-container {
    flex: 1;
  }

  .empty-message {
    padding: 1rem;
    text-align: center;
    color: #595959;
  }
</style>
