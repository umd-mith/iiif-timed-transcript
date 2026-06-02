<script lang="ts">
  import { setTranscriptContext } from "../../lib/player/transcript-context";
  import type { TranscriptContext } from "../../lib/player/transcript-context";

  import type { Snippet } from "svelte";

  let { context, children }: { context: TranscriptContext; children: Snippet } =
    $props();

  // `context` is read once at init: setContext must run during component
  // initialization and the test never reassigns the prop.
  // svelte-ignore state_referenced_locally
  setTranscriptContext(context);
</script>

{@render children()}
