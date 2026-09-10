<script lang="ts">
  import { setTranscriptContext } from "../../lib/player/transcript-context";
  import type { TranscriptContext } from "../../lib/player/transcript-context";
  import type { Component } from "svelte";

  // A test-only wrapper: sets the transcript context, then renders the
  // component under test with the given props. Lets transcript-context tests
  // use vitest-browser-svelte's render() (and its automatic unmount cleanup).
  let {
    context,
    component: Child,
    props = {},
  }: {
    context: TranscriptContext;
    component: Component<any>;
    props?: Record<string, unknown>;
  } = $props();

  // `context` is read once at init: setTranscriptContext must run during
  // initialization and the test never reassigns the prop.
  // svelte-ignore state_referenced_locally
  setTranscriptContext(context);
</script>

<Child {...props} />
