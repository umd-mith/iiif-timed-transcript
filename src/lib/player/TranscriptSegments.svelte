<script lang="ts">
  import type { Snippet } from "svelte";
  import Segment from "../transcript/Segment.svelte";
  import { getNextIndex, focusSegmentAtIndex } from "../transcript/keyboardNav";
  import { tryGetTranscriptContext } from "./transcript-context";
  import type { Annotation } from "../sync/types";

  /**
   * Props passed to a custom segment snippet.
   * Includes a `segmentAttrs` spread object that bundles a11y attributes,
   * data attributes, tabindex, and onclick — so consumers get correct
   * behavior by default without manual wiring.
   */
  /** Attributes bundled for custom segment root elements. Spread with `{...segmentAttrs}`. */
  export type SegmentAttrs = {
    "data-annotation-id": string;
    "data-state": "active" | "inactive";
    "data-highlighted": "true" | undefined;
    "data-current-match": "true" | undefined;
    "aria-current": "true" | undefined;
    role: "button";
    tabindex: 0 | -1;
    onclick: () => void;
  };

  export interface SegmentSnippetProps {
    annotation: Annotation;
    isActive: boolean;
    isHighlighted: boolean;
    isCurrentMatch: boolean;
    index: number;
    /** Spread onto your root element: `{...segmentAttrs}`. Provides a11y, keyboard nav, and click handling. */
    segmentAttrs: SegmentAttrs;
  }

  interface Props {
    annotations?: Annotation[];
    activeAnnotationId?: string | null;
    highlightedIds?: Set<string>;
    currentMatchId?: string | null;
    /**
     * ID of an annotation to highlight (e.g., from a deep link URL parameter).
     * Merges with search highlights from context.
     */
    highlightedAnnotationId?: string | null;
    onclick?: (annotation: Annotation) => void;
    /**
     * Optional handler for keyboard events on the segments container.
     * Fires before built-in navigation. Call event.preventDefault() to suppress
     * built-in arrow/Home/End navigation.
     *
     * This handler fires on the segments *container*, not on individual
     * segments. It provides annotation context (focused annotation, index, full
     * array) that a handler on an individual element would not have. When using
     * the `segment` snippet, consumers may also add keydown handlers directly
     * on their custom elements for segment-specific behavior.
     */
    onkeydown?: (
      event: KeyboardEvent,
      context: {
        annotation: Annotation | undefined;
        index: number;
        annotations: Annotation[];
      },
    ) => void;
    /**
     * Optional snippet for full control over segment rendering.
     * Receives annotation data and a segmentAttrs spread object.
     * Takes priority over `text` snippet.
     */
    segment?: Snippet<[SegmentSnippetProps]>;
    /**
     * Optional snippet to customize how annotation text is rendered.
     * Receives the annotation object. When omitted, renders plain text.
     *
     * **Caution:** If using `{@html}`, ensure annotation text is sanitized
     * to prevent XSS. The default rendering escapes text automatically.
     */
    text?: Snippet<[{ annotation: Annotation }]>;
    class?: string;
  }

  let {
    annotations: annotationsProp,
    activeAnnotationId: activeAnnotationIdProp,
    highlightedIds: highlightedIdsProp,
    currentMatchId: currentMatchIdProp,
    highlightedAnnotationId = null,
    onclick: onclickProp,
    onkeydown: onkeydownProp,
    segment,
    text,
    class: className = "",
  }: Props = $props();

  // Try to read TranscriptContext (available when inside Transcript)
  const transcriptCtx = tryGetTranscriptContext();

  // Use context values when available, fall back to props
  const annotations = $derived(
    annotationsProp ?? transcriptCtx?.state.annotations ?? [],
  );
  const activeAnnotationId = $derived(
    activeAnnotationIdProp ?? transcriptCtx?.state.activeAnnotationId ?? null,
  );
  const highlightedIds = $derived.by(() => {
    const base =
      highlightedIdsProp ??
      transcriptCtx?.state.highlightedIds ??
      new Set<string>();
    if (!highlightedAnnotationId) return base;
    // Merge deep-link highlight with search highlights
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local computation, not reactive state
    const merged = new Set(base);
    merged.add(highlightedAnnotationId);
    return merged;
  });
  const currentMatchId = $derived(
    currentMatchIdProp ?? transcriptCtx?.state.currentMatchId ?? null,
  );
  const onclick = $derived(
    onclickProp ?? transcriptCtx?.actions.handleAnnotationClick,
  );

  // Container element ref for imperative API
  let containerEl: HTMLElement | undefined = $state();

  // Roving tabindex: rawFocusedIndex holds the user's keyboard position,
  // focusedIndex clamps it to valid bounds. Using $derived (not $effect)
  // keeps the clamped value synchronous — no render frame where tabindex=0
  // is missing. Only resets when the index exceeds the array, preserving
  // position through changes that don't invalidate it (e.g. clearing a filter).
  let rawFocusedIndex = $state(0);
  const focusedIndex = $derived(
    rawFocusedIndex >= annotations.length ? 0 : rawFocusedIndex,
  );

  /**
   * Scroll a specific annotation into view.
   * Returns true if the annotation was found, false otherwise.
   * Respects prefers-reduced-motion by default; pass options to override.
   */
  export function scrollToAnnotation(
    annotationId: string,
    // eslint-disable-next-line no-undef
    options?: ScrollIntoViewOptions,
  ): boolean {
    if (!containerEl) return false;
    const el = containerEl.querySelector(
      `[data-annotation-id="${CSS.escape(annotationId)}"]`,
    );
    if (!el) return false;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    el.scrollIntoView(
      options ?? {
        behavior: prefersReducedMotion ? "instant" : "smooth",
        block: "center",
        inline: "nearest",
      },
    );
    return true;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (annotations.length === 0) return;

    // Don't intercept keystrokes in text inputs (prevents hijacking typing)
    const tag = (event.target as HTMLElement)?.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      (event.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    // Fire consumer handler before built-in navigation
    onkeydownProp?.(event, {
      annotation: annotations[focusedIndex],
      index: focusedIndex,
      annotations,
    });

    // If consumer called preventDefault(), skip built-in nav
    if (event.defaultPrevented) return;

    const nextIndex = getNextIndex(event.key, focusedIndex, annotations.length);
    if (nextIndex !== null) {
      event.preventDefault();
      rawFocusedIndex = nextIndex;
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
    bind:this={containerEl}
  >
    {#each annotations as annotation, i (annotation.id)}
      {@const isActive = activeAnnotationId === annotation.id}
      {@const isHighlighted =
        highlightedIds.has(annotation.id) && currentMatchId !== annotation.id}
      {@const isCurrentMatch = currentMatchId === annotation.id}
      {#if segment}
        {@render segment({
          annotation,
          isActive,
          isHighlighted,
          isCurrentMatch,
          index: i,
          segmentAttrs: {
            "data-annotation-id": annotation.id,
            "data-state": isActive ? "active" : "inactive",
            "data-highlighted": isHighlighted ? "true" : undefined,
            "data-current-match": isCurrentMatch ? "true" : undefined,
            "aria-current": isActive ? "true" : undefined,
            role: "button",
            tabindex: i === focusedIndex ? 0 : -1,
            onclick: () => onclick?.(annotation),
          },
        })}
      {:else}
        <Segment
          {annotation}
          {text}
          {isActive}
          {isHighlighted}
          {isCurrentMatch}
          onclick={() => onclick?.(annotation)}
          tabindex={i === focusedIndex ? 0 : -1}
        />
      {/if}
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
