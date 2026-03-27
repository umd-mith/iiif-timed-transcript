<script lang="ts">
  import type { Snippet } from "svelte";
  import { getPlayerContext } from "./context";

  let {
    class: className = "",
    loading,
    pause,
    play,
  }: {
    class?: string;
    loading?: Snippet | string;
    pause?: Snippet | string;
    play?: Snippet | string;
  } = $props();

  const { state, actions } = getPlayerContext();

  const label = $derived(
    state.isBuffering ? (loading ?? "Loading...") :
    state.isPlaying   ? (pause  ?? "Pause!")       :
                        (play   ?? "Play!")
  );

  const labelIsSnippet = $derived(typeof label === "function");

  function handleClick() {
    if (state.isPlaying) {
      actions.pause();
    } else {
      actions.play();
    }
  }
</script>

<button
  type="button"
  data-audio-button="play-pause"
  disabled={!state.isReady}
  onclick={handleClick}
  class={className}
>
  {#if labelIsSnippet}
    {@render (label as Snippet)()}
  {:else}
    {label}
  {/if}
</button>