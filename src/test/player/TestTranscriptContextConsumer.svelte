<script lang="ts">
  import { getTranscriptContext } from "../../lib/player/transcript-context";

  import type { TranscriptContext } from "../../lib/player/transcript-context";

  let { onResult }: { onResult: (ctx: TranscriptContext) => void } = $props();

  const ctx = getTranscriptContext();
  onResult(ctx);
</script>

<div data-testid="transcript-consumer">Transcript context received</div>
