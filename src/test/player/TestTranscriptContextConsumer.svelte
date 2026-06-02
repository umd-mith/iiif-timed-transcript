<script lang="ts">
  import { getTranscriptContext } from "../../lib/player/transcript-context";

  import type { TranscriptContext } from "../../lib/player/transcript-context";

  let { onResult }: { onResult: (ctx: TranscriptContext) => void } = $props();

  const ctx = getTranscriptContext();
  // `onResult` is invoked once at init to report the captured context proxy;
  // the test never reassigns the callback prop.
  // svelte-ignore state_referenced_locally
  onResult(ctx);
</script>

<div data-testid="transcript-consumer">Transcript context received</div>
