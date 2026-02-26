<script lang="ts">
	import { getPlayerContext } from './context';
	import { formatTimestamp } from '../transcript/utils';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();

	const { state, actions } = getPlayerContext();

	let valueText = $derived(
		`${formatTimestamp(state.currentTime)} of ${formatTimestamp(state.duration)}`
	);

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		actions.seekTo(parseFloat(target.value));
	}
</script>

<input
	type="range"
	min={0}
	max={state.duration}
	value={state.currentTime}
	step="any"
	aria-label="Playback progress"
	aria-valuetext={valueText}
	data-audio-progress
	oninput={handleInput}
	class={className}
/>
