<script lang="ts">
  import { setTranscriptContext } from "../../lib/player/transcript-context";
  import type { TranscriptContext } from "../../lib/player/transcript-context";

  import type { Snippet } from "svelte";

  let { context, children }: { context: TranscriptContext; children: Snippet } =
    $props();

  setTranscriptContext(context);
</script>

{@render children()}
