<script lang="ts">
  import Root from "../../lib/player/Root.svelte";
  import Viewer from "../../lib/player/Viewer.svelte";
  import Captions from "../../lib/player/Captions.svelte";
  import TestContextConsumer from "./TestContextConsumer.svelte";
  import type {
    PlayerContext,
    PlayerErrorInfo,
    TrackDefinition,
  } from "../../lib/player/context";

  let {
    manifestUrl,
    tracks = [],
    canvasIndex = 0,
    onResult,
    onError,
  }: {
    manifestUrl: string;
    /** Captions supplied straight to Viewer, bypassing manifest discovery. */
    tracks?: TrackDefinition[];
    canvasIndex?: number;
    onResult: (ctx: PlayerContext) => void;
    onError?: (error: Error, info: PlayerErrorInfo) => void;
  } = $props();
</script>

<!--
  Real Root + Viewer + Captions composition. The `tracks` prop reaches Viewer
  directly (the manifest may carry no caption annotations at all), which is the
  exact seam under test: Captions must still recognize those tracks.
-->
<Root
  {manifestUrl}
  {canvasIndex}
  annotations={[]}
  onError={onError ?? (() => {})}
>
  <Viewer {tracks} />
  <Captions />
  <TestContextConsumer {onResult} />
</Root>
