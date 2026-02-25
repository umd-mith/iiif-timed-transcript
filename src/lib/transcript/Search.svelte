<!-- src/lib/transcript/Search.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Annotation } from '../sync/types';

	interface Props {
		annotations: Annotation[];
		placeholder?: string;
		debounceMs?: number;
		onmatchchange?: (matches: Annotation[]) => void;
		onnavigatematch?: (index: number) => void;
		currentMatchIndex?: number;
		totalMatches?: number;
	}

	let {
		annotations,
		placeholder = 'Search transcript...',
		debounceMs = 150,
		onmatchchange,
		onnavigatematch,
		currentMatchIndex = -1,
		totalMatches = 0
	}: Props = $props();

	let query = $state('');
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Search logic
	function performSearch(searchQuery: string) {
		if (!searchQuery.trim()) {
			onmatchchange?.([]);
			return;
		}

		const lowerQuery = searchQuery.toLowerCase();
		const matches = annotations.filter((ann) => ann.text.toLowerCase().includes(lowerQuery));

		onmatchchange?.(matches);
	}

	// Debounced search
	$effect(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);

		debounceTimeout = setTimeout(() => {
			performSearch(query);
		}, debounceMs);

		return () => {
			if (debounceTimeout) clearTimeout(debounceTimeout);
		};
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);
	});

	// Navigation
	function navigatePrevious() {
		if (totalMatches === 0) return;
		const newIndex = currentMatchIndex <= 0 ? totalMatches - 1 : currentMatchIndex - 1;
		onnavigatematch?.(newIndex);
	}

	function navigateNext() {
		if (totalMatches === 0) return;
		const newIndex = currentMatchIndex >= totalMatches - 1 ? 0 : currentMatchIndex + 1;
		onnavigatematch?.(newIndex);
	}
</script>

<div class="search-container" role="search">
	<input type="search" bind:value={query} {placeholder} aria-label="Search transcript" />

	{#if totalMatches > 0}
		<div class="match-counter">
			{currentMatchIndex + 1} / {totalMatches}
		</div>

		<button type="button" onclick={navigatePrevious} aria-label="Previous match">
			↑
		</button>

		<button type="button" onclick={navigateNext} aria-label="Next match">
			↓
		</button>
	{/if}
</div>

<style>
	.search-container {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	input {
		flex: 1;
		min-width: 0;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
