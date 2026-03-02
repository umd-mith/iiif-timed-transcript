<script lang="ts">
  /**
   * Integration demo for docs site:
   * IIIFPlayer compound components with Tailwind styling
   */
  import { onMount } from "svelte";
  import { parseResponse } from "media-captions";
  import {
    IIIFPlayer,
    type Annotation,
  } from "@umd-mith/svelte-iiif-transcript-player";

  // Props
  let {
    manifestUrl,
    vttUrl,
  }: {
    manifestUrl: string;
    vttUrl: string;
  } = $props();

  // State
  let annotations = $state<Annotation[]>([]);
  let isLoadingVTT = $state(true);
  let vttError = $state<string | null>(null);

  async function parseVTT(url: string): Promise<Annotation[]> {
    const { cues } = await parseResponse(fetch(url), { type: "vtt" });
    return cues.map((cue) => ({
      id: cue.id || `cue-${cue.startTime}`,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text,
    }));
  }

  onMount(async () => {
    try {
      isLoadingVTT = true;
      vttError = null;
      annotations = await parseVTT(vttUrl);
      isLoadingVTT = false;
    } catch (error) {
      console.error("Failed to load VTT:", error);
      vttError =
        error instanceof Error ? error.message : "Unknown VTT parsing error";
      isLoadingVTT = false;
    }
  });
</script>

<div class="w-full iiif-transcript-demo">
  {#if isLoadingVTT}
    <div class="p-6 text-center text-gray-600">
      <div
        class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta-600 mb-3"
      ></div>
      <p>Loading transcript...</p>
    </div>
  {:else if vttError}
    <div
      class="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
    >
      <strong>Error:</strong>
      {vttError}
    </div>
  {:else}
    <IIIFPlayer.Root {manifestUrl} canvasIndex={0}>
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
        <div
          class="bg-gray-50 rounded-lg shadow-md border border-ink-200 max-h-[600px] flex flex-col overflow-clip"
        >
          <IIIFPlayer.Transcript {annotations}>
            <IIIFPlayer.TranscriptSearch />
            <IIIFPlayer.TranscriptSegments />
          </IIIFPlayer.Transcript>
        </div>
      </div>
    </IIIFPlayer.Root>
  {/if}
</div>

<style>
  /* Tailwind-based styling for transcript segments */
  :global(.iiif-transcript-demo button[data-annotation-id]) {
    @apply p-3 mb-2 rounded transition-colors text-left;
  }

  :global(.iiif-transcript-demo button[data-annotation-id]:hover) {
    @apply bg-gray-100;
  }

  /* Active segment (playing) - brand color */
  :global(
    .iiif-transcript-demo button[data-annotation-id][data-state="active"]
  ) {
    @apply bg-blue-100 border-l-4 border-terracotta-500;
  }

  /* Search match - yellow highlight */
  :global(
    .iiif-transcript-demo button[data-annotation-id][data-highlighted="true"]
  ) {
    @apply bg-yellow-100;
  }

  /* Current search match - stronger yellow */
  :global(
    .iiif-transcript-demo button[data-annotation-id][data-current-match="true"]
  ) {
    @apply bg-yellow-200 border-l-4 border-yellow-500;
  }

  :global(.iiif-transcript-demo button[data-annotation-id] .timestamp) {
    @apply text-xs text-gray-600 font-semibold block mb-1;
  }

  :global(.iiif-transcript-demo button[data-annotation-id] .text) {
    @apply text-gray-800 leading-relaxed;
  }

  /* transcript-panel must be the scroll container for SyncController */
  :global(.iiif-transcript-demo .transcript-panel) {
    @apply flex-1 flex flex-col overflow-y-auto;
  }

  :global(.iiif-transcript-demo .segments-container) {
    @apply p-4;
  }

  /* Prominent search bar styling */
  :global(.iiif-transcript-demo input[type="search"]) {
    @apply w-full px-4 py-3 border-2 border-ink-300 rounded-lg;
    @apply focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500;
    @apply text-base placeholder-ink-400;
    @apply transition-all duration-200;
  }

  :global(.iiif-transcript-demo input[type="search"]:hover) {
    @apply border-terracotta-400;
  }

  /* Player controls styling - compound components */
  :global(.iiif-transcript-demo [data-audio-controls]) {
    @apply flex items-center justify-center gap-2 flex-wrap;
  }

  :global(.iiif-transcript-demo button[data-audio-button="play-pause"]) {
    @apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full transition-colors;
  }

  :global(.iiif-transcript-demo input[type="range"][data-audio-progress]) {
    @apply w-full mb-3 h-2 cursor-pointer accent-terracotta-500;
  }

  :global(.iiif-transcript-demo button[data-audio-button="skip"]) {
    @apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors text-sm;
  }

  :global(.iiif-transcript-demo select[data-audio-control="speed"]) {
    @apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded transition-colors text-sm;
  }

  :global(.iiif-transcript-demo [data-audio-control="time"]) {
    @apply text-sm text-gray-600 font-medium;
  }
</style>
