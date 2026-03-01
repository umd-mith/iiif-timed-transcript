<script lang="ts">
  let {
    class: className = "",
    children,
  }: {
    class?: string;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<div
  data-audio-controls
  role="group"
  aria-label="Media controls"
  class={className}
>
  {#if children}
    {@render children()}
  {/if}
</div>
