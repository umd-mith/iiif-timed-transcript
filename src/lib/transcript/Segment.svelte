<!-- src/lib/transcript/Segment.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Annotation } from "../sync/types";
  import { formatTimestamp } from "./utils";

  interface Props {
    /** Transcript annotation with timing and text */
    annotation: Annotation;
    /**
     * Whether this segment is currently active (playing).
     * @default false
     */
    isActive?: boolean;
    /**
     * Whether this segment is highlighted from search.
     * @default false
     */
    isHighlighted?: boolean;
    /**
     * Whether this is the current search match (stronger highlight).
     * @default false
     */
    isCurrentMatch?: boolean;
    /**
     * Click handler (typically wired to viewer.seekTo).
     * @default undefined
     */
    onclick?: () => void;
    /**
     * Optional snippet to customize how annotation text is rendered.
     * Receives the annotation object. When omitted, renders plain text.
     *
     * **Caution:** If using `{@html}`, ensure annotation text is sanitized
     * to prevent XSS. The default rendering escapes text automatically.
     *
     * @example
     * ```svelte
     * <Segment {annotation}>
     *   {#snippet text({ annotation })}
     *     <p class="text">{@html annotation.text}</p>
     *   {/snippet}
     * </Segment>
     * ```
     */
    text?:
      | Snippet<[{ annotation: Annotation; language: string | undefined }]>
      | undefined;
    tabindex?: number;
  }

  let {
    annotation,
    isActive = false,
    isHighlighted = false,
    isCurrentMatch = false,
    onclick,
    text,
    tabindex,
  }: Props = $props();
</script>

<div
  role="button"
  data-annotation-id={annotation.id}
  data-state={isActive ? "active" : "inactive"}
  data-highlighted={isHighlighted ? "true" : undefined}
  data-current-match={isCurrentMatch ? "true" : undefined}
  {onclick}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onclick?.();
    }
  }}
  aria-current={isActive ? "true" : undefined}
  tabindex={tabindex ?? 0}
>
  <span class="timestamp">{formatTimestamp(annotation.startTime)}</span>
  {#if text}
    {@render text({ annotation, language: annotation.language })}
  {:else}
    <p class="text" lang={annotation.language}>{annotation.text}</p>
  {/if}
</div>

<style>
  /* Unstyled - consumers use data attributes for styling */
  div {
    all: unset;
    display: block;
    width: 100%;
    cursor: pointer;
  }

  div:focus {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  div:focus:not(:focus-visible) {
    outline: none;
  }
</style>
