<script lang="ts">
  import { getPlayerContext } from "../../lib/player/context";

  import type { PlayerContext } from "../../lib/player/context";

  let { onResult }: { onResult: (ctx: PlayerContext) => void } = $props();

  const ctx = getPlayerContext();
  // `onResult` is invoked once at init to report the captured context proxy;
  // the test never reassigns the callback prop.
  // svelte-ignore state_referenced_locally
  onResult(ctx);
</script>

<div data-testid="consumer">Context received</div>
