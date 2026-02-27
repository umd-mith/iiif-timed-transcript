<script lang="ts">
	/**
	 * Demo: IIIF Range/Chapter navigation
	 *
	 * Uses the IIIFPlayer.Chapters compound component to render navigable
	 * chapter lists from IIIF manifest Range structures. Chapters are
	 * auto-parsed by Root from manifest.structures — no manual extraction
	 * needed.
	 *
	 * Manifest: IIIF Cookbook recipe 0026 — Lully's Armide opera (video).
	 */
	import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

	// Props
	let {
		manifestUrl
	}: {
		manifestUrl: string;
	} = $props();
</script>

<div class="w-full chapters-demo">
	<IIIFPlayer.Root {manifestUrl} canvasIndex={0}>
		<div class="grid md:grid-cols-[1fr,380px] gap-6 items-start">
			<!-- Left: Video + Controls -->
			<div class="flex flex-col gap-4">
				<div class="bg-gray-900 rounded-lg overflow-hidden shadow-lg aspect-video relative">
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

			<!-- Right: Chapters Panel -->
			<div class="bg-gray-50 rounded-lg shadow-md border border-ink-200 max-h-[600px] flex flex-col overflow-clip">
				<div class="px-4 py-3 border-b border-ink-200 bg-white">
					<h3 class="text-sm font-semibold text-ink-700 uppercase tracking-wider">Chapters</h3>
				</div>
				<div class="flex-1 overflow-y-auto">
					<IIIFPlayer.Chapters />
				</div>
			</div>
		</div>
	</IIIFPlayer.Root>
</div>

<style>
	/* Chapter button styling — table-of-contents feel */
	:global(.chapters-demo button[data-chapter-id]) {
		@apply px-4 py-3 border-b border-ink-100 transition-colors text-left w-full;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	:global(.chapters-demo button[data-chapter-id]:last-child) {
		border-bottom: none;
	}

	:global(.chapters-demo button[data-chapter-id]:hover) {
		@apply bg-parchment-100;
	}

	/* Active chapter — brand accent */
	:global(.chapters-demo button[data-chapter-id][data-state='active']) {
		@apply bg-terracotta-50 border-l-4 border-l-terracotta-500;
	}

	:global(.chapters-demo button[data-chapter-id][data-state='inactive']) {
		@apply border-l-4 border-l-transparent;
	}

	/* Chapter label */
	:global(.chapters-demo button[data-chapter-id] .chapter-label) {
		@apply text-sm font-medium text-ink-800 leading-snug;
	}

	:global(.chapters-demo button[data-chapter-id][data-state='active'] .chapter-label) {
		@apply text-terracotta-700 font-semibold;
	}

	/* Chapter time range */
	:global(.chapters-demo button[data-chapter-id] .chapter-time) {
		@apply text-xs text-ink-400 font-mono;
	}

	:global(.chapters-demo button[data-chapter-id][data-state='active'] .chapter-time) {
		@apply text-terracotta-500;
	}

	/* Empty state */
	:global(.chapters-demo .empty-message) {
		@apply p-6 text-center text-ink-400 text-sm italic;
	}

	/* Player controls styling — compound components */
	:global(.chapters-demo [data-audio-controls]) {
		@apply flex items-center justify-center gap-2 flex-wrap;
	}

	:global(.chapters-demo button[data-audio-button="play-pause"]) {
		@apply px-4 py-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-full transition-colors;
	}

	:global(.chapters-demo input[type="range"][data-audio-progress]) {
		@apply w-full mb-3 h-2 cursor-pointer accent-terracotta-500;
	}

	:global(.chapters-demo button[data-audio-button="skip"]) {
		@apply px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors text-sm;
	}

	:global(.chapters-demo select[data-audio-control="speed"]) {
		@apply px-3 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded transition-colors text-sm;
	}

	:global(.chapters-demo [data-audio-control="time"]) {
		@apply text-sm text-gray-600 font-medium;
	}

	/* Video element sizing */
	:global(.chapters-demo video) {
		@apply w-full h-full object-contain;
	}
</style>
