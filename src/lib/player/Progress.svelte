<script lang="ts">
	import { getPlayerContext } from './context';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();

	const { state, actions } = getPlayerContext();

	// Calculate progress percentage
	let percentage = $derived(
		state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
	);

	function handleClick(event: MouseEvent) {
		const track = event.currentTarget as HTMLElement;
		const rect = track.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const clickPercentage = clickX / rect.width;
		const seekTime = clickPercentage * state.duration;
		actions.seekTo(seekTime);
	}

	function handleKeydown(event: KeyboardEvent) {
		const step = 5; // 5 second steps

		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				actions.seekTo(Math.max(0, state.currentTime - step));
				break;
			case 'ArrowRight':
				event.preventDefault();
				actions.seekTo(Math.min(state.duration, state.currentTime + step));
				break;
		}
	}
</script>

<div
	role="slider"
	aria-label="Playback progress"
	aria-valuemin={0}
	aria-valuemax={state.duration}
	aria-valuenow={state.currentTime}
	tabindex="0"
	data-audio-progress
	onclick={handleClick}
	onkeydown={handleKeydown}
	class={className}
>
	<div data-progress-track></div>
	<div data-progress-thumb style="left: {percentage}%"></div>
</div>
