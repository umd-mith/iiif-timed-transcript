<script lang="ts">
  import Root from "../../lib/player/Root.svelte";
  import TestContextConsumer from "./TestContextConsumer.svelte";
  import type {
    PlayerContext,
    PlayerErrorInfo,
  } from "../../lib/player/context";
  import type { Annotation } from "../../lib/sync/types";

  let {
    manifestUrl,
    canvasIndex = 0,
    annotations: initialAnnotations,
    onError,
    onResult,
  }: {
    manifestUrl: string;
    canvasIndex?: number;
    annotations: Annotation[] | "auto";
    onError?: (error: Error, info: PlayerErrorInfo) => void;
    onResult: (ctx: PlayerContext) => void;
  } = $props();

  // Seed local state from the initial prop value only; the wrapper is an
  // uncontrolled component driven afterwards via the imperative setAnnotations,
  // so tests can flip annotations="auto" <-> Annotation[] without a remount.
  // svelte-ignore state_referenced_locally
  let annotations = $state<Annotation[] | "auto">(initialAnnotations);

  export function setAnnotations(value: Annotation[] | "auto") {
    annotations = value;
  }
</script>

<Root {manifestUrl} {canvasIndex} {annotations} {...onError ? { onError } : {}}>
  <TestContextConsumer {onResult} />
</Root>
