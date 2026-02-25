<!-- src/lib/transcript/Panel.svelte -->
<script lang="ts">
	import type { Annotation, IIIFMediaViewerRef } from '../sync/types';
	import type { Snippet } from 'svelte';
	import Segment from './Segment.svelte';

	interface Props {
		// Required
		annotations: Annotation[];
		viewer: IIIFMediaViewerRef | null;

		// Sync configuration (will be used in Part 2)
		syncDebounceMs?: number;
		syncSettleMs?: number;
		syncPriorityLockDuration?: number;

		// Features
		enableSearch?: boolean;
		enableFullscreen?: boolean;

		// UI configuration
		searchDebounceMs?: number;
		searchPlaceholder?: string;

		// Accessibility
		ariaLabel?: string;
		announceActiveSegment?: boolean;

		// Snippets
		segment?: Snippet<
			[{ annotation: Annotation; isActive: boolean; onClick: () => void }]
		>;
		toolbar?: Snippet;
		empty?: Snippet;
	}

	let {
		annotations,
		viewer,
		syncDebounceMs = 150,
		syncSettleMs = 100,
		syncPriorityLockDuration = 1000,
		enableSearch = false,
		enableFullscreen = false,
		searchDebounceMs = 150,
		searchPlaceholder = 'Search transcript...',
		ariaLabel = 'Media transcript',
		announceActiveSegment = true,
		segment,
		toolbar,
		empty
	}: Props = $props();

	// State for active annotation (will be connected to SyncController in Part 2)
	let activeAnnotationId = $state<string | null>(null);

	// Click handler for annotations
	function handleAnnotationClick(annotation: Annotation) {
		if (viewer) {
			viewer.seekTo(annotation.startTime);
		}
	}
</script>

<div class="transcript-panel" role="region" aria-label={ariaLabel}>
	{#if annotations.length === 0}
		<!-- Empty state -->
		{#if empty}
			{@render empty()}
		{:else}
			<p class="empty-message">No transcript available.</p>
		{/if}
	{:else}
		<!-- Toolbar (if enabled) -->
		{#if enableSearch || enableFullscreen}
			{#if toolbar}
				{@render toolbar()}
			{:else}
				<div class="toolbar">
					{#if enableSearch}
						<!-- Search will be integrated in Part 3 -->
						<div class="search-placeholder">Search (coming in Part 3)</div>
					{/if}
					{#if enableFullscreen}
						<!-- Fullscreen will be integrated in Part 4 -->
						<div class="fullscreen-placeholder">Fullscreen (coming in Part 4)</div>
					{/if}
				</div>
			{/if}
		{/if}

		<!-- Transcript segments -->
		<div class="segments-container">
			{#each annotations as annotation (annotation.id)}
				{#if segment}
					{@render segment({
						annotation,
						isActive: activeAnnotationId === annotation.id,
						onClick: () => handleAnnotationClick(annotation)
					})}
				{:else}
					<Segment
						{annotation}
						isActive={activeAnnotationId === annotation.id}
						onclick={() => handleAnnotationClick(annotation)}
					/>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.transcript-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.empty-message {
		padding: 1rem;
		text-align: center;
		color: #666;
	}

	.toolbar {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.segments-container {
		overflow-y: auto;
		flex: 1;
	}

	/* Placeholders for upcoming features */
	.search-placeholder,
	.fullscreen-placeholder {
		padding: 0.25rem 0.5rem;
		background: #f0f0f0;
		border-radius: 4px;
		font-size: 0.875rem;
		color: #666;
	}
</style>
