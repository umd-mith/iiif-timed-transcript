<script lang="ts">
  import { setPlayerContext } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";

  import type { Snippet } from "svelte";

  let { context, children }: { context: PlayerContext; children: Snippet } =
    $props();

  setPlayerContext(context);
</script>

{@render children()}
