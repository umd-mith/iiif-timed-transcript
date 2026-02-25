<!-- src/lib/transcript/Segment.svelte -->
<script lang="ts">
	import type { Annotation } from '../sync/types';
	import { formatTimestamp } from './utils';

	interface Props {
		annotation: Annotation;
		isActive?: boolean;
		onclick?: () => void;
	}

	let { annotation, isActive = false, onclick }: Props = $props();
</script>

<button
	type="button"
	data-annotation-id={annotation.id}
	data-state={isActive ? 'active' : 'inactive'}
	{onclick}
	aria-current={isActive ? 'true' : undefined}
>
	<span class="timestamp">{formatTimestamp(annotation.startTime)}</span>
	<p class="text">{annotation.text}</p>
</button>

<style>
	/* Unstyled - consumers use data attributes for styling */
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
</style>
