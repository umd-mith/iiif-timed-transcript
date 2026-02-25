<script lang="ts">
	import type { IIIFMediaViewerRef } from '../sync/types';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Reference to MediaPlayer or IIIFMediaViewer */
		playerRef: IIIFMediaViewerRef | null;

		// Feature toggles
		/** Show skip buttons */
		enableSkip?: boolean;
		/** Show speed picker */
		enableSpeed?: boolean;

		// Feature configuration
		/** Skip button values in seconds */
		skipAmounts?: number[];
		/** Speed picker options */
		speedOptions?: number[];

		// Icon snippets (optional - fall back to text labels)
		/** Custom play icon snippet. Provide both playIcon and pauseIcon for consistent visuals. */
		playIcon?: Snippet;
		/** Custom pause icon snippet. Provide both playIcon and pauseIcon for consistent visuals. */
		pauseIcon?: Snippet;
		/** Custom skip icon snippet — receives the skip amount in seconds from skipAmounts */
		skipIcon?: Snippet<[{ seconds: number }]>;

		// Reactive state props (optional - fallback to playerRef methods)
		/** Current playback time - pass from parent for reactivity */
		currentTime?: number;
		/** Media duration - pass from parent for reactivity */
		duration?: number;
		/** Whether audio is playing - pass from parent for reactivity */
		isPlaying?: boolean;
		/** Current playback speed - pass from parent for reactivity */
		playbackSpeed?: number;
	}

	let {
		playerRef,
		enableSkip = true,
		enableSpeed = true,
		skipAmounts = [5, 15, 30],
		speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2],
		playIcon,
		pauseIcon,
		skipIcon,
		currentTime: currentTimeProp,
		duration: durationProp,
		isPlaying: isPlayingProp,
		playbackSpeed: playbackSpeedProp
	}: Props = $props();

	// Speed picker dropdown state
	let showSpeedDropdown = $state(false);

	// ARIA announcement state
	let announcement = $state('');

	// Derived state - use props if provided, otherwise fallback to playerRef methods
	const isPlaying = $derived(isPlayingProp ?? playerRef?.isPlaying?.() ?? false);
	const currentTime = $derived(currentTimeProp ?? playerRef?.getCurrentTime?.() ?? 0);
	const duration = $derived(durationProp ?? playerRef?.getDuration?.() ?? 0);
	const currentSpeed = $derived(playbackSpeedProp ?? playerRef?.getPlaybackSpeed?.() ?? 1);

	// Controls disabled when no playerRef or zero duration
	const isDisabled = $derived(!playerRef || duration === 0);

	// ARIA announcement helper
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 3000);
	}

	// Play/pause handler
	function handlePlayPause() {
		if (!playerRef) return;

		if (isPlaying) {
			playerRef.pause();
			announce('Paused');
		} else {
			playerRef.play();
			announce('Playing');
		}
	}

	// Skip handler
	function handleSkip(amount: number) {
		if (!playerRef) return;

		const newTime = currentTime + amount;
		const clampedTime = Math.max(0, Math.min(duration, newTime));
		playerRef.seekTo(clampedTime);
		announce(`Now at ${formatTime(clampedTime)}`);
	}

	// Speed picker handlers
	function toggleSpeedDropdown() {
		showSpeedDropdown = !showSpeedDropdown;
	}

	function selectSpeed(speed: number) {
		if (!playerRef) return;

		playerRef.setPlaybackSpeed(speed);
		showSpeedDropdown = false;
		announce(`Speed: ${speed}x`);
	}

	// Progress bar seek handler
	function handleProgressClick(event: MouseEvent) {
		if (!playerRef) return;

		const track = event.currentTarget as HTMLElement;
		const rect = track.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const percentage = clickX / rect.width;
		const seekTime = percentage * duration;

		playerRef.seekTo(seekTime);
	}

	// Progress bar keyboard handler
	function handleProgressKeydown(event: KeyboardEvent) {
		if (!playerRef) return;

		const step = 5; // 5 second steps with arrow keys

		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				handleSkip(-step);
				break;
			case 'ArrowRight':
				event.preventDefault();
				handleSkip(step);
				break;
			case 'Home':
				event.preventDefault();
				playerRef.seekTo(0);
				break;
			case 'End':
				event.preventDefault();
				playerRef.seekTo(duration);
				break;
		}
	}

	// Format time as h:mm:ss or m:ss depending on duration
	function formatTime(seconds: number): string {
		if (isNaN(seconds) || seconds < 0) return '0:00';

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div data-audio-controls>
	<!-- Progress bar -->
	<div data-audio-progress>
		<div
			data-audio-progress-track
			onclick={handleProgressClick}
			onkeydown={handleProgressKeydown}
			role="slider"
			aria-valuemin="0"
			aria-valuemax={duration}
			aria-valuenow={currentTime}
			tabindex="0"
		>
			<div data-audio-progress-fill></div>
		</div>
		<!-- Time display -->
		<div data-audio-time>
			{formatTime(currentTime)} / {formatTime(duration)}
		</div>
	</div>

	<!-- Controls row -->
	<div>
		{#if enableSkip}
			<!-- Skip buttons -->
			{#each skipAmounts as amount}
				<button
					type="button"
					data-audio-button="skip"
					onclick={() => handleSkip(amount)}
					disabled={isDisabled}
				>
					{#if skipIcon}
						{@render skipIcon({ seconds: amount })}
					{:else}
						{Math.abs(amount)}s
					{/if}
				</button>
			{/each}
		{/if}

		<!-- Play/pause button -->
		<button
			type="button"
			data-audio-button="play-pause"
			onclick={handlePlayPause}
			disabled={isDisabled}
		>
			{#if isPlaying && pauseIcon}
				{@render pauseIcon()}
			{:else if !isPlaying && playIcon}
				{@render playIcon()}
			{:else}
				{isPlaying ? 'Pause' : 'Play'}
			{/if}
		</button>

		{#if enableSpeed}
			<!-- Speed picker -->
			<div style="position: relative;">
				<button
					type="button"
					data-audio-button="speed"
					onclick={toggleSpeedDropdown}
					disabled={isDisabled}
				>
					{currentSpeed}x
				</button>

				{#if showSpeedDropdown}
					<div data-audio-speed-dropdown style="position: absolute; background: white; border: 1px solid black;">
						{#each speedOptions as speed}
							<button
								type="button"
								data-audio-speed-option
								onclick={() => selectSpeed(speed)}
							>
								{speed}x
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- ARIA announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	/* Minimal reset */
	button {
		all: unset;
		cursor: pointer;
	}

	button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Screen reader only utility */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
