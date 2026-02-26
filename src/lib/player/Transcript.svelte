<!-- src/lib/player/Transcript.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { getPlayerContext } from './context';
	import type { Annotation, IIIFMediaViewerRef } from '../sync/types';
	import type { Snippet } from 'svelte';
	import { SyncController } from '../sync/SyncController.svelte';
	import Segment from '../transcript/Segment.svelte';
	import Search from '../transcript/Search.svelte';

	interface Props {
		// Required
		/** Array of transcript annotations with timing and text */
		annotations?: Annotation[];

		// Sync configuration
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

		// Callbacks
		onActiveAnnotationChange?: (annotation: Annotation | null) => void;
		onSegmentClick?: (annotation: Annotation, event: { preventDefault: () => void }) => void;

		// Snippets
		segment?: Snippet<[{ annotation: Annotation; isActive: boolean; onClick: () => void }]>;
		toolbar?: Snippet;
		empty?: Snippet;

		class?: string;
		children?: any;
	}

	let {
		annotations = [],
		syncDebounceMs = 150,
		syncSettleMs = 100,
		syncPriorityLockDuration = 1000,
		enableSearch = false,
		enableFullscreen = false,
		searchDebounceMs = 150,
		searchPlaceholder = 'Search transcript...',
		ariaLabel = 'Media transcript',
		announceActiveSegment = true,
		onActiveAnnotationChange,
		onSegmentClick,
		segment,
		toolbar,
		empty,
		class: className = '',
		children
	}: Props = $props();

	// Get player context
	const playerContext = getPlayerContext();
	const { actions } = playerContext;

	// Create viewer adapter for SyncController
	// This adapts the player context to the IIIFMediaViewerRef interface
	const viewerAdapter: IIIFMediaViewerRef = {
		seekTo: (time: number) => actions.seekTo(time),
		getMediaElement: () => playerContext.mediaElement
	};

	// Refs
	let scrollContainer: HTMLElement | null = $state(null);

	// SyncController instance
	let syncController: SyncController | null = $state(null);

	// Derived active annotation ID from SyncController
	let activeAnnotationId = $derived.by(() => {
		if (!syncController || syncController.activeAnnotations.length === 0) {
			return null;
		}
		return syncController.activeAnnotations[0].id;
	});

	// Search state
	let searchMatches = $state<Annotation[]>([]);
	let currentMatchIndex = $state(-1);

	// Derive set of highlighted IDs (all search matches)
	const highlightedIds = $derived(new Set(searchMatches.map((m) => m.id)));

	// Derive current match ID for stronger highlighting
	const currentMatchId = $derived.by(() => {
		if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) {
			return null;
		}
		return searchMatches[currentMatchIndex]?.id ?? null;
	});

	// Search handler - unified callback from Search component
	function handleMatchChange(matches: Annotation[], index: number) {
		searchMatches = matches;
		currentMatchIndex = index;

		// Scroll to and seek to current match
		if (index >= 0 && matches[index]) {
			const match = matches[index];
			// Seek media to match start time
			actions.seekTo(match.startTime);
		}
	}

	// Initialize and reinitialize SyncController when dependencies change
	$effect(() => {
		// Capture reactive dependencies
		const container = scrollContainer;
		const anns = annotations;
		const mediaEl = playerContext.mediaElement;

		// Early return if requirements not met
		if (!mediaEl || !container || anns.length === 0) {
			return;
		}

		// Create new controller with current annotations
		const ctrl = new SyncController({
			debounceMs: syncDebounceMs,
			settleMs: syncSettleMs,
			priorityLockDuration: syncPriorityLockDuration
		});

		try {
			ctrl.initialize(viewerAdapter, container, anns);
		} catch (error) {
			console.error('[Transcript] SyncController initialization failed:', error);
		}

		// Update the component-level reference (untrack to avoid infinite loop)
		untrack(() => {
			syncController = ctrl;
		});

		// Cleanup: destroy controller when dependencies change or component unmounts
		return () => {
			ctrl.destroy();
		};
	});

	// Fire onActiveAnnotationChange when active annotation changes
	$effect(() => {
		const id = activeAnnotationId;
		untrack(() => {
			if (onActiveAnnotationChange) {
				const active = id ? annotations.find((a) => a.id === id) ?? null : null;
				onActiveAnnotationChange(active);
			}
		});
	});

	// Click handler for annotations
	function handleAnnotationClick(annotation: Annotation) {
		if (onSegmentClick) {
			let prevented = false;
			onSegmentClick(annotation, {
				preventDefault: () => {
					prevented = true;
				}
			});
			if (prevented) return;
		}
		actions.seekTo(annotation.startTime);
	}
</script>

<div class="transcript-panel {className}" role="region" aria-label={ariaLabel}>
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
						<Search
							{annotations}
							placeholder={searchPlaceholder}
							debounceMs={searchDebounceMs}
							onmatchchange={handleMatchChange}
						/>
					{/if}
					{#if enableFullscreen}
						<!-- Fullscreen will be integrated in Part 4 -->
						<div class="fullscreen-placeholder">Fullscreen (coming in Part 4)</div>
					{/if}
				</div>
			{/if}
		{/if}

		<!-- Transcript segments -->
		<div class="segments-container" bind:this={scrollContainer}>
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
						isHighlighted={highlightedIds.has(annotation.id) && currentMatchId !== annotation.id}
						isCurrentMatch={currentMatchId === annotation.id}
						onclick={() => handleAnnotationClick(annotation)}
					/>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Children (for composing with child components) -->
	{#if children}
		{@render children()}
	{/if}

	<!-- Screen reader announcements for active segment -->
	{#if announceActiveSegment && activeAnnotationId}
		{@const activeAnnotation = annotations.find((a) => a.id === activeAnnotationId)}
		{#if activeAnnotation}
			<div aria-live="polite" aria-atomic="true" class="sr-only">
				{activeAnnotation.text}
			</div>
		{/if}
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

	/* Placeholder for fullscreen (Part 4) */
	.fullscreen-placeholder {
		padding: 0.25rem 0.5rem;
		background: #f0f0f0;
		border-radius: 4px;
		font-size: 0.875rem;
		color: #666;
	}

	/* Screen reader only content */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
