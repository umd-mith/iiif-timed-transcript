<script lang="ts">
	import { getContext } from 'svelte';
	import Segment from '../transcript/Segment.svelte';
	import { TRANSCRIPT_CONTEXT_KEY, type TranscriptContext } from './transcript-context';
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
		annotations: annotationsProp,
		activeAnnotationId: activeAnnotationIdProp,
		highlightedIds: highlightedIdsProp,
		currentMatchId: currentMatchIdProp,
		onclick: onclickProp,
		class: className = ''
	}: Props = $props();

	// Try to read TranscriptContext (available when inside Transcript)
	const transcriptCtx = getContext<TranscriptContext | undefined>(TRANSCRIPT_CONTEXT_KEY);

	// Use context values when available, fall back to props
	const annotations = $derived(annotationsProp ?? transcriptCtx?.state.annotations ?? []);
	const activeAnnotationId = $derived(activeAnnotationIdProp ?? transcriptCtx?.state.activeAnnotationId ?? null);
	const highlightedIds = $derived(highlightedIdsProp ?? transcriptCtx?.state.highlightedIds ?? new Set<string>());
	const currentMatchId = $derived(currentMatchIdProp ?? transcriptCtx?.state.currentMatchId ?? null);
	const onclick = $derived(onclickProp ?? transcriptCtx?.actions.handleAnnotationClick);
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
		flex: 1;
	}

	.empty-message {
		padding: 1rem;
		text-align: center;
		color: #666;
	}
</style>
