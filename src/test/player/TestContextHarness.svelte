<script lang="ts">
  import { setPlayerContext } from "../../lib/player/context";
  import type { PlayerContext } from "../../lib/player/context";
  import type { Component } from "svelte";

  // A test-only wrapper: sets the player context, then renders the component
  // under test with the given props. Replaces the manual
  // TestContextProvider + createChildSnippet(target, …) mounting so tests can
  // use vitest-browser-svelte's render() (and its automatic unmount cleanup).
  let {
    context,
    component: Child,
    props = {},
  }: {
    context: PlayerContext;
    component: Component<any>;
    props?: Record<string, unknown>;
  } = $props();

  // `context` is read once at init: setPlayerContext must run during
  // initialization and the test never reassigns the prop.
  // svelte-ignore state_referenced_locally
  setPlayerContext(context);
</script>

<Child {...props} />
