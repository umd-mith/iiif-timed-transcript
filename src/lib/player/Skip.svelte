<script lang="ts">
  import { getPlayerContext } from "./context";

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
      ? `Skip forward ${seconds} seconds`
      : `Skip back ${Math.abs(seconds)} seconds`,
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
