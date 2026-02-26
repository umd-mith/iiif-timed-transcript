<!-- src/lib/transcript/Search.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Annotation } from '../sync/types';

	interface Props {
		/** Array of annotations to search through */
		annotations: Annotation[];
		/**
		 * Placeholder text for search input.
		 * @default "Search transcript..."
		 */
		placeholder?: string;
		/**
		 * Debounce delay for search input in milliseconds.
		 * @default 150
		 */
		debounceMs?: number;
		/** Callback fired when search matches or current index change */
		onmatchchange?: (matches: Annotation[], currentIndex: number) => void;
	}

	let {
		annotations,
		placeholder = 'Search transcript...',
		debounceMs = 150,
		onmatchchange
	}: Props = $props();

	let query = $state('');
	let currentIndex = $state(0);
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Derived: filter annotations by search query
	const matches = $derived.by(() => {
		if (!query.trim()) return [];
		const lowerQuery = query.toLowerCase();
		return annotations.filter((ann) => ann.text.toLowerCase().includes(lowerQuery));
	});

	// Watch matches and notify parent (including when search is cleared)
	$effect(() => {
		if (query.trim()) {
			onmatchchange?.(matches, currentIndex);
		} else {
			onmatchchange?.([], -1);
		}
	});

	// Reset currentIndex when matches change
	$effect(() => {
		const matchCount = matches.length;
		if (matchCount > 0 && currentIndex >= matchCount) {
			currentIndex = 0;
		}
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);
	});

	// Debounced input handler
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value;

		// Debounce search
		if (debounceTimeout) clearTimeout(debounceTimeout);

		debounceTimeout = setTimeout(() => {
			query = value;
			currentIndex = 0;
		}, debounceMs);
	}

	// Navigation
	function navigatePrevious() {
		if (matches.length === 0) return;
		currentIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
		onmatchchange?.(matches, currentIndex);
	}

	function navigateNext() {
		if (matches.length === 0) return;
		currentIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1;
		onmatchchange?.(matches, currentIndex);
	}

	// Match count display
	const matchCountDisplay = $derived.by(() => {
		if (!query.trim()) return '';
		if (matches.length === 0) return 'No matches';
		return `${currentIndex + 1} of ${matches.length}`;
	});
</script>

<div class="search-container" role="search">
	<input
		type="search"
		{placeholder}
		oninput={handleInput}
		aria-label="Search transcript"
		autocomplete="off"
		spellcheck="false"
	/>

	{#if query.trim()}
		<span class="match-counter" aria-live="polite" aria-atomic="true">{matchCountDisplay}</span>
	{/if}

	{#if matches.length > 0}
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
