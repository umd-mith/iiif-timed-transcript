<script lang="ts">
	import { getPlayerContext } from './context';
	import { formatTimestamp } from '../transcript/utils';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();

	const { state } = getPlayerContext();

	let formatted = $derived(
		`${formatTimestamp(state.currentTime)} / ${formatTimestamp(state.duration)}`
	);
</script>

<div data-audio-control="time" class={className}>
	{formatted}
</div>
