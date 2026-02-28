<script lang="ts">
	import { setContext, onMount, untrack } from 'svelte';
	import { PLAYER_CONTEXT_KEY, type PlayerState, type CanvasInfo } from './context';
	import { getFirstCanvas, getPrimaryResource, isAudioCanvas, isVideoCanvas, getSupplementaryVTTTracks, buildCanvasInfoList, filterChaptersForCanvas } from '../iiif/helpers';
	import { ManifestSchema, type ManifestData } from '../iiif/validators';
	import { isHlsUrl, isHlsNativelySupported, createHlsAdapter, type HlsConstructor } from '../media/hlsUtils';
	import type { MediaStrategy } from './context';
	import type { Chapter } from '@umd-mith/iiif-media-parsers';
	import type { Annotation } from '../sync/types';
	import type { TrackDefinition } from './Viewer.svelte';
	import { manifestCache } from './manifestCache';

	// Props
	let {
		manifestUrl,
		canvasIndex = 0,
		annotations = [],
		initialTime,
		autoplay = false,
		hlsConstructor,
		onCanvasChange,
		class: className = '',
		children
	}: {
		manifestUrl: string;
		canvasIndex?: number;
		annotations?: Annotation[];
		initialTime?: number;
		autoplay?: boolean;
		hlsConstructor?: HlsConstructor;
		onCanvasChange?: (index: number, canvas: CanvasInfo) => void;
		class?: string;
		children?: any;
	} = $props();

	// Reactive state
	let playerState = $state<PlayerState>({
		isPlaying: false,
		isBuffering: false,
		currentTime: 0,
		duration: 0,
		playbackRate: 1,
		isReady: false,
		error: null
	});

	let mediaElement = $state<HTMLMediaElement | null>(null);
	let mediaUrl = $state('');
	let mediaType = $state<'audio' | 'video'>('audio');
	let mediaStrategy = $state<MediaStrategy>('native');
	let hlsAdapter = $state<ReturnType<typeof createHlsAdapter> | null>(null);
	let chapters = $state<Chapter[]>([]);
	let tracks = $state<TrackDefinition[]>([]);

	// Canvas navigation state
	let activeCanvasIndex = $state(canvasIndex);
	let canvasInfoList = $state<CanvasInfo[]>([]);
	let manifestData = $state<{ validated: ManifestData; raw: unknown } | null>(null);

	let activeChapterId = $derived.by(() => {
		const time = playerState.currentTime;
		for (const chapter of chapters) {
			if (time >= chapter.startTime && time < chapter.endTime) {
				return chapter.id;
			}
		}
		return null;
	});

	// React to prop-driven canvas changes after manifest is loaded.
	// This effect drives external side effects (media teardown/setup), not state derivation.
	$effect(() => {
		const propIndex = canvasIndex;
		untrack(() => {
			if (manifestData && propIndex !== activeCanvasIndex) {
				performCanvasSwitch(propIndex);
			}
		});
	});

	function performCanvasSwitch(index: number) {
		if (!manifestData) return;
		if (index < 0 || index >= canvasInfoList.length) return;
		if (index === activeCanvasIndex) return;

		// Pause and detach current media
		mediaElement?.pause();
		hlsAdapter?.detach();

		// Reset player state for new canvas
		playerState.isPlaying = false;
		playerState.currentTime = 0;
		playerState.duration = 0;
		playerState.isReady = false;
		playerState.error = null;

		// Clear mediaUrl to trigger Viewer unmount
		mediaUrl = '';

		// Update active index and load new canvas
		activeCanvasIndex = index;
		loadCanvas(index);

		// Fire callback
		if (onCanvasChange && canvasInfoList[index]) {
			onCanvasChange(index, canvasInfoList[index]);
		}
	}

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
			await fetchManifestData();
		},
		seekToChapter: (chapter: Chapter) => {
			actions.seekTo(chapter.startTime);
		},
		switchCanvas: (index: number) => {
			performCanvasSwitch(index);
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
		get mediaStrategy() { return mediaStrategy; },
		get hlsAdapter() { return hlsAdapter; },
		get chapters() { return chapters; },
		get activeChapterId() { return activeChapterId; },
		get tracks() { return tracks; },
		get canvasIndex() { return activeCanvasIndex; },
		get canvasCount() { return canvasInfoList.length; },
		get canvases() { return canvasInfoList; },
		actions
	});

	// Fetch and validate a manifest, using module-level cache to avoid duplicate requests
	async function fetchAndValidateManifest(url: string): Promise<{ validated: ManifestData; raw: unknown }> {
		const response = await fetch(url);
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

		return { validated: validationResult.data, raw: manifest };
	}

	// Phase 1: Fetch manifest — runs once per manifestUrl
	async function fetchManifestData() {
		try {
			let manifestPromise = manifestCache.get(manifestUrl);
			if (!manifestPromise) {
				manifestPromise = fetchAndValidateManifest(manifestUrl);
				manifestCache.set(manifestUrl, manifestPromise);
			}

			manifestData = await manifestPromise;
			canvasInfoList = buildCanvasInfoList(manifestData.validated);

			loadCanvas(activeCanvasIndex);
		} catch (error) {
			manifestCache.delete(manifestUrl);
			playerState.error = error instanceof Error ? error : new Error(String(error));
			playerState.isReady = false;
		}
	}

	// Phase 2: Load a specific canvas — runs on each canvas switch
	function loadCanvas(index: number) {
		if (!manifestData) return;

		try {
			const canvas = manifestData.validated.items?.[index] ?? getFirstCanvas(manifestData.validated);

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

			// Determine media strategy for HLS streams
			if (isHlsUrl(primaryResource.id, primaryResource.format)) {
				if (isHlsNativelySupported()) {
					mediaStrategy = 'native';
				} else {
					mediaStrategy = 'hls-js';
					resolveHlsAdapter();
				}
			} else {
				mediaStrategy = 'native';
			}

			// Filter chapters to current canvas
			chapters = filterChaptersForCanvas(manifestData.raw, canvas.id);

			// Discover VTT caption tracks from canvas.annotations (recipe 0219)
			tracks = getSupplementaryVTTTracks(canvas);
		} catch (error) {
			playerState.error = error instanceof Error ? error : new Error(String(error));
			playerState.isReady = false;
		}
	}

	async function resolveHlsAdapter() {
		const Hls = hlsConstructor
			?? await import('hls.js').then((m) => m.default as unknown as HlsConstructor).catch(() => {
					console.warn(
						'[IIIFPlayer] HLS stream detected but hls.js is not installed. ' +
							'Install it with: npm install hls.js'
					);
					return null;
				});
		if (Hls) {
			hlsAdapter = createHlsAdapter(Hls);
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
		const handleWaiting = () => {
			playerState.isBuffering = true;
		};
		const handleCanPlay = () => {
			playerState.isBuffering = false;
		};

		el.addEventListener('play', handlePlay);
		el.addEventListener('pause', handlePause);
		el.addEventListener('timeupdate', handleTimeUpdate);
		el.addEventListener('durationchange', handleDurationChange);
		el.addEventListener('ratechange', handleRateChange);
		el.addEventListener('error', handleError);
		el.addEventListener('waiting', handleWaiting);
		el.addEventListener('canplay', handleCanPlay);

		return () => {
			el.removeEventListener('play', handlePlay);
			el.removeEventListener('pause', handlePause);
			el.removeEventListener('timeupdate', handleTimeUpdate);
			el.removeEventListener('durationchange', handleDurationChange);
			el.removeEventListener('ratechange', handleRateChange);
			el.removeEventListener('error', handleError);
			el.removeEventListener('waiting', handleWaiting);
			el.removeEventListener('canplay', handleCanPlay);
		};
	});

	// Load manifest on mount
	onMount(async () => {
		await fetchManifestData();
	});

	// Cleanup on unmount — capture current element and adapter
	$effect(() => {
		const el = mediaElement;
		const adapter = hlsAdapter;
		return () => {
			adapter?.detach();
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
		{@render children({ player: { state: playerState, actions, chapters, activeChapterId } })}
	{/if}
</div>
