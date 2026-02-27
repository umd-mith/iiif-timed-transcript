<script lang="ts">
	import type { Chapter } from '@umd-mith/iiif-media-parsers';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { getPlayerContext } from './context';
	import { formatTimestamp } from '../transcript/utils';

	interface Props {
		onActiveChapterChange?: (chapter: Chapter | null) => void;
		chapter?: Snippet<[{ chapter: Chapter; isActive: boolean; onClick: () => void }]>;
		empty?: Snippet;
		class?: string;
	}

	let {
		onActiveChapterChange,
		chapter: chapterSnippet,
		empty,
		class: className = ''
	}: Props = $props();

	const playerContext = getPlayerContext();
	const { actions } = playerContext;

	const chapters = $derived(playerContext.chapters);
	const activeChapterId = $derived(playerContext.activeChapterId);

	$effect(() => {
		const id = activeChapterId;
		untrack(() => {
			if (onActiveChapterChange) {
				const active = id ? chapters.find((c) => c.id === id) ?? null : null;
				onActiveChapterChange(active);
			}
		});
	});

	function handleChapterClick(chapter: Chapter) {
		actions.seekToChapter(chapter);
	}
</script>

<nav class="chapters-nav {className}" aria-label="Chapters">
	{#if chapters.length === 0}
		{#if empty}
			{@render empty()}
		{:else}
			<p class="empty-message">No chapters available.</p>
		{/if}
	{:else}
		{#each chapters as ch (ch.id)}
			{#if chapterSnippet}
				{@render chapterSnippet({
					chapter: ch,
					isActive: activeChapterId === ch.id,
					onClick: () => handleChapterClick(ch)
				})}
			{:else}
				<button
					type="button"
					data-chapter-id={ch.id}
					data-state={activeChapterId === ch.id ? 'active' : 'inactive'}
					aria-current={activeChapterId === ch.id ? 'true' : undefined}
					onclick={() => handleChapterClick(ch)}
				>
					<span class="chapter-label">{ch.label}</span>
					<span class="chapter-time"
						>{formatTimestamp(ch.startTime)} – {formatTimestamp(ch.endTime)}</span
					>
				</button>
			{/if}
		{/each}
	{/if}
</nav>

<style>
	button {
		all: unset;
		display: block;
		width: 100%;
		cursor: pointer;
	}

	button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.empty-message {
		padding: 1rem;
		text-align: center;
		color: #666;
	}
</style>
