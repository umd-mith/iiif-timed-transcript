<!--
  Test wrapper that mounts Transcript with TranscriptSegments as proper children,
  so segments render inside the scroll container (transcript-panel).
  A TestTranscriptContextConsumer captures the context for assertions.
-->
<script lang="ts">
  import Transcript from "../../lib/player/Transcript.svelte";
  import TranscriptSegments from "../../lib/player/TranscriptSegments.svelte";
  import TestTranscriptContextConsumer from "./TestTranscriptContextConsumer.svelte";
  import type { TranscriptContext } from "../../lib/player/transcript-context";
  import type { Annotation } from "../../lib/sync/types";

  interface Props {
    annotations: Annotation[];
    onContextReady?: (ctx: TranscriptContext) => void;
  }

  let { annotations, onContextReady }: Props = $props();
</script>

<Transcript {annotations}>
  {#if onContextReady}
    <TestTranscriptContextConsumer onResult={onContextReady} />
  {/if}
  <TranscriptSegments />
</Transcript>
