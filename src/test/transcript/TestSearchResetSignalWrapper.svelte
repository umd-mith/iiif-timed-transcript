<!--
  Test wrapper exposing Search's `resetSignal` prop as a mutable, exported
  bump — following TestTranscriptReadingMode.svelte's pattern one directory
  over: `context`/`annotations`-style props are read once, and an exported
  imperative setter mutates local state the same way a host-level context
  reset action would (Transcript bumping `queryResetSignal` on annotation
  replacement).
-->
<script lang="ts">
  import Search from "../../lib/transcript/Search.svelte";
  import type { Annotation } from "../../lib/sync/types";

  interface Props {
    annotations: Annotation[];
    onmatchchange?: (matches: Annotation[], index: number) => void;
  }
  let { annotations, onmatchchange }: Props = $props();

  let resetSignal = $state(0);

  /** Simulates a context-level query-reset signal bump (Finding 2). */
  export function bumpResetSignal() {
    resetSignal++;
  }
</script>

<Search {annotations} {onmatchchange} {resetSignal} />
