<script lang="ts">
  /**
   * Demo: onPlayerInit — accessing player state outside Root
   *
   * Shows the key use case: a sibling "status dashboard" that reads
   * PlayerRef reactively, connected via the onPlayerInit callback.
   * The dashboard is outside Root's subtree, so it cannot use
   * getPlayerContext(). Instead, onPlayerInit bridges the gap.
   *
   */
  import {
    IIIFPlayer,
    type PlayerRef,
  } from "@umd-mith/svelte-iiif-transcript-player";

  let {
    manifestUrl,
  }: {
    manifestUrl: string;
  } = $props();

  // PlayerRef lives outside Root — populated by onPlayerInit
  let player = $state<PlayerRef | null>(null);

  function handlePlayerInit(ref: PlayerRef) {
    player = ref;
  }

  let formattedTime = $derived(
    player ? formatTime(player.state.currentTime) : "--:--",
  );
  let formattedDuration = $derived(
    player ? formatTime(player.state.duration) : "--:--",
  );
  let progressPercent = $derived(
    player && player.state.duration > 0
      ? Math.round(
          (player.state.currentTime / player.state.duration) * 100,
        )
      : 0,
  );

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
</script>

<div class="w-full player-init-demo">
  <div class="grid md:grid-cols-[1fr,320px] gap-6 items-start">
    <!-- Left: Player (inside Root subtree) -->
    <div class="flex flex-col gap-4">
      <IIIFPlayer.Root {manifestUrl} onPlayerInit={handlePlayerInit}>
        <div
          class="bg-gray-900 rounded-lg overflow-hidden shadow-lg aspect-video relative"
        >
          <IIIFPlayer.Viewer />
        </div>

        <div class="bg-white rounded-lg shadow-md p-4 border border-ink-200">
          <IIIFPlayer.Controls>
            <IIIFPlayer.PlayButton />
            <IIIFPlayer.Progress />
            <IIIFPlayer.Skip seconds={-10} />
            <IIIFPlayer.Skip seconds={30} />
            <IIIFPlayer.Speed />
            <IIIFPlayer.Time />
          </IIIFPlayer.Controls>
        </div>
      </IIIFPlayer.Root>
    </div>

    <!-- Right: External Status Dashboard (outside Root subtree) -->
    <div
      class="bg-gray-50 rounded-lg shadow-md border border-ink-200 flex flex-col overflow-clip"
    >
      <div class="px-4 py-3 border-b border-ink-200 bg-white">
        <h3
          class="text-sm font-semibold text-ink-700 uppercase tracking-wider"
        >
          External Dashboard
        </h3>
        <p class="text-xs text-ink-400 mt-0.5">
          Reading PlayerRef outside Root
        </p>
      </div>

      {#if player?.state.error}
        <div class="p-4">
          <div class="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            <strong>Error:</strong> {player.state.error.message}
          </div>
        </div>
      {:else if player}
        <div class="p-4 space-y-4">
          <!-- Playback status -->
          <div class="flex items-center gap-3">
            <div
              class="w-3 h-3 rounded-full {player.state.isPlaying
                ? 'bg-green-500 animate-pulse'
                : 'bg-ink-300'}"
            ></div>
            <span class="text-sm font-medium text-ink-700">
              {player.state.isPlaying ? "Playing" : "Paused"}
            </span>
          </div>

          <!-- Progress bar -->
          <div>
            <div class="flex justify-between text-xs text-ink-500 mb-1">
              <span class="font-mono">{formattedTime}</span>
              <span class="font-mono">{formattedDuration}</span>
            </div>
            <div class="w-full bg-ink-200 rounded-full h-2">
              <div
                class="bg-terracotta-500 h-2 rounded-full transition-all duration-300"
                style="width: {progressPercent}%"
              ></div>
            </div>
          </div>

          <!-- Media info -->
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-ink-500">Media type</span>
              <span class="font-medium text-ink-700">{player.mediaType}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">Speed</span>
              <span class="font-medium text-ink-700"
                >{player.state.playbackRate}x</span
              >
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">Ready</span>
              <span class="font-medium text-ink-700"
                >{player.state.isReady ? "Yes" : "No"}</span
              >
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">Canvases</span>
              <span class="font-medium text-ink-700">{player.canvasCount}</span>
            </div>
          </div>

          <!-- External controls (using actions from PlayerRef) -->
          <div class="pt-3 border-t border-ink-200">
            <p class="text-xs text-ink-400 mb-2 uppercase tracking-wider font-semibold">
              External Controls
            </p>
            <div class="flex gap-2">
              <button
                class="px-3 py-1.5 text-sm bg-terracotta-500 hover:bg-terracotta-600 text-white rounded transition-colors"
                onclick={() => {
                  if (player?.state.isPlaying) {
                    player.actions.pause();
                  } else {
                    player?.actions.play();
                  }
                }}
              >
                {player.state.isPlaying ? "Pause" : "Play"}
              </button>
              <button
                class="px-3 py-1.5 text-sm bg-ink-100 hover:bg-ink-200 text-ink-700 rounded transition-colors"
                onclick={() => player?.actions.seekTo(0)}
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="p-6 text-center text-ink-400">
          <div
            class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-terracotta-500 mb-2"
          ></div>
          <p class="text-sm">Waiting for player...</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.player-init-demo [data-audio-controls]) {
    @apply flex items-center justify-center gap-2 flex-wrap;
  }

  :global(.player-init-demo button[data-audio-button="play-pause"]) {
    @apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full transition-colors;
  }

  :global(.player-init-demo input[type="range"][data-audio-progress]) {
    @apply w-full mb-3 h-2 cursor-pointer accent-terracotta-500;
  }

  :global(.player-init-demo button[data-audio-button="skip"]) {
    @apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors text-sm;
  }

  :global(.player-init-demo select[data-audio-control="speed"]) {
    @apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded transition-colors text-sm;
  }

  :global(.player-init-demo [data-audio-control="time"]) {
    @apply text-sm text-gray-600 font-medium;
  }

  /* Video element sizing */
  :global(.player-init-demo video) {
    @apply w-full h-full object-contain;
  }
</style>
