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
	let playerState = $state<PlayerState>({
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
			if (!mediaElement || !playerState.isReady) {
				console.warn('[IIIFPlayer] Cannot seek: media not ready');
				return;
			}
			if (!isFinite(time) || time < 0) {
				console.warn(`[IIIFPlayer] Invalid seek time: ${time}`);
				return;
			}
			const clampedTime = Math.min(time, playerState.duration);
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
			playerState.error = null;
			await loadManifest();
		}
	};

	// Provide context
	// Use getter/setter pairs for $state variables so child components
	// can both read updated values AND write back (e.g. Viewer sets mediaElement).
	setContext(PLAYER_CONTEXT_KEY, {
		state: playerState,
		get mediaElement() { return mediaElement; },
		set mediaElement(el) { mediaElement = el; },
		get mediaUrl() { return mediaUrl; },
		set mediaUrl(url) { mediaUrl = url; },
		get mediaType() { return mediaType; },
		set mediaType(type) { mediaType = type; },
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
			playerState.error = error instanceof Error ? error : new Error(String(error));
			playerState.isReady = false;
		}
	}

	// Set up media event listeners
	// Capture `el` at setup time so cleanup removes from the correct element,
	// even if mediaElement has changed to null by teardown.
	$effect(() => {
		const el = mediaElement;
		if (!el) return;

		const handlePlay = () => {
			playerState.isPlaying = true;
		};
		const handlePause = () => {
			playerState.isPlaying = false;
		};
		const handleTimeUpdate = () => {
			playerState.currentTime = el.currentTime;
		};
		const handleDurationChange = () => {
			playerState.duration = el.duration;
			playerState.isReady = true;
		};
		const handleRateChange = () => {
			playerState.playbackRate = el.playbackRate;
		};
		const handleError = () => {
			const mediaError = el.error;
			if (mediaError) {
				playerState.error = new Error(`Media error (code ${mediaError.code})`);
				playerState.isReady = false;
			}
		};

		el.addEventListener('play', handlePlay);
		el.addEventListener('pause', handlePause);
		el.addEventListener('timeupdate', handleTimeUpdate);
		el.addEventListener('durationchange', handleDurationChange);
		el.addEventListener('ratechange', handleRateChange);
		el.addEventListener('error', handleError);

		return () => {
			el.removeEventListener('play', handlePlay);
			el.removeEventListener('pause', handlePause);
			el.removeEventListener('timeupdate', handleTimeUpdate);
			el.removeEventListener('durationchange', handleDurationChange);
			el.removeEventListener('ratechange', handleRateChange);
			el.removeEventListener('error', handleError);
		};
	});

	// Load manifest on mount
	onMount(async () => {
		await loadManifest();
	});

	// Cleanup on unmount — capture current element
	$effect(() => {
		const el = mediaElement;
		return () => {
			if (el) {
				el.pause();
				el.src = '';
			}
		};
	});
</script>

<div class="iiif-player-root {className}">
	{#if playerState.error}
		<div role="alert" class="error">
			<strong>Error:</strong>
			{playerState.error.message}
		</div>
	{/if}

	{#if children}
		{@render children({ player: { state: playerState, actions } })}
	{/if}
</div>
