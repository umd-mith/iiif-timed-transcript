<script lang="ts">
  import { t } from "../i18n/registry.svelte";

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
  part="controls"
  role="group"
  aria-label={t("player.controlsLabel")}
  class={className}
>
  {#if children}
    {@render children()}
  {/if}
</div>
