<script lang="ts">
  import { setPlayerContext } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";
  import type { Annotation } from "../../lib/sync/types";
  import Transcript from "../../lib/player/Transcript.svelte";

  // A test-only wrapper: one populated Transcript panel and one bare panel
  // under the same player context, used to prove the transcriptPopulated
  // effect converges ("true wins") instead of ping-ponging between instances.
  let {
    context,
    annotations,
  }: { context: PlayerContext; annotations: Annotation[] } = $props();

  // svelte-ignore state_referenced_locally
  setPlayerContext(context);
</script>

<Transcript {annotations} />
<Transcript />
