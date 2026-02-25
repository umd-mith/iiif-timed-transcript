<!-- src/lib/transcript/Panel.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
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
		segment,
		toolbar,
		empty
	}: Props = $props();

	// Refs
	let scrollContainer: HTMLElement | null = $state(null);

	// SyncController instance
	let syncController: SyncController | null = null;

	// Derived active annotation ID from SyncController
	let activeAnnotationId = $derived(
		syncController && syncController.activeAnnotations.length > 0
			? syncController.activeAnnotations[0].id
			: null
	);

	// Search state
	let searchMatches = $state<Annotation[]>([]);
	let currentMatchIndex = $state(-1);

	// Search handlers
	function handleMatchChange(matches: Annotation[]) {
		searchMatches = matches;
		currentMatchIndex = matches.length > 0 ? 0 : -1;
	}

	function handleNavigateMatch(index: number) {
		currentMatchIndex = index;
		// Scroll to the matched annotation
		if (searchMatches[index]) {
			const matchedAnnotation = searchMatches[index];
			if (viewer) {
				viewer.seekTo(matchedAnnotation.startTime);
			}
		}
	}

	// Initialize SyncController when viewer and scrollContainer are available
	$effect(() => {
		// Cleanup existing controller if reinitializing
		if (syncController) {
			syncController.destroy();
			syncController = null;
		}

		// Only initialize if we have viewer and scrollContainer
		if (viewer && scrollContainer && annotations.length > 0) {
			syncController = new SyncController({
				debounceMs: syncDebounceMs,
				settleMs: syncSettleMs,
				priorityLockDuration: syncPriorityLockDuration
			});

			syncController.initialize(viewer, scrollContainer, annotations);
		}

		// Cleanup on unmount or when dependencies change
		return () => {
			if (syncController) {
				syncController.destroy();
				syncController = null;
			}
		};
	});

	// Click handler for annotations
	function handleAnnotationClick(annotation: Annotation) {
		if (viewer) {
			viewer.seekTo(annotation.startTime);
		}
	}

	// Cleanup on component destroy
	onDestroy(() => {
		if (syncController) {
			syncController.destroy();
		}
	});
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
							onnavigatematch={handleNavigateMatch}
							{currentMatchIndex}
							totalMatches={searchMatches.length}
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
