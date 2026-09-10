<!--
  Test wrapper that sets PlayerContext and mounts Transcript with
  TranscriptSearch as a compound child, so tests can exercise the real
  Search -> TranscriptSearch -> Transcript -> PlayerContext wiring (typing,
  Enter, browsing, activation) through actual user interactions rather than
  a captured context.

  `context` is read once at init: setPlayerContext must run during
  initialization and the test never reassigns the prop (same contract as
  TestContextHarness). annotations is uncontrolled after mount — driven
  imperatively via setAnnotations, following TestRootAnnotationsWrapper's
  pattern — so tests can exercise annotation replacement without a remount.
-->
<script lang="ts">
  import { setPlayerContext } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";
  import Transcript from "../../lib/player/Transcript.svelte";
  import TranscriptSearch from "../../lib/player/TranscriptSearch.svelte";
  import type { Annotation } from "../../lib/sync/types";

  interface Props {
    context: PlayerContext;
    annotations?: Annotation[];
    searchSeekBehavior?: "change" | "activate";
  }

  let {
    context,
    annotations: initialAnnotations,
    searchSeekBehavior,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  setPlayerContext(context);

  // svelte-ignore state_referenced_locally
  let annotations = $state<Annotation[] | undefined>(initialAnnotations);

  export function setAnnotations(value: Annotation[]) {
    annotations = value;
  }
</script>

<Transcript
  {...annotations ? { annotations } : {}}
  {...searchSeekBehavior ? { searchSeekBehavior } : {}}
>
  <TranscriptSearch />
</Transcript>
