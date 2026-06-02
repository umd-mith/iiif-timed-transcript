<script lang="ts">
  import Root from "../../lib/player/Root.svelte";
  import TestContextConsumer from "./TestContextConsumer.svelte";
  import type { PlayerContext } from "../../lib/player/context";

  let {
    manifestUrl,
    canvasIndex: initialCanvasIndex = 0,
    onResult,
  }: {
    manifestUrl: string;
    canvasIndex?: number;
    onResult: (ctx: PlayerContext) => void;
  } = $props();

  // Seed local state from the initial prop value only; the wrapper is an
  // uncontrolled component driven afterwards via the imperative setCanvasIndex.
  // svelte-ignore state_referenced_locally
  let canvasIndex = $state(initialCanvasIndex);

  export function setCanvasIndex(idx: number) {
    canvasIndex = idx;
  }
</script>

<Root {manifestUrl} {canvasIndex}>
  <TestContextConsumer {onResult} />
</Root>
