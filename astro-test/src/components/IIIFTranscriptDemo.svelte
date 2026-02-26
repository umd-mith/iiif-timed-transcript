<script lang="ts">
	/**
	 * Integration demo for Astro using the new IIIFPlayer compound components (LDA-1984).
	 * Demonstrates: IIIFPlayer.Root + child components in Astro islands.
	 */
	import { onMount } from 'svelte';
	import { IIIFPlayer, type Annotation } from '@umd-mith/svelte-iiif-transcript-player';

	// Props
	let {
		manifestUrl,
		vttUrl
	}: {
		manifestUrl: string;
		vttUrl: string;
	} = $props();

	// State
	let annotations = $state<Annotation[]>([]);
	let isLoadingVTT = $state(true);
	let vttError = $state<string | null>(null);

	/**
	 * Simple VTT parser for the demo.
	 * Converts WebVTT format to Annotation[] structure.
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

			// VTT timing line format: "00:00:00.000 --> 00:00:05.000"
			if (line.includes('-->')) {
				const [startStr, endStr] = line.split('-->').map((s) => s.trim());

				// Parse timestamp (HH:MM:SS.mmm or MM:SS.mmm)
				const parseTimestamp = (ts: string): number => {
					const parts = ts.split(':');
					let hours = 0,
						minutes = 0,
						seconds = 0;

					if (parts.length === 3) {
						// HH:MM:SS.mmm
						hours = parseInt(parts[0], 10);
						minutes = parseInt(parts[1], 10);
						seconds = parseFloat(parts[2]);
					} else if (parts.length === 2) {
						// MM:SS.mmm
						minutes = parseInt(parts[0], 10);
						seconds = parseFloat(parts[1]);
					} else {
						// SS.mmm
						seconds = parseFloat(parts[0]);
					}

					return hours * 3600 + minutes * 60 + seconds;
				};

				const startTime = parseTimestamp(startStr);
				const endTime = parseTimestamp(endStr);

				// Next line(s) contain the text (until empty line or next timing)
				const textLines: string[] = [];
				i++; // Move to text line
				while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
					textLines.push(lines[i].trim());
					i++;
				}
				i--; // Back up one since loop will increment

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

	// Load VTT on mount
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

<div class="iiif-transcript-demo">
	<div class="demo-header">
		<h2>IIIF Player Compound Components Demo</h2>
		<p class="demo-subtitle">
			Testing: IIIFPlayer namespace API in Astro (LDA-1984)
		</p>
	</div>

	{#if isLoadingVTT}
		<p>Loading transcript...</p>
	{:else if vttError}
		<p class="error">VTT Error: {vttError}</p>
	{:else}
		<div class="demo-layout">
			<!-- Single IIIFPlayer.Root wraps all compound components -->
			<IIIFPlayer.Root manifestUrl={manifestUrl} canvasIndex={0}>
				<!-- Left: Media + Controls -->
				<div class="demo-media">
					<IIIFPlayer.Viewer />

					<IIIFPlayer.Controls class="player-controls">
						<IIIFPlayer.PlayButton />
						<IIIFPlayer.Progress />
						<IIIFPlayer.Skip seconds={-10} />
						<IIIFPlayer.Skip seconds={30} />
						<IIIFPlayer.Speed />
						<IIIFPlayer.Time />
					</IIIFPlayer.Controls>
				</div>

				<!-- Right: Transcript Panel -->
				<div class="demo-transcript">
					<IIIFPlayer.Transcript {annotations} enableSearch>
						<IIIFPlayer.TranscriptSearch />
						<IIIFPlayer.TranscriptSegments />
					</IIIFPlayer.Transcript>
				</div>
			</IIIFPlayer.Root>
		</div>
	{/if}
</div>

<style>
	.iiif-transcript-demo {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	/* Style transcript segments (library provides unstyled buttons) */
	.iiif-transcript-demo :global(button[data-annotation-id]) {
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		border-radius: 4px;
		transition: background-color 0.2s ease;
		text-align: left;
		width: 100%;
		border: 1px solid #e2e8f0;
		background: white;
	}

	.iiif-transcript-demo :global(button[data-annotation-id]:hover) {
		background-color: #edf2f7;
	}

	/* Active segment highlighting */
	.iiif-transcript-demo :global(button[data-annotation-id][data-state='active']) {
		background-color: #bee3f8;
		border-left: 4px solid #3182ce;
	}

	.iiif-transcript-demo :global(button[data-annotation-id] .timestamp) {
		font-size: 0.75rem;
		color: #718096;
		font-weight: 600;
		display: block;
		margin-bottom: 0.25rem;
	}

	.iiif-transcript-demo :global(button[data-annotation-id] .text) {
		margin: 0;
		color: #2d3748;
		line-height: 1.5;
	}

	.demo-header {
		margin-bottom: 2rem;
		text-align: center;
	}

	.demo-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		color: #1a202c;
	}

	.demo-subtitle {
		margin: 0;
		color: #718096;
		font-size: 0.875rem;
	}

	.demo-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		align-items: start;
	}

	.demo-media {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Player controls styling */
	.iiif-transcript-demo :global(.player-controls) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: #f7fafc;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
	}

	.iiif-transcript-demo :global(.player-controls button) {
		padding: 0.5rem 1rem;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}

	.iiif-transcript-demo :global(.player-controls button:hover) {
		background: #edf2f7;
		border-color: #a0aec0;
	}

	.iiif-transcript-demo :global(.player-controls select) {
		padding: 0.5rem;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.iiif-transcript-demo :global(.player-controls input[type='range']) {
		flex: 1;
		min-width: 200px;
	}

	.demo-transcript {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0;
		background: #f7fafc;
		max-height: 600px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Allow TranscriptPanel's internal scroll container to work */
	.demo-transcript :global(.transcript-panel) {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Add padding to segments, not the wrapper */
	.demo-transcript :global(.segments-container) {
		padding: 1rem;
	}

	.error {
		color: #e53e3e;
		padding: 1rem;
		background: #fff5f5;
		border: 1px solid #feb2b2;
		border-radius: 4px;
	}

	@media (max-width: 768px) {
		.demo-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
