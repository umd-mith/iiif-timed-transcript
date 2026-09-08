<script lang="ts">
  import { getPlayerContext } from "./context";
  import { t } from "../i18n/registry.svelte";

  let {
    rates = [0.5, 0.75, 1, 1.25, 1.5, 2],
    class: className = "",
  }: {
    rates?: number[];
    class?: string;
  } = $props();

  const { state, actions } = getPlayerContext();

  function handleChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const rate = parseFloat(select.value);
    actions.setPlaybackRate(rate);
  }
</script>

<select
  data-audio-control="speed"
  disabled={!state.isReady}
  value={state.playbackRate}
  onchange={handleChange}
  aria-label={t("player.speedLabel")}
  class={className}
>
  {#each rates as rate (rate)}
    <option value={rate}>{rate}x</option>
  {/each}
</select>
