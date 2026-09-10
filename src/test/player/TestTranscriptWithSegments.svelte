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
    // Optional: when omitted, Transcript falls back to PlayerContext
    // annotations (exercised by the context-fallback capture tests).
    annotations?: Annotation[];
    searchSeekBehavior?: "change" | "activate";
    onContextReady?: (ctx: TranscriptContext) => void;
  }

  let { annotations, searchSeekBehavior, onContextReady }: Props = $props();
</script>

<!-- Omit the annotations/searchSeekBehavior props entirely when undefined so
     Transcript falls back to PlayerContext annotations and its own default
     (and to satisfy exactOptionalPropertyTypes). -->
<Transcript
  {...annotations ? { annotations } : {}}
  {...searchSeekBehavior ? { searchSeekBehavior } : {}}
>
  {#if onContextReady}
    <TestTranscriptContextConsumer onResult={onContextReady} />
  {/if}
  <TranscriptSegments />
</Transcript>
