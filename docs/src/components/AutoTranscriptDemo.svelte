<script lang="ts">
  /**
   * Demo: annotations="auto"
   *
   * Root builds the transcript from the manifest itself — no VTT parsing in
   * the host. The status strip above the transcript reads `transcriptStatus`
   * and the resolved annotation count from Root's children snippet.
   */
  import { IIIFPlayer } from "@umd-mith/iiif-timed-transcript";

  let { manifestUrl }: { manifestUrl: string } = $props();

  let lastError = $state<string | null>(null);

  function handleError(error: Error, info: { fatal: boolean; source: string }) {
    // Non-fatal errors (a VTT that 404s, say) leave the player usable and the
    // transcript panel empty; this demo just surfaces them.
    lastError = `${info.source}${info.fatal ? " (fatal)" : ""}: ${error.message}`;
  }
</script>

<div class="w-full auto-transcript-demo">
  <IIIFPlayer.Root {manifestUrl} annotations="auto" onError={handleError}>
    {#snippet children({ player })}
      <div class="grid md:grid-cols-2 gap-6 items-start">
        <!-- Left: Media + Controls -->
        <div class="flex flex-col gap-4">
          <div class="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
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
        </div>

        <!-- Right: Transcript Panel -->
        <div class="flex flex-col gap-3">
          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-ink-500 px-1"
            data-transcript-status={player.transcriptStatus}
          >
            <span>
              transcriptStatus:
              <strong class="text-ink-700">{player.transcriptStatus}</strong>
            </span>
            <span>
              annotations:
              <strong class="text-ink-700">{player.annotations.length}</strong>
            </span>
            {#if lastError}
              <span class="text-red-700">onError: {lastError}</span>
            {/if}
          </div>

          <div
            class="bg-gray-50 rounded-lg shadow-md border border-ink-200 max-h-[600px] flex flex-col overflow-clip"
          >
            <IIIFPlayer.Transcript
              searchSeekBehavior="activate"
              scrollToSeek={false}
            >
              <IIIFPlayer.TranscriptSearch />
              <IIIFPlayer.TranscriptSegments />
            </IIIFPlayer.Transcript>
          </div>
        </div>
      </div>
    {/snippet}
  </IIIFPlayer.Root>
</div>

<style>
  :global(.auto-transcript-demo [data-annotation-id]) {
    @apply p-3 mb-2 rounded transition-colors text-left;
  }

  :global(.auto-transcript-demo [data-annotation-id]:hover) {
    @apply bg-gray-100;
  }

  :global(.auto-transcript-demo [data-annotation-id][data-state="active"]) {
    @apply bg-blue-100 border-l-4 border-terracotta-500;
  }

  :global(.auto-transcript-demo [data-annotation-id][data-highlighted="true"]) {
    @apply bg-yellow-100;
  }

  :global(
    .auto-transcript-demo [data-annotation-id][data-current-match="true"]
  ) {
    @apply bg-yellow-200 border-l-4 border-yellow-500;
  }

  :global(.auto-transcript-demo [data-annotation-id] .timestamp) {
    @apply text-xs text-gray-600 font-semibold block mb-1;
  }

  :global(.auto-transcript-demo [data-annotation-id] .text) {
    @apply text-gray-800 leading-relaxed;
  }

  /* transcript-panel must be the scroll container for SyncController */
  :global(.auto-transcript-demo .transcript-panel) {
    @apply flex-1 flex flex-col overflow-y-auto;
  }

  :global(.auto-transcript-demo .segments-container) {
    @apply p-4;
  }

  :global(.auto-transcript-demo .loading-message) {
    @apply p-4 text-sm text-gray-600;
  }

  :global(.auto-transcript-demo input[type="search"]) {
    @apply w-full px-4 py-3 border-2 border-ink-300 rounded-lg;
    @apply focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500;
    @apply text-base placeholder-ink-400;
    @apply transition-all duration-200;
  }

  :global(.auto-transcript-demo input[type="search"]:hover) {
    @apply border-terracotta-400;
  }

  :global(.auto-transcript-demo [data-audio-controls]) {
    @apply flex items-center justify-center gap-2 flex-wrap;
  }

  :global(.auto-transcript-demo button[data-audio-button="play-pause"]) {
    @apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full transition-colors;
  }

  :global(.auto-transcript-demo input[type="range"][data-audio-progress]) {
    @apply w-full mb-3 h-2 cursor-pointer accent-terracotta-500;
  }

  :global(.auto-transcript-demo button[data-audio-button="skip"]) {
    @apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors text-sm;
  }

  :global(.auto-transcript-demo select[data-audio-control="speed"]) {
    @apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded transition-colors text-sm;
  }

  :global(.auto-transcript-demo [data-audio-control="time"]) {
    @apply text-sm text-gray-600 font-medium;
  }

  :global(.auto-transcript-demo .follow-along-switch) {
    @apply self-start inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full border border-ink-300 bg-white text-sm text-gray-700 transition-colors;
  }

  :global(.auto-transcript-demo .follow-along-switch[aria-checked="true"]) {
    @apply bg-terracotta-500 border-terracotta-500 text-white;
  }

  :global(.auto-transcript-demo .jump-to-current) {
    @apply self-start px-3 py-1 mb-2 rounded-full bg-terracotta-500 text-white text-sm transition-colors hover:bg-terracotta-600;
  }
</style>
