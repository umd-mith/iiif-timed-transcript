<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Root from "../../lib/player/Root.svelte";
  import TestContextConsumer from "./TestContextConsumer.svelte";
  import type { PlayerContext } from "../../lib/player/context";

  // A test-only wrapper: renders Root (which provides the player context) with
  // a TestContextConsumer child that reports the captured context. Replaces the
  // manual mount(Root, { children: createContextCapture(target, cb) }) pattern
  // so Root-capture tests can use vitest-browser-svelte's render().
  let {
    onResult,
    ...rootProps
  }: { onResult: (ctx: PlayerContext) => void } & Omit<
    ComponentProps<typeof Root>,
    "children"
  > = $props();
</script>

<Root {...rootProps}>
  <TestContextConsumer {onResult} />
</Root>
