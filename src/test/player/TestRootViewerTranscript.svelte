<script lang="ts">
  import Root from "../../lib/player/Root.svelte";
  import Viewer from "../../lib/player/Viewer.svelte";
  import Transcript from "../../lib/player/Transcript.svelte";
  import TestContextConsumer from "./TestContextConsumer.svelte";
  import type {
    PlayerContext,
    PlayerErrorInfo,
  } from "../../lib/player/context";
  import type { Annotation } from "../../lib/sync/types";

  let {
    manifestUrl,
    annotations: initialAnnotations,
    renderTranscript = true,
    onResult,
    onError,
  }: {
    manifestUrl: string;
    annotations: Annotation[] | "auto";
    renderTranscript?: boolean;
    onResult: (ctx: PlayerContext) => void;
    onError?: (error: Error, info: PlayerErrorInfo) => void;
  } = $props();

  // Seeded from the initial prop only; afterwards the wrapper is uncontrolled
  // and driven via setAnnotations, so tests can flip annotations="auto" <->
  // Annotation[] against the real Root + Viewer + Transcript composition.
  // svelte-ignore state_referenced_locally
  let annotations = $state<Annotation[] | "auto">(initialAnnotations);

  export function setAnnotations(value: Annotation[] | "auto") {
    annotations = value;
  }
</script>

<!--
  A real Root + Viewer + Transcript composition — the actual wiring under
  test for the VTT design's native-caption policy: Transcript publishes
  `transcriptPopulated` on the *same* PlayerContext instance Viewer reads
  it from via context (TestContextConsumer captures that instance too, so
  assertions see live updates), not through a hand-built mock.
  `renderTranscript` lets a test mount without <Transcript /> to cover the
  "panel stays empty" negative case.
-->
<Root {manifestUrl} {annotations} onError={onError ?? (() => {})}>
  <Viewer />
  {#if renderTranscript}
    <Transcript />
  {/if}
  <TestContextConsumer {onResult} />
</Root>
