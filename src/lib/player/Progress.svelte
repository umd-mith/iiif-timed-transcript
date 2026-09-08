<script lang="ts">
  import { getPlayerContext } from "./context";
  import { formatTimestamp } from "../transcript/utils";
  import { t } from "../i18n/registry.svelte";

  let {
    class: className = "",
  }: {
    class?: string;
  } = $props();

  const { state, actions } = getPlayerContext();

  let valueText = $derived(
    t("player.progressValueText", {
      current: formatTimestamp(state.currentTime),
      duration: formatTimestamp(state.duration),
    }),
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    actions.seekTo(parseFloat(target.value));
  }
</script>

<input
  type="range"
  part="progress"
  min={0}
  max={state.duration}
  value={state.currentTime}
  step="any"
  aria-label={t("player.progressLabel")}
  aria-valuetext={valueText}
  data-audio-progress
  oninput={handleInput}
  class={className}
/>
