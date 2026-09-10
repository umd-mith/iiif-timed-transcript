<script lang="ts">
  import Search from "../transcript/Search.svelte";
  import { tryGetTranscriptContext } from "./transcript-context";
  import type { Annotation } from "../sync/types";
  import { t } from "../i18n/registry.svelte";

  interface Props {
    annotations?: Annotation[];
    placeholder?: string;
    debounceMs?: number;
    onmatchchange?: (matches: Annotation[], index: number) => void;
    /**
     * Fired on explicit activation (Enter or "Go to match"). Overrides the
     * default, which seeks once through the transcript context.
     */
    onmatchactivate?: (annotation: Annotation, index: number) => void;
    /**
     * Fired only from explicit previous/next navigation (never typing or
     * activation). Overrides the default, which scrolls the newly-selected
     * match into view through the transcript context's `scrollToAnnotation`.
     */
    onmatchnavigate?: (annotation: Annotation, index: number) => void;
    /**
     * Fired synchronously from `Search`'s raw input event, before debounce.
     * Overrides the default, which forwards the value to the transcript
     * context's `handleQueryInput` seam.
     */
    onqueryinput?: (value: string) => void;
    class?: string;
  }

  let {
    annotations: annotationsProp,
    placeholder: placeholderProp,
    debounceMs = 150,
    onmatchchange: onmatchchangeProp,
    onmatchactivate: onmatchactivateProp,
    onmatchnavigate: onmatchnavigateProp,
    onqueryinput: onqueryinputProp,
    class: className = "",
  }: Props = $props();

  const placeholder = $derived(
    placeholderProp ?? t("transcript.searchPlaceholder"),
  );

  // Try to read TranscriptContext (available when inside Transcript)
  const transcriptCtx = tryGetTranscriptContext();

  // Use context values when available, fall back to props
  const annotations = $derived(
    annotationsProp ?? transcriptCtx?.state.annotations ?? [],
  );
  const onmatchchange = $derived(
    onmatchchangeProp ?? transcriptCtx?.actions.handleMatchChange,
  );
  const onmatchactivate = $derived(
    onmatchactivateProp ?? transcriptCtx?.actions.handleMatchActivate,
  );
  // Default scrolls the newly-selected match into view via the context —
  // distinct from onmatchchange/onmatchactivate, and never fired from typing
  // (spec: typing must not scroll). Scoped to activate mode or Browsing:
  // in the legacy default (searchSeekBehavior="change", reading mode off),
  // prev/next historically only changed the match and sought through
  // onmatchchange — no explicit programmatic scroll.
  const onmatchnavigate = $derived(
    onmatchnavigateProp ??
      ((annotation: Annotation) => {
        const state = transcriptCtx?.state;
        if (
          state?.searchSeekBehavior === "activate" ||
          state?.readingMode === true
        ) {
          transcriptCtx?.actions.scrollToAnnotation(annotation.id);
        }
      }),
  );
  // The context's handleQueryInput is optional (a seam the reading-mode step
  // fills in) — read at call time rather than snapshotting a possibly-absent
  // function into the default.
  const onqueryinput = $derived(
    onqueryinputProp ??
      ((value: string) => transcriptCtx?.actions.handleQueryInput?.(value)),
  );
  // Show the activation control when searchSeekBehavior is "activate" OR
  // while Browsing (reading mode active) — in legacy "change" mode, entering
  // Browsing still needs an explicit way to jump to a match, since Browsing
  // suppresses the seek-on-select that "change" mode otherwise relies on.
  const showActivation = $derived(
    transcriptCtx?.state.searchSeekBehavior === "activate" ||
      transcriptCtx?.state.readingMode === true,
  );
</script>

<div class="transcript-search-sticky">
  <Search
    {annotations}
    {placeholder}
    {debounceMs}
    {onmatchchange}
    {onmatchactivate}
    {onmatchnavigate}
    {onqueryinput}
    {showActivation}
    resetSignal={transcriptCtx?.state.queryResetSignal}
    class={className}
  />
</div>

<style>
  .transcript-search-sticky {
    position: sticky;
    top: 0;
    z-index: 1;
    background: inherit;
  }
</style>
