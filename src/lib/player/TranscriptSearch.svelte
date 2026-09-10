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
  // The context's handleQueryInput is optional (a seam the reading-mode step
  // fills in) — read at call time rather than snapshotting a possibly-absent
  // function into the default.
  const onqueryinput = $derived(
    onqueryinputProp ??
      ((value: string) => transcriptCtx?.actions.handleQueryInput?.(value)),
  );
  // Only "activate" mode shows the activation control here; reading mode
  // will OR into this once the transcript context exposes it.
  const showActivation = $derived(
    transcriptCtx?.state.searchSeekBehavior === "activate",
  );
</script>

<div class="transcript-search-sticky">
  <Search
    {annotations}
    {placeholder}
    {debounceMs}
    {onmatchchange}
    {onmatchactivate}
    {onqueryinput}
    {showActivation}
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
