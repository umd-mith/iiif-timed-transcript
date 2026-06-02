<script lang="ts">
  import { setPlayerContext } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";

  import type { Snippet } from "svelte";

  let { context, children }: { context: PlayerContext; children: Snippet } =
    $props();

  // `context` is read once at init: setContext must run during component
  // initialization and the test never reassigns the prop.
  // svelte-ignore state_referenced_locally
  setPlayerContext(context);
</script>

{@render children()}
