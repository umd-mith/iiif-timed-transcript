<!--
  Test wrapper for the reading-mode acceptance rows (docs/specs/
  transcript-reading-mode.md): a single Transcript + TranscriptSegments
  panel with `scrollToSeek` and a bindable `readingMode` exposed as props,
  plus `setReadingMode` — an exported imperative setter that mutates the
  bound value exactly the way an external host's own `bind:readingMode`
  would, standing in for a "host property write" from outside the panel
  (as opposed to a click on the panel's own Follow along switch / Jump to
  current button).

  `context` is read once at init, same contract as the other Test*Harness
  components in this directory: setPlayerContext must run during
  initialization and the test never reassigns the prop.
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
    annotations: Annotation[];
    scrollToSeek?: boolean;
    readingMode?: boolean;
    onContextReady?: (ctx: TranscriptContext) => void;
  }

  let {
    context,
    annotations,
    scrollToSeek,
    readingMode = $bindable(false),
    onContextReady,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  setPlayerContext(context);

  /** Simulates an external host property write (not the panel's own UI). */
  export function setReadingMode(value: boolean) {
    readingMode = value;
  }
</script>

<Transcript
  {annotations}
  {...scrollToSeek === undefined ? {} : { scrollToSeek }}
  bind:readingMode
>
  {#if onContextReady}
    <TestTranscriptContextConsumer onResult={onContextReady} />
  {/if}
  <TranscriptSegments />
</Transcript>
