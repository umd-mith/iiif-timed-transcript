<script lang="ts">
  import { getPlayerContext } from "./context";
  import { formatTimestamp } from "../transcript/utils";
  import { t } from "../i18n/registry.svelte";

  let {
    class: className = "",
  }: {
    class?: string;
  } = $props();

  const { state } = getPlayerContext();

  let formatted = $derived(
    `${formatTimestamp(state.currentTime)} / ${formatTimestamp(state.duration)}`,
  );
</script>

<div
  data-audio-control="time"
  role="timer"
  aria-label={t("player.timeLabel")}
  class={className}
>
  {formatted}
</div>
