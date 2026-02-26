<!-- src/lib/transcript/Panel.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import type { Annotation, IIIFMediaViewerRef } from '../sync/types';
	import type { Snippet } from 'svelte';
	import { SyncController } from '../sync/SyncController.svelte';
	import Segment from './Segment.svelte';
	import Search from './Search.svelte';

	interface Props {
		// Required
		/** Array of transcript annotations with timing and text */
		annotations: Annotation[];
		/**
		 * Viewer instance for bidirectional sync.
		 * Pass null for static transcript (no sync).
		 */
		viewer: IIIFMediaViewerRef | null;

		// Sync configuration
		/**
		 * Scroll event throttling in milliseconds.
		 * Higher = less responsive but smoother scrolling.
		 * @default 150
		 */
		syncDebounceMs?: number;
		/**
		 * Wait time after operations before next action (prevents jitter).
		 * @default 100
		 */
		syncSettleMs?: number;
		/**
		 * Duration in ms to lock priority after user interaction (prevents feedback loops).
		 * After clicking segment or scrolling, opposite sync direction is blocked for this duration.
		 * @default 1000
		 */
		syncPriorityLockDuration?: number;

		// Features
		/**
		 * Show search input and match navigation UI.
		 * @default false
		 */
		enableSearch?: boolean;
		/**
		 * Show fullscreen toggle button (coming in Part 4).
		 * @default false
		 */
		enableFullscreen?: boolean;

		// UI configuration
		/**
		 * Search input debounce in milliseconds.
		 * @default 150
		 */
		searchDebounceMs?: number;
		/**
		 * Placeholder text for search input.
		 * @default "Search transcript..."
		 */
		searchPlaceholder?: string;

		// Accessibility
		/**
		 * ARIA label for transcript container region.
		 * @default "Media transcript"
		 */
		ariaLabel?: string;
		/**
		 * Enable screen reader announcements for active segment changes.
		 * @default true
		 */
		announceActiveSegment?: boolean;

		// Callbacks
		/**
		 * Called when the active (currently playing) annotation changes.
		 * Receives the full Annotation object, or null when no annotation is active.
		 */
		onActiveAnnotationChange?: (annotation: Annotation | null) => void;
		/**
		 * Called when a transcript segment is clicked, before the default seek behavior.
		 * Call `event.preventDefault()` synchronously to suppress the default seek.
		 * Async prevention (calling preventDefault inside an await) will not work.
		 */
		onSegmentClick?: (annotation: Annotation, event: { preventDefault: () => void }) => void;

		// Snippets
		/**
		 * Custom segment rendering snippet.
		 * IMPORTANT: Must include data-annotation-id={annotation.id} and onclick={onClick}.
		 */
		segment?: Snippet<
			[{ annotation: Annotation; isActive: boolean; onClick: () => void }]
		>;
		/** Custom toolbar rendering snippet (replaces search UI) */
		toolbar?: Snippet;
		/** Custom empty state rendering snippet */
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
		onActiveAnnotationChange,
		onSegmentClick,
		segment,
		toolbar,
		empty
	}: Props = $props();

	// Refs
	let scrollContainer: HTMLElement | null = $state(null);

	// SyncController instance
	// Must be $state so derived values recompute when controller properties change (lakeland LDA-1572)
	let syncController: SyncController | null = $state(null);

	// Derived active annotation ID from SyncController
	// Use $derived.by() to ensure reactivity when controller changes (from lakeland LDA-1572)
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
			viewer?.seekTo(match.startTime);
			// Scroll to match in transcript (data-annotation-id is set on Segment wrapper)
			// Implementation would need scroll container ref - omitted for now
		}
	}

	// Initialize and reinitialize SyncController when dependencies change (LDA-1572)
	// Uses $effect cleanup pattern to properly destroy old controller before creating new one
	$effect(() => {
		// Capture reactive dependencies
		const vRef = viewer;
		const container = scrollContainer;
		const anns = annotations;

		// Early return if requirements not met
		if (!vRef || !container || anns.length === 0) {
			return;
		}

		// Create new controller with current annotations
		const ctrl = new SyncController({
			debounceMs: syncDebounceMs,
			settleMs: syncSettleMs,
			priorityLockDuration: syncPriorityLockDuration
		});

		try {
			ctrl.initialize(vRef, container, anns);
		} catch (error) {
			console.error('[Panel] SyncController initialization failed:', error);
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
				const active = id
					? annotations.find((a) => a.id === id) ?? null
					: null;
				onActiveAnnotationChange(active);
			}
		});
	});

	// Click handler for annotations
	function handleAnnotationClick(annotation: Annotation) {
		if (onSegmentClick) {
			let prevented = false;
			onSegmentClick(annotation, {
				preventDefault: () => { prevented = true; }
			});
			if (prevented) return;
		}
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
