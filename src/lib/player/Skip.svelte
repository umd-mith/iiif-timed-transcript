<script lang="ts">
  import { getPlayerContext } from "./context";
  import { t } from "../i18n/registry.svelte";

  let {
    seconds,
    class: className = "",
  }: {
    seconds: number;
    class?: string;
  } = $props();

  const { state, actions } = getPlayerContext();

  function handleClick() {
    actions.seekTo(state.currentTime + seconds);
  }

  let label = $derived(seconds >= 0 ? `+${seconds}s` : `${seconds}s`);
  let ariaLabel = $derived(
    seconds >= 0
      ? t("player.skipForward", { seconds })
      : t("player.skipBack", { seconds: Math.abs(seconds) }),
  );
</script>

<button
  type="button"
  data-audio-button="skip"
  disabled={!state.isReady}
  onclick={handleClick}
  aria-label={ariaLabel}
  class={className}
>
  {label}
</button>
