<script lang="ts">
  import { setContext } from "svelte";
  import { PLAYER_CONTEXT_KEY } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";

  import type { Snippet } from "svelte";

  let { context, children }: { context: PlayerContext; children: Snippet } =
    $props();

  setContext(PLAYER_CONTEXT_KEY, context);
</script>

{@render children()}
