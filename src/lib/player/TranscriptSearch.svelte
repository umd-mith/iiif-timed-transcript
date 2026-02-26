<script lang="ts">
	import Search from '../transcript/Search.svelte';
	import type { Annotation } from '../sync/types';

	interface Props {
		annotations?: Annotation[];
		placeholder?: string;
		debounceMs?: number;
		onmatchchange?: (matches: Annotation[], index: number) => void;
		class?: string;
	}

	let {
		annotations = [],
		placeholder = 'Search transcript...',
		debounceMs = 150,
		onmatchchange,
		class: className = ''
	}: Props = $props();
</script>

<Search
	{annotations}
	{placeholder}
	{debounceMs}
	{onmatchchange}
	class={className}
/>
