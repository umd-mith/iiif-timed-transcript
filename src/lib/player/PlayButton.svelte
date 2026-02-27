<script lang="ts">
	import { getPlayerContext } from './context';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();

	const { state, actions } = getPlayerContext();

	function handleClick() {
		if (state.isPlaying) {
			actions.pause();
		} else {
			actions.play();
		}
	}
</script>

<button
	type="button"
	data-audio-button="play-pause"
	disabled={!state.isReady}
	onclick={handleClick}
	class={className}
>
	{state.isBuffering ? 'Loading...' : state.isPlaying ? 'Pause' : 'Play'}
</button>
