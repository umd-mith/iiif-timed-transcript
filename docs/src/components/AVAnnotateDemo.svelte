<script lang="ts">
	/**
	 * Demo: AVAnnotate supplementary annotations
	 *
	 * Unlike the VTT demo, this uses buildTranscriptAnnotations() to extract
	 * transcript data directly from the IIIF manifest's canvas.annotations —
	 * the feature added for GitHub issue #2.
	 */
	import { onMount } from 'svelte';
	import {
		IIIFPlayer,
		ManifestSchema,
		getFirstCanvas,
		buildTranscriptAnnotations,
		type Annotation
	} from '@umd-mith/svelte-iiif-transcript-player';

	// Props
	let {
		manifestUrl
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

			// Fetch and validate the manifest
			const response = await fetch(manifestUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch manifest: ${response.status}`);
			}
			const manifest = await response.json();
			const result = ManifestSchema.safeParse(manifest);
			if (!result.success) {
				throw new Error(`Invalid manifest: ${result.error.issues.map((e) => e.message).join(', ')}`);
			}

			// Get the first canvas and build transcript annotations
			// from canvas.annotations (supplementary annotation pages)
			const canvas = getFirstCanvas(result.data);
			if (!canvas) {
				throw new Error('No canvas found in manifest');
			}

			annotations = buildTranscriptAnnotations(canvas);
			annotationCount = annotations.length;
			isLoading = false;
		} catch (error) {
			console.error('Failed to load AVAnnotate manifest:', error);
			loadError = error instanceof Error ? error.message : 'Unknown error';
			isLoading = false;
		}
	});
</script>

<div class="w-full avannotate-demo">
	{#if isLoading}
		<div class="p-6 text-center text-gray-600">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta-600 mb-3"></div>
			<p>Loading manifest and annotations...</p>
		</div>
	{:else if loadError}
		<div class="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
			<strong>Error:</strong> {loadError}
		</div>
	{:else}
		<div class="mb-4 px-1 text-sm text-ink-500 font-mono">
			{annotationCount} annotations extracted from canvas.annotations
		</div>

		<IIIFPlayer.Root {manifestUrl} canvasIndex={0}>
			<div class="grid md:grid-cols-2 gap-6 items-start">
				<!-- Left: Media + Controls -->
				<div class="flex flex-col gap-4">
					<div class="bg-gray-900 rounded-lg overflow-hidden shadow-lg p-6 flex items-center justify-center min-h-[120px]">
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

					<!-- Speaker/tag legend -->
					<div class="bg-white rounded-lg shadow-md p-4 border border-ink-200">
						<h4 class="text-sm font-semibold text-ink-700 mb-2">Tags from annotations</h4>
						<div class="flex flex-wrap gap-2">
							{#each [...new Set(annotations.flatMap((a) => (a.metadata?.tags as string[]) ?? []))] as tag}
								<span class="inline-block px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-200">
									{tag}
								</span>
							{/each}
						</div>
					</div>
				</div>

				<!-- Right: Transcript Panel -->
				<div class="bg-gray-50 rounded-lg shadow-md border border-ink-200 max-h-[600px] flex flex-col overflow-clip">
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
	/* Reuse same Tailwind styling as the main demo */
	:global(.avannotate-demo button[data-annotation-id]) {
		@apply p-3 mb-2 rounded transition-colors text-left;
	}

	:global(.avannotate-demo button[data-annotation-id]:hover) {
		@apply bg-gray-100;
	}

	:global(.avannotate-demo button[data-annotation-id][data-state='active']) {
		@apply bg-blue-100 border-l-4 border-terracotta-500;
	}

	:global(.avannotate-demo button[data-annotation-id][data-highlighted='true']) {
		@apply bg-yellow-100;
	}

	:global(.avannotate-demo button[data-annotation-id][data-current-match='true']) {
		@apply bg-yellow-200 border-l-4 border-yellow-500;
	}

	:global(.avannotate-demo button[data-annotation-id] .timestamp) {
		@apply text-xs text-gray-600 font-semibold block mb-1;
	}

	:global(.avannotate-demo button[data-annotation-id] .text) {
		@apply text-gray-800 leading-relaxed;
	}

	:global(.avannotate-demo .transcript-panel) {
		@apply flex-1 flex flex-col overflow-y-auto;
	}

	:global(.avannotate-demo .segments-container) {
		@apply p-4;
	}

	:global(.avannotate-demo input[type="search"]) {
		@apply w-full px-4 py-3 border-2 border-ink-300 rounded-lg;
		@apply focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-terracotta-500;
		@apply text-base placeholder-ink-400;
		@apply transition-all duration-200;
	}

	:global(.avannotate-demo input[type="search"]:hover) {
		@apply border-terracotta-400;
	}

	:global(.avannotate-demo [data-audio-controls]) {
		@apply flex items-center justify-center gap-2 flex-wrap;
	}

	:global(.avannotate-demo button[data-audio-button="play-pause"]) {
		@apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full transition-colors;
	}

	:global(.avannotate-demo input[type="range"][data-audio-progress]) {
		@apply w-full mb-3 h-2 cursor-pointer accent-terracotta-500;
	}

	:global(.avannotate-demo button[data-audio-button="skip"]) {
		@apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors text-sm;
	}

	:global(.avannotate-demo select[data-audio-control="speed"]) {
		@apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded transition-colors text-sm;
	}

	:global(.avannotate-demo [data-audio-control="time"]) {
		@apply text-sm text-gray-600 font-medium;
	}
</style>
