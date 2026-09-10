<!--
  Test wrapper for the "two-panel independence" acceptance row: two
  Transcript + TranscriptSegments panels under the same player context,
  each with its own annotations and its own captured TranscriptContext, so
  a test can toggle reading mode on one panel and assert the other's
  reading state (and scroll-to-seek behavior) is untouched.
-->
<script lang="ts">
  import { setPlayerContext } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";
  import Transcript from "../../lib/player/Transcript.svelte";
  import TranscriptSegments from "../../lib/player/TranscriptSegments.svelte";
  import TestTranscriptContextConsumer from "./TestTranscriptContextConsumer.svelte";
  import type { TranscriptContext } from "../../lib/player/transcript-context";
  import type { Annotation } from "../../lib/sync/types";

  interface Props {
    context: PlayerContext;
    annotationsA: Annotation[];
    annotationsB: Annotation[];
    onContextReadyA: (ctx: TranscriptContext) => void;
    onContextReadyB: (ctx: TranscriptContext) => void;
  }

  let {
    context,
    annotationsA,
    annotationsB,
    onContextReadyA,
    onContextReadyB,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  setPlayerContext(context);
</script>

<div class="panel-a">
  <Transcript annotations={annotationsA}>
    <TestTranscriptContextConsumer onResult={onContextReadyA} />
    <TranscriptSegments />
  </Transcript>
</div>

<div class="panel-b">
  <Transcript annotations={annotationsB}>
    <TestTranscriptContextConsumer onResult={onContextReadyB} />
    <TranscriptSegments />
  </Transcript>
</div>
