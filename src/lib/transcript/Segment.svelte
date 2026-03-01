<!-- src/lib/transcript/Segment.svelte -->
<script lang="ts">
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
    tabindex?: number;
  }

  let {
    annotation,
    isActive = false,
    isHighlighted = false,
    isCurrentMatch = false,
    onclick,
    tabindex,
  }: Props = $props();
</script>

<button
  type="button"
  data-annotation-id={annotation.id}
  data-state={isActive ? "active" : "inactive"}
  data-highlighted={isHighlighted ? "true" : undefined}
  data-current-match={isCurrentMatch ? "true" : undefined}
  {onclick}
  aria-current={isActive ? "true" : undefined}
  tabindex={tabindex ?? 0}
>
  <span class="timestamp">{formatTimestamp(annotation.startTime)}</span>
  <p class="text">{annotation.text}</p>
</button>

<style>
  /* Unstyled - consumers use data attributes for styling */
  button {
    all: unset;
    display: block;
    width: 100%;
    cursor: pointer;
  }

  button:focus {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  button:focus:not(:focus-visible) {
    outline: none;
  }
</style>
