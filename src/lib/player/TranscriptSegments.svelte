<script lang="ts">
	import Segment from '../transcript/Segment.svelte';
	import type { Annotation } from '../sync/types';

	interface Props {
		annotations?: Annotation[];
		activeAnnotationId?: string | null;
		highlightedIds?: Set<string>;
		currentMatchId?: string | null;
		onclick?: (annotation: Annotation) => void;
		class?: string;
	}

	let {
		annotations = [],
		activeAnnotationId = null,
		highlightedIds = new Set(),
		currentMatchId = null,
		onclick,
		class: className = ''
	}: Props = $props();
</script>

{#if annotations.length === 0}
	<p class="empty-message">No segments available.</p>
{:else}
	<div class="segments-container {className}">
		{#each annotations as annotation (annotation.id)}
			<Segment
				{annotation}
				isActive={activeAnnotationId === annotation.id}
				isHighlighted={highlightedIds.has(annotation.id) && currentMatchId !== annotation.id}
				isCurrentMatch={currentMatchId === annotation.id}
				onclick={() => onclick?.(annotation)}
			/>
		{/each}
	</div>
{/if}

<style>
	.segments-container {
		overflow-y: auto;
		flex: 1;
	}

	.empty-message {
		padding: 1rem;
		text-align: center;
		color: #666;
	}
</style>
