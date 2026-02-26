<script lang="ts">
	/**
	 * Integration demo for docs site:
	 * IIIFMediaViewer + AudioPlayerControls + TranscriptPanel with Tailwind styling
	 */
	import { onMount } from 'svelte';
	import {
		IIIFMediaViewer,
		AudioPlayerControls,
		TranscriptPanel,
		type Annotation
	} from '@umd-mith/svelte-iiif-transcript-player';
	import {
		Play,
		Pause,
		ArrowCounterClockwise,
		ArrowClockwise,
		CaretDown,
		CaretUp
	} from 'phosphor-svelte';

	// Props
	let {
		manifestUrl,
		vttUrl
	}: {
		manifestUrl: string;
		vttUrl: string;
	} = $props();

	// State
	let viewer: any = $state(null);
	let annotations = $state<Annotation[]>([]);
	let isLoadingVTT = $state(true);
	let vttError = $state<string | null>(null);

	// Player state for AudioPlayerControls reactivity
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let playbackSpeed = $state(1);

	/**
	 * Simple VTT parser for the demo.
	 * Production apps should use media-captions library for robust parsing.
	 */
	async function parseVTT(vttUrl: string): Promise<Annotation[]> {
		const response = await fetch(vttUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch VTT: ${response.status}`);
		}

		const text = await response.text();
		const lines = text.split('\n');
		const annotations: Annotation[] = [];
		let currentId = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			if (line.includes('-->')) {
				const [startStr, endStr] = line.split('-->').map((s) => s.trim());

				const parseTimestamp = (ts: string): number => {
					const parts = ts.split(':');
					let hours = 0,
						minutes = 0,
						seconds = 0;

					if (parts.length === 3) {
						hours = parseInt(parts[0], 10);
						minutes = parseInt(parts[1], 10);
						seconds = parseFloat(parts[2]);
					} else if (parts.length === 2) {
						minutes = parseInt(parts[0], 10);
						seconds = parseFloat(parts[1]);
					} else {
						seconds = parseFloat(parts[0]);
					}

					return hours * 3600 + minutes * 60 + seconds;
				};

				const startTime = parseTimestamp(startStr);
				const endTime = parseTimestamp(endStr);

				const textLines: string[] = [];
				i++;
				while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
					textLines.push(lines[i].trim());
					i++;
				}
				i--;

				const text = textLines.join(' ');

				if (text) {
					annotations.push({
						id: `cue-${currentId++}`,
						startTime,
						endTime,
						text
					});
				}
			}
		}

		return annotations;
	}

	// Handlers for IIIFMediaViewer callbacks
	function handlePlayStateChange(playing: boolean) {
		isPlaying = playing;
	}

	function handleTimeUpdate(time: number) {
		currentTime = time;
	}

	function handleDurationChange(dur: number) {
		duration = dur;
	}

	onMount(async () => {
		try {
			isLoadingVTT = true;
			vttError = null;
			annotations = await parseVTT(vttUrl);
			isLoadingVTT = false;
		} catch (error) {
			console.error('Failed to load VTT:', error);
			vttError = error instanceof Error ? error.message : 'Unknown VTT parsing error';
			isLoadingVTT = false;
		}
	});
</script>

<div class="w-full iiif-transcript-demo">
	<div class="grid md:grid-cols-2 gap-6 items-start">
		<!-- Left: Media + Controls -->
		<div class="flex flex-col gap-4">
			<div class="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
				<IIIFMediaViewer
				bind:this={viewer}
				iiifManifestUrl={manifestUrl}
				controls={false}
				onPlayStateChange={handlePlayStateChange}
				onTimeUpdate={handleTimeUpdate}
				onDurationChange={handleDurationChange}
			/>
			</div>

			{#if viewer}
				<div class="bg-white rounded-lg shadow-md p-4 border border-ink-200">
					<AudioPlayerControls
						playerRef={viewer}
						skipAmounts={[10, 30]}
						enableSpeed={true}
						enableSkip={true}
						{isPlaying}
						{currentTime}
						{duration}
						{playbackSpeed}
					>
						{#snippet playIcon()}
							<Play size={20} weight="bold" />
						{/snippet}
						{#snippet pauseIcon()}
							<Pause size={20} weight="bold" />
						{/snippet}
						{#snippet skipIcon({ seconds })}
							{#if seconds === 10}
								<ArrowCounterClockwise size={16} weight="bold" />
							{:else}
								<ArrowClockwise size={16} weight="bold" />
							{/if}
						{/snippet}
					</AudioPlayerControls>
				</div>
			{/if}
		</div>

		<!-- Right: Transcript Panel -->
		<div class="bg-gray-50 rounded-lg shadow-md border border-ink-200 max-h-[600px] flex flex-col overflow-hidden">
			{#if isLoadingVTT}
				<div class="p-6 text-center text-gray-600">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta-600 mb-3"></div>
					<p>Loading transcript...</p>
				</div>
			{:else if vttError}
				<div class="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
					<strong>Error:</strong> {vttError}
				</div>
			{:else if !viewer}
				<div class="p-6 text-center text-gray-600">
					Waiting for media player to load...
				</div>
			{:else}
				<TranscriptPanel {annotations} {viewer} enableSearch={true} />
			{/if}
		</div>
	</div>
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
	:global(.iiif-transcript-demo button[data-annotation-id][data-state='active']) {
		@apply bg-blue-100 border-l-4 border-terracotta-500;
	}

	/* Search match - yellow highlight */
	:global(.iiif-transcript-demo button[data-annotation-id][data-highlighted='true']) {
		@apply bg-yellow-100;
	}

	/* Current search match - stronger yellow */
	:global(.iiif-transcript-demo button[data-annotation-id][data-current-match='true']) {
		@apply bg-yellow-200 border-l-4 border-yellow-500;
	}

	:global(.iiif-transcript-demo button[data-annotation-id] .timestamp) {
		@apply text-xs text-gray-600 font-semibold block mb-1;
	}

	:global(.iiif-transcript-demo button[data-annotation-id] .text) {
		@apply text-gray-800 leading-relaxed;
	}

	/* Allow TranscriptPanel's internal scroll to work */
	:global(.iiif-transcript-demo .transcript-panel) {
		@apply flex-1 flex flex-col overflow-hidden;
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

	/* Style audio controls - vertical layout with spacing */
	:global(.iiif-transcript-demo [data-audio-controls]) {
		@apply flex flex-col gap-3;
	}

	/* Progress bar container - add margin for visibility */
	:global(.iiif-transcript-demo [data-audio-progress]) {
		@apply mb-3;
	}

	/* Button container - horizontal layout with centered alignment */
	:global(.iiif-transcript-demo [data-audio-buttons]) {
		@apply flex items-center justify-center gap-2 flex-wrap;
	}

	/* General button styling */
	:global(.iiif-transcript-demo [data-audio-button]) {
		@apply px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm font-medium text-gray-700;
	}

	/* Play/Pause button - make it prominent */
	:global(.iiif-transcript-demo [data-audio-button="play-pause"]) {
		@apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full;
	}

	/* Skip buttons - subtle styling */
	:global(.iiif-transcript-demo [data-audio-button="skip"]) {
		@apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600;
	}

	/* Speed button - distinct from others */
	:global(.iiif-transcript-demo [data-audio-button="speed"]) {
		@apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded;
	}

	:global(.iiif-transcript-demo [data-audio-progress-track]) {
		@apply w-full h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer;
	}

	:global(.iiif-transcript-demo [data-audio-progress-fill]) {
		@apply h-full bg-terracotta-500 transition-all;
	}
</style>
