<script lang="ts">
  import Root from "../../lib/player/Root.svelte";
  import Viewer from "../../lib/player/Viewer.svelte";
  import Transcript from "../../lib/player/Transcript.svelte";
  import TranscriptSegments from "../../lib/player/TranscriptSegments.svelte";
  import TestContextConsumer from "./TestContextConsumer.svelte";
  import type {
    PlayerContext,
    PlayerErrorInfo,
  } from "../../lib/player/context";
  import type { Annotation } from "../../lib/sync/types";

  let {
    manifestUrl,
    annotations,
    onResult,
    onError,
  }: {
    manifestUrl: string;
    annotations: Annotation[] | "auto";
    onResult: (ctx: PlayerContext) => void;
    onError?: (error: Error, info: PlayerErrorInfo) => void;
  } = $props();
</script>

<!--
  The canonical transcript composition (Root + Viewer + Transcript >
  TranscriptSegments), so the rendered segment text and timestamps land in the
  DOM — what the ownership harness actually asserts on.
-->
<Root {manifestUrl} {annotations} onError={onError ?? (() => {})}>
  <Viewer />
  <Transcript>
    <TranscriptSegments />
  </Transcript>
  <TestContextConsumer {onResult} />
</Root>
