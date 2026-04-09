<script lang="ts">
  /**
   * Demo: History UnErased oral history interview
   *
   * Uses buildTranscriptAnnotations() to extract transcript data from
   * embedded IIIF annotations in canvas.annotations — same pattern as
   * AVAnnotate but with simpler single-body "supplementing" annotations.
   *
   * Speaker names are embedded as HTML (<b>Name</b>:) in the text values.
   */
  import { onMount } from "svelte";
  import {
    IIIFPlayer,
    ManifestSchema,
    getFirstCanvas,
    buildTranscriptAnnotations,
    type Annotation,
  } from "@umd-mith/svelte-iiif-transcript-player";
  import BufferingOverlay from "./BufferingOverlay.svelte";

  // Props
  let {
    manifestUrl,
  }: {
    manifestUrl: string;
  } = $props();

  // State
  let annotations = $state<Annotation[]>([]);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let annotationCount = $state(0);

  onMount(async () => {
    try {
      isLoading = true;
      loadError = null;

      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }
      const manifest = await response.json();
      const result = ManifestSchema.safeParse(manifest);
      if (!result.success) {
        throw new Error(
          `Invalid manifest: ${result.error.issues.map((e) => e.message).join(", ")}`,
        );
      }

      const canvas = getFirstCanvas(result.data);
      if (!canvas) {
        throw new Error("No canvas found in manifest");
      }

      const result = buildTranscriptAnnotations(canvas);
      annotations = result.annotations;
      annotationCount = annotations.length;
      isLoading = false;
    } catch (error) {
      console.error("Failed to load History UnErased manifest:", error);
      loadError = error instanceof Error ? error.message : "Unknown error";
      isLoading = false;
    }
  });
</script>

<div class="w-full historyunerased-demo">
  {#if isLoading}
    <div class="p-6 text-center text-gray-600">
      <div
        class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta-600 mb-3"
      ></div>
      <p>Loading manifest and annotations...</p>
    </div>
  {:else if loadError}
    <div
      class="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
    >
      <strong>Error:</strong>
      {loadError}
    </div>
  {:else}
    <div class="mb-4 px-1 text-sm text-ink-500 font-mono">
      {annotationCount} annotations from canvas.annotations
    </div>

    <IIIFPlayer.Root {manifestUrl} canvasIndex={0}>
      <div class="grid md:grid-cols-2 gap-6 items-start">
        <!-- Left: Media + Controls -->
        <div class="flex flex-col gap-4">
          <div
            class="bg-gray-900 rounded-lg overflow-hidden shadow-lg p-6 flex items-center justify-center min-h-[120px] relative"
          >
            <IIIFPlayer.Viewer />
            <BufferingOverlay />
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
  /* Transcript segment styling */
  :global(.historyunerased-demo [data-annotation-id]) {
    @apply p-3 mb-2 rounded transition-colors text-left;
  }

  :global(.historyunerased-demo [data-annotation-id]:hover) {
    @apply bg-gray-100;
  }

  :global(.historyunerased-demo [data-annotation-id][data-state="active"]) {
    @apply bg-blue-100 border-l-4 border-terracotta-500;
  }

  :global(.historyunerased-demo [data-annotation-id][data-highlighted="true"]) {
    @apply bg-yellow-100;
  }

  :global(
    .historyunerased-demo [data-annotation-id][data-current-match="true"]
  ) {
    @apply bg-yellow-200 border-l-4 border-yellow-500;
  }

  :global(.historyunerased-demo [data-annotation-id] .timestamp) {
    @apply text-xs text-gray-600 font-semibold block mb-1;
  }

  :global(.historyunerased-demo [data-annotation-id] .text) {
    @apply text-gray-800 leading-relaxed;
  }

  :global(.historyunerased-demo .transcript-panel) {
    @apply flex-1 flex flex-col overflow-y-auto;
  }

  :global(.historyunerased-demo .segments-container) {
    @apply p-4;
  }

  :global(.historyunerased-demo input[type="search"]) {
    @apply w-full px-4 py-3 border-2 border-ink-300 rounded-lg;
    @apply focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500;
    @apply text-base placeholder-ink-400;
    @apply transition-all duration-200;
  }

  :global(.historyunerased-demo input[type="search"]:hover) {
    @apply border-terracotta-400;
  }

  /* Audio controls */
  :global(.historyunerased-demo [data-audio-controls]) {
    @apply flex items-center justify-center gap-2 flex-wrap;
  }

  :global(.historyunerased-demo button[data-audio-button="play-pause"]) {
    @apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full transition-colors;
  }

  :global(.historyunerased-demo input[type="range"][data-audio-progress]) {
    @apply w-full mb-3 h-2 cursor-pointer accent-terracotta-500;
  }

  :global(.historyunerased-demo button[data-audio-button="skip"]) {
    @apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors text-sm;
  }

  :global(.historyunerased-demo select[data-audio-control="speed"]) {
    @apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded transition-colors text-sm;
  }

  :global(.historyunerased-demo [data-audio-control="time"]) {
    @apply text-sm text-gray-600 font-medium;
  }
</style>
