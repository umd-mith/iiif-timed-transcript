<script lang="ts">
	/**
	 * Custom transcript segments for AVAnnotate annotations.
	 *
	 * Replaces the built-in TranscriptSegments to render richer metadata:
	 * speaker attribution, category tags, and tag-based filtering.
	 * Must be a child of IIIFPlayer.Transcript (reads its context).
	 */
	import { getContext } from 'svelte';
	import type { Annotation } from '@umd-mith/svelte-iiif-transcript-player';

	interface TranscriptState {
		annotations: Annotation[];
		activeAnnotationId: string | null;
		highlightedIds: Set<string>;
		currentMatchId: string | null;
	}

	interface TranscriptContext {
		state: TranscriptState;
		actions: {
			handleAnnotationClick: (annotation: Annotation) => void;
		};
	}

	let {
		activeTags = []
	}: {
		activeTags?: string[];
	} = $props();

	const ctx = getContext<TranscriptContext>('iiif-transcript');

	// Categorize tags for color coding
	const tagColors: Record<string, { bg: string; text: string; border: string }> = {
		'Speaking': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
		'Reading': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
		'Transcription': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
		'Situational': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
		'Audience': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
		'Notes': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
		'Social': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
	};

	const defaultColor = { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };

	function formatTimestamp(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function getTags(annotation: Annotation): string[] {
		return (annotation.metadata?.tags as string[]) ?? [];
	}

	/** Extract speaker name — tags that look like proper names (not category labels) */
	function getSpeaker(annotation: Annotation): string | null {
		const tags = getTags(annotation);
		const categoryNames = new Set(Object.keys(tagColors));
		const speaker = tags.find((t) => !categoryNames.has(t));
		return speaker ?? null;
	}

	/** Category tags only (not speaker names) */
	function getCategoryTags(annotation: Annotation): string[] {
		const tags = getTags(annotation);
		const categoryNames = new Set(Object.keys(tagColors));
		return tags.filter((t) => categoryNames.has(t));
	}

	// Filter annotations by active tags
	const filteredAnnotations = $derived.by(() => {
		const anns = ctx.state.annotations;
		if (activeTags.length === 0) return anns;
		return anns.filter((a) => {
			const tags = getCategoryTags(a);
			return tags.some((t) => activeTags.includes(t));
		});
	});
</script>

{#if filteredAnnotations.length === 0}
	<p class="p-4 text-center text-ink-500 italic">No matching annotations.</p>
{:else}
	<div class="segments-container p-4">
		{#each filteredAnnotations as annotation (annotation.id)}
			{@const isActive = ctx.state.activeAnnotationId === annotation.id}
			{@const isHighlighted = ctx.state.highlightedIds.has(annotation.id) && ctx.state.currentMatchId !== annotation.id}
			{@const isCurrentMatch = ctx.state.currentMatchId === annotation.id}
			{@const speaker = getSpeaker(annotation)}
			{@const categories = getCategoryTags(annotation)}
			<button
				type="button"
				class="segment"
				class:active={isActive}
				class:highlighted={isHighlighted}
				class:current-match={isCurrentMatch}
				data-annotation-id={annotation.id}
				aria-current={isActive ? 'true' : undefined}
				onclick={() => ctx.actions.handleAnnotationClick(annotation)}
			>
				<div class="segment-header">
					<span class="timestamp">{formatTimestamp(annotation.startTime)}</span>
					{#if speaker}
						<span class="speaker">{speaker}</span>
					{/if}
				</div>
				<p class="text">{annotation.text}</p>
				{#if categories.length > 0}
					<div class="tag-row">
						{#each categories as tag (tag)}
							{@const color = tagColors[tag] ?? defaultColor}
							<span class="tag {color.bg} {color.text} {color.border}">{tag}</span>
						{/each}
					</div>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.segment {
		all: unset;
		display: block;
		width: 100%;
		cursor: pointer;
		padding: 0.75rem;
		margin-bottom: 0.25rem;
		border-radius: 0.375rem;
		border-left: 3px solid transparent;
		transition: background-color 150ms, border-color 150ms;
		text-align: left;
		box-sizing: border-box;
	}

	.segment:hover {
		background-color: #f3f4f6;
	}

	.segment:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.segment.active {
		background-color: #dbeafe;
		border-left-color: var(--color-terracotta-500, #c2410c);
	}

	.segment.highlighted {
		background-color: #fef9c3;
	}

	.segment.current-match {
		background-color: #fef08a;
		border-left-color: #eab308;
	}

	.segment-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.timestamp {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		font-variant-numeric: tabular-nums;
	}

	.speaker {
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
	}

	.text {
		margin: 0;
		color: #1f2937;
		line-height: 1.5;
		font-size: 0.9375rem;
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}

	.tag {
		display: inline-block;
		padding: 0.0625rem 0.375rem;
		font-size: 0.6875rem;
		font-weight: 500;
		border-radius: 9999px;
		border-width: 1px;
		border-style: solid;
	}
</style>
