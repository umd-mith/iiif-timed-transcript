<script lang="ts">
	import { setContext, onMount } from 'svelte';
	import { PLAYER_CONTEXT_KEY } from './context';
	import { PlayerStateManager } from './PlayerState.svelte';
	import { getFirstCanvas, getPrimaryResource, isAudioCanvas, isVideoCanvas, getSupplementaryVTTTracks } from '../iiif/helpers';
	import { ManifestSchema, type ManifestData } from '../iiif/validators';
	import { parseRanges } from '@umd-mith/iiif-media-parsers';
	import { isHlsUrl, isHlsNativelySupported, createHlsAdapter, type HlsConstructor } from '../media/hlsUtils';
	import type { Annotation } from '../sync/types';
	import { manifestCache } from './manifestCache';

	// Props
	let {
		manifestUrl,
		canvasIndex = 0,
		annotations = [],
		initialTime,
		autoplay = false,
		hlsConstructor,
		class: className = '',
		children
	}: {
		manifestUrl: string;
		canvasIndex?: number;
		annotations?: Annotation[];
		initialTime?: number;
		autoplay?: boolean;
		hlsConstructor?: HlsConstructor;
		class?: string;
		children?: any;
	} = $props();

	// Create reactive state manager — onRetry delegates to loadManifest
	const player = new PlayerStateManager({
		onRetry: () => loadManifest()
	});

	// Provide context — the class instance satisfies PlayerContext
	setContext(PLAYER_CONTEXT_KEY, player);

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

	// Manifest loading
	async function loadManifest() {
		try {
			// Check cache first; store the Promise to deduplicate concurrent requests
			let manifestPromise = manifestCache.get(manifestUrl);
			if (!manifestPromise) {
				manifestPromise = fetchAndValidateManifest(manifestUrl);
				manifestCache.set(manifestUrl, manifestPromise);
			}

			const { validated: validManifest, raw: rawManifest } = await manifestPromise;
			const canvas = validManifest.items?.[canvasIndex] ?? getFirstCanvas(validManifest);

			if (!canvas) {
				throw new Error('No canvas found in IIIF manifest');
			}

			if (isAudioCanvas(canvas)) {
				player.mediaType = 'audio';
			} else if (isVideoCanvas(canvas)) {
				player.mediaType = 'video';
			} else {
				throw new Error('Canvas is not audio or video media');
			}

			const primaryResource = getPrimaryResource(canvas);
			if (!primaryResource?.id) {
				throw new Error('No media resource found in canvas');
			}

			player.mediaUrl = primaryResource.id;

			// Determine media strategy for HLS streams
			if (isHlsUrl(primaryResource.id, primaryResource.format)) {
				if (isHlsNativelySupported()) {
					// Safari handles HLS natively — just set src like a normal file
					player.mediaStrategy = 'native';
				} else {
					player.mediaStrategy = 'hls-js';
					const Hls = hlsConstructor
						?? await import('hls.js').then((m) => m.default as unknown as HlsConstructor).catch(() => {
								console.warn(
									'[IIIFPlayer] HLS stream detected but hls.js is not installed. ' +
										'Install it with: npm install hls.js'
								);
								return null;
							});
					if (Hls) {
						player.hlsAdapter = createHlsAdapter(Hls);
					}
				}
			} else {
				player.mediaStrategy = 'native';
			}

			// Parse chapter structures (Ranges) from the raw manifest
			// (validManifest is Zod-parsed and strips `structures`)
			player.chapters = parseRanges(rawManifest as any);

			// Discover VTT caption tracks from canvas.annotations (recipe 0219)
			player.tracks = getSupplementaryVTTTracks(canvas);
		} catch (error) {
			// Remove failed fetches from cache so retries can work
			manifestCache.delete(manifestUrl);
			player.state.error = error instanceof Error ? error : new Error(String(error));
			player.state.isReady = false;
		}
	}

	// Set up media event listeners
	// Capture `el` at setup time so cleanup removes from the correct element,
	// even if mediaElement has changed to null by teardown.
	$effect(() => {
		const el = player.mediaElement;
		if (!el) return;

		const handlePlay = () => {
			player.state.isPlaying = true;
		};
		const handlePause = () => {
			player.state.isPlaying = false;
		};
		const handleTimeUpdate = () => {
			player.state.currentTime = el.currentTime;
		};
		const handleDurationChange = () => {
			player.state.duration = el.duration;
			player.state.isReady = true;
		};
		const handleRateChange = () => {
			player.state.playbackRate = el.playbackRate;
		};
		const handleError = () => {
			const mediaError = el.error;
			if (mediaError) {
				player.state.error = new Error(`Media error (code ${mediaError.code})`);
				player.state.isReady = false;
			}
		};
		const handleWaiting = () => {
			player.state.isBuffering = true;
		};
		const handleCanPlay = () => {
			player.state.isBuffering = false;
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
		await loadManifest();
	});

	// Cleanup on unmount — capture current element and adapter
	$effect(() => {
		const el = player.mediaElement;
		const adapter = player.hlsAdapter;
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
	{#if player.state.error}
		<div role="alert" class="error">
			<strong>Error:</strong>
			{player.state.error.message}
		</div>
	{/if}

	{#if children}
		{@render children({ player: { state: player.state, actions: player.actions, chapters: player.chapters, activeChapterId: player.activeChapterId } })}
	{/if}
</div>
