<script lang="ts">
	import { getContext } from 'svelte';
	import Search from '../transcript/Search.svelte';
	import { TRANSCRIPT_CONTEXT_KEY, type TranscriptContext } from './transcript-context';
	import type { Annotation } from '../sync/types';

	interface Props {
		annotations?: Annotation[];
		placeholder?: string;
		debounceMs?: number;
		onmatchchange?: (matches: Annotation[], index: number) => void;
		class?: string;
	}

	let {
		annotations: annotationsProp,
		placeholder = 'Search transcript...',
		debounceMs = 150,
		onmatchchange: onmatchchangeProp,
		class: className = ''
	}: Props = $props();

	// Try to read TranscriptContext (available when inside Transcript)
	const transcriptCtx = getContext<TranscriptContext | undefined>(TRANSCRIPT_CONTEXT_KEY);

	// Use context values when available, fall back to props
	const annotations = $derived(annotationsProp ?? transcriptCtx?.state.annotations ?? []);
	const onmatchchange = $derived(onmatchchangeProp ?? transcriptCtx?.actions.handleMatchChange);
</script>

<div class="transcript-search-sticky">
	<Search
		{annotations}
		{placeholder}
		{debounceMs}
		{onmatchchange}
		class={className}
	/>
</div>

<style>
	.transcript-search-sticky {
		position: sticky;
		top: 0;
		z-index: 1;
		background: inherit;
	}
</style>
