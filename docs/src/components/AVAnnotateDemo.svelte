<script lang="ts">
	/**
	 * Demo: AVAnnotate supplementary annotations
	 *
	 * Unlike the VTT demo, this uses buildTranscriptAnnotations() to extract
	 * transcript data directly from the IIIF manifest's canvas.annotations —
	 * the feature added for GitHub issue #2.
	 *
	 * Uses a custom segment renderer (AVAnnotateSegments) instead of the
	 * built-in TranscriptSegments to display richer metadata: speaker names,
	 * category tags, and interactive tag filtering.
	 */
	import { onMount } from 'svelte';
	import {
		IIIFPlayer,
		ManifestSchema,
		getFirstCanvas,
		buildTranscriptAnnotations,
		type Annotation
	} from '@umd-mith/svelte-iiif-transcript-player';
	import AVAnnotateSegments from './AVAnnotateSegments.svelte';

	// Props
	let {
		manifestUrl
	}: {
		manifestUrl: string;
	} = $props();

	// Known category tags (matching AVAnnotateSegments color map)
	const categoryNames = ['Speaking', 'Reading', 'Transcription', 'Situational', 'Audience', 'Notes', 'Social'];

	// State
	let annotations = $state<Annotation[]>([]);
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let annotationCount = $state(0);
	let activeTags = $state<string[]>([]);

	// Derive unique category tags present in this manifest
	const availableTags = $derived.by(() => {
		const allTags = annotations.flatMap((a) => (a.metadata?.tags as string[]) ?? []);
		const unique = [...new Set(allTags)];
		return unique.filter((t) => categoryNames.includes(t));
	});

	// Derive speaker names (tags that aren't categories)
	const speakers = $derived.by(() => {
		const allTags = annotations.flatMap((a) => (a.metadata?.tags as string[]) ?? []);
		const cats = new Set(categoryNames);
		return [...new Set(allTags.filter((t) => !cats.has(t)))];
	});

	function toggleTag(tag: string) {
		if (activeTags.includes(tag)) {
			activeTags = activeTags.filter((t) => t !== tag);
		} else {
			activeTags = [...activeTags, tag];
		}
	}

	function clearFilters() {
		activeTags = [];
	}

	// Tag color classes (matching AVAnnotateSegments)
	const tagStyles: Record<string, string> = {
		'Speaking': 'bg-blue-50 text-blue-700 border-blue-200',
		'Reading': 'bg-violet-50 text-violet-700 border-violet-200',
		'Transcription': 'bg-emerald-50 text-emerald-700 border-emerald-200',
		'Situational': 'bg-orange-50 text-orange-700 border-orange-200',
		'Audience': 'bg-pink-50 text-pink-700 border-pink-200',
		'Notes': 'bg-gray-100 text-gray-600 border-gray-200',
		'Social': 'bg-amber-50 text-amber-700 border-amber-200',
	};

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
				throw new Error(`Invalid manifest: ${result.error.issues.map((e) => e.message).join(', ')}`);
			}

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
			{annotationCount} annotations from canvas.annotations
			{#if speakers.length > 0}
				&middot; {speakers.join(', ')}
			{/if}
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

					<!-- Interactive tag filter -->
					<div class="bg-white rounded-lg shadow-md p-4 border border-ink-200">
						<div class="flex items-center justify-between mb-2">
							<h4 class="text-sm font-semibold text-ink-700">Filter by category</h4>
							{#if activeTags.length > 0}
								<button
									type="button"
									class="text-xs text-terracotta-500 hover:text-terracotta-600 font-medium"
									onclick={clearFilters}
								>
									Clear filters
								</button>
							{/if}
						</div>
						<div class="flex flex-wrap gap-2">
							{#each availableTags as tag (tag)}
								{@const isActive = activeTags.includes(tag)}
								{@const style = tagStyles[tag] ?? 'bg-gray-100 text-gray-600 border-gray-200'}
								<button
									type="button"
									class="tag-filter-btn border {style}"
									class:active={isActive}
									onclick={() => toggleTag(tag)}
									aria-pressed={isActive}
								>
									{tag}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Right: Transcript Panel with custom segments -->
				<div class="bg-gray-50 rounded-lg shadow-md border border-ink-200 max-h-[600px] flex flex-col overflow-clip">
					<IIIFPlayer.Transcript {annotations}>
						<IIIFPlayer.TranscriptSearch />
						<AVAnnotateSegments {activeTags} />
					</IIIFPlayer.Transcript>
				</div>
			</div>
		</IIIFPlayer.Root>
	{/if}
</div>

<style>
	/* Tag filter buttons */
	.tag-filter-btn {
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 150ms;
		opacity: 0.6;
	}

	.tag-filter-btn:hover {
		opacity: 0.85;
	}

	.tag-filter-btn.active {
		opacity: 1;
		box-shadow: 0 0 0 2px rgba(194, 65, 12, 0.3);
	}

	/* Transcript panel and search styling */
	:global(.avannotate-demo .transcript-panel) {
		@apply flex-1 flex flex-col overflow-y-auto;
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

	/* Audio controls */
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
