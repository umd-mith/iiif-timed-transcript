<script lang="ts">
  import { getTranscriptContext } from "../../lib/player/transcript-context";

  let { onResult }: { onResult: (ctx: any) => void } = $props();

  const ctx = getTranscriptContext();
  onResult(ctx);
</script>

<div data-testid="transcript-consumer">Transcript context received</div>
