<script lang="ts">
	import { setContext, onMount } from 'svelte';
	import { PLAYER_CONTEXT_KEY, type PlayerState } from './context';
	import { getFirstCanvas, getPrimaryResource, isAudioCanvas, isVideoCanvas } from '../iiif/helpers';
	import { ManifestSchema } from '../iiif/validators';
	import type { Annotation } from '../sync/types';

	// Props
	let {
		manifestUrl,
		canvasIndex = 0,
		annotations = [],
		initialTime,
		autoplay = false,
		class: className = '',
		children
	}: {
		manifestUrl: string;
		canvasIndex?: number;
		annotations?: Annotation[];
		initialTime?: number;
		autoplay?: boolean;
		class?: string;
		children?: any;
	} = $props();

	// Reactive state
	let state = $state<PlayerState>({
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		playbackRate: 1,
		isReady: false,
		error: null
	});

	let mediaElement = $state<HTMLMediaElement | null>(null);
	let mediaUrl = $state('');
	let mediaType = $state<'audio' | 'video'>('audio');

	// Actions
	const actions = {
		play: async () => {
			if (mediaElement) {
				await mediaElement.play();
			}
		},
		pause: () => {
			mediaElement?.pause();
		},
		seekTo: (time: number) => {
			if (!mediaElement || !state.isReady) {
				console.warn('[IIIFPlayer] Cannot seek: media not ready');
				return;
			}
			if (!isFinite(time) || time < 0) {
				console.warn(`[IIIFPlayer] Invalid seek time: ${time}`);
				return;
			}
			const clampedTime = Math.min(time, state.duration);
			mediaElement.currentTime = clampedTime;
		},
		setPlaybackRate: (rate: number) => {
			if (!mediaElement) {
				console.warn('[IIIFPlayer] Cannot set playback rate: element not initialized');
				return;
			}
			const clampedRate = Math.max(0.25, Math.min(4, rate));
			mediaElement.playbackRate = clampedRate;
		},
		retry: async () => {
			state.error = null;
			await loadManifest();
		}
	};

	// Provide context
	setContext(PLAYER_CONTEXT_KEY, {
		state,
		mediaElement,
		actions
	});

	// Manifest loading
	async function loadManifest() {
		try {
			const response = await fetch(manifestUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
			}

			const manifest = await response.json();
			const validationResult = ManifestSchema.safeParse(manifest);
			if (!validationResult.success) {
				throw new Error(
					`Invalid IIIF manifest: ${validationResult.error.issues.map((e) => e.message).join(', ')}`
				);
			}

			const validManifest = validationResult.data;
			const canvas = validManifest.items?.[canvasIndex] ?? getFirstCanvas(validManifest);

			if (!canvas) {
				throw new Error('No canvas found in IIIF manifest');
			}

			if (isAudioCanvas(canvas)) {
				mediaType = 'audio';
			} else if (isVideoCanvas(canvas)) {
				mediaType = 'video';
			} else {
				throw new Error('Canvas is not audio or video media');
			}

			const primaryResource = getPrimaryResource(canvas);
			if (!primaryResource?.id) {
				throw new Error('No media resource found in canvas');
			}

			mediaUrl = primaryResource.id;
		} catch (error) {
			state.error = error instanceof Error ? error : new Error(String(error));
			state.isReady = false;
		}
	}

	// Set up media event listeners
	$effect(() => {
		if (!mediaElement) return;

		const handlePlay = () => {
			state.isPlaying = true;
		};
		const handlePause = () => {
			state.isPlaying = false;
		};
		const handleTimeUpdate = () => {
			state.currentTime = mediaElement.currentTime;
		};
		const handleDurationChange = () => {
			state.duration = mediaElement.duration;
			state.isReady = true;
		};
		const handleRateChange = () => {
			state.playbackRate = mediaElement.playbackRate;
		};
		const handleError = () => {
			const mediaError = mediaElement.error;
			if (mediaError) {
				state.error = new Error(`Media error (code ${mediaError.code})`);
				state.isReady = false;
			}
		};

		mediaElement.addEventListener('play', handlePlay);
		mediaElement.addEventListener('pause', handlePause);
		mediaElement.addEventListener('timeupdate', handleTimeUpdate);
		mediaElement.addEventListener('durationchange', handleDurationChange);
		mediaElement.addEventListener('ratechange', handleRateChange);
		mediaElement.addEventListener('error', handleError);

		return () => {
			mediaElement.removeEventListener('play', handlePlay);
			mediaElement.removeEventListener('pause', handlePause);
			mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
			mediaElement.removeEventListener('durationchange', handleDurationChange);
			mediaElement.removeEventListener('ratechange', handleRateChange);
			mediaElement.removeEventListener('error', handleError);
		};
	});

	// Load manifest on mount
	onMount(async () => {
		await loadManifest();
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (mediaElement) {
				mediaElement.pause();
				mediaElement.src = '';
			}
		};
	});
</script>

<div class="iiif-player-root {className}">
	{#if state.error}
		<div role="alert" class="error">
			<strong>Error:</strong>
			{state.error.message}
		</div>
	{/if}

	{#if children}
		{@render children({ player: { state, actions } })}
	{/if}
</div>
