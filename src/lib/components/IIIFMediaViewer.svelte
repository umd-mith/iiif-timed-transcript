<script lang="ts">
	import { onMount } from 'svelte';
	import MediaPlayer from './MediaPlayer.svelte';
	import {
		getFirstCanvas,
		getPrimaryResource,
		isAudioCanvas,
		isVideoCanvas
	} from '../iiif/helpers';
	import { ManifestSchema } from '../iiif/validators';

	let {
		iiifManifestUrl,
		canvasIndex = 0,
		controls = true,
		initialSeekTime,
		onError,
		onLoad,
		onReady,
		onTimeUpdate,
		onPlayStateChange,
		onDurationChange,
		/** Optional class for the wrapper div (Tailwind-friendly) */
		class: className = ''
	}: {
		iiifManifestUrl: string;
		/** Canvas index to load for multi-audio items. Defaults to 0. */
		canvasIndex?: number;
		/** Whether to show native browser controls. Defaults to true. */
		controls?: boolean;
		/** Time in seconds to seek to once the player is ready. Applied once on initial load. */
		initialSeekTime?: number;
		onError?: (error: Error) => void;
		onLoad?: () => void;
		onReady?: () => void;
		/** Callback when playback time updates */
		onTimeUpdate?: (currentTime: number) => void;
		/** Callback when play/pause state changes */
		onPlayStateChange?: (isPlaying: boolean) => void;
		/** Callback when media duration becomes available */
		onDurationChange?: (duration: number) => void;
		/** Optional CSS class for styling (Tailwind-friendly) */
		class?: string;
	} = $props();

	// MediaPlayer ref for exposing public API
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let playerRef: any = $state();

	let isLoading = $state(true);
	let hasError = $state(false);
	let errorMessage = $state('');
	let mediaUrl = $state('');
	let mediaType = $state<'audio' | 'video'>('audio');
	let dimensions = $state<{ width?: number; height?: number }>({});
	let hasAppliedInitialSeek = false;

	async function loadManifest() {
		try {
			isLoading = true;
			hasError = false;

			// Fetch manifest from URL
			const response = await fetch(iiifManifestUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
			}
			const manifest = await response.json();

			// Validate with Zod schema
			const validationResult = ManifestSchema.safeParse(manifest);
			if (!validationResult.success) {
				throw new Error(
					`Invalid IIIF manifest: ${validationResult.error.issues.map((e: { message: string }) => e.message).join(', ')}`
				);
			}

			const validManifest = validationResult.data;

			// Get canvas at specified index (with fallback to 0)
			const canvas =
				validManifest.items && validManifest.items[canvasIndex]
					? validManifest.items[canvasIndex]
					: getFirstCanvas(validManifest);

			if (!canvas) {
				throw new Error('No canvas found in IIIF manifest');
			}

			// Determine media type
			if (isAudioCanvas(canvas)) {
				mediaType = 'audio';
			} else if (isVideoCanvas(canvas)) {
				mediaType = 'video';
			} else {
				throw new Error('Canvas is not audio or video media');
			}

			// Extract primary resource URL
			const primaryResource = getPrimaryResource(canvas);
			if (!primaryResource?.id) {
				throw new Error('No media resource found in canvas');
			}

			mediaUrl = primaryResource.id;

			// Extract optional dimensions for video
			if (mediaType === 'video' && canvas.width && canvas.height) {
				dimensions = { width: canvas.width, height: canvas.height };
			}

			isLoading = false;
			onLoad?.();
			onReady?.();
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to load IIIF manifest:', error);
			const errorObj = error instanceof Error ? error : new Error(String(error));
			errorMessage = errorObj.message;
			hasError = true;
			isLoading = false;
			onError?.(errorObj);
		}
	}

	function applyInitialSeek() {
		if (
			!hasAppliedInitialSeek &&
			initialSeekTime != null &&
			initialSeekTime > 0 &&
			playerRef
		) {
			hasAppliedInitialSeek = true;
			seekTo(initialSeekTime);
		}
	}

	function handleMediaLoad() {
		isLoading = false;
		onLoad?.();
		applyInitialSeek();
	}

	function handleMediaError(error: { code: number; message: string; userMessage: string }) {
		// eslint-disable-next-line no-console
		console.error('Media load error:', error);
		errorMessage = error.userMessage;
		hasError = true;
		isLoading = false;
		onError?.(new Error(error.message));
	}

	onMount(() => {
		loadManifest();
	});

	// Public API: Expose MediaPlayer methods for programmatic control
	export function seekTo(time: number): void {
		playerRef?.seekTo(time);
	}

	export function getCurrentTime(): number {
		return playerRef?.getCurrentTime() ?? 0;
	}

	export function getDuration(): number {
		return playerRef?.getDuration() ?? 0;
	}

	export async function play(): Promise<void> {
		if (playerRef) {
			await playerRef.play();
		}
	}

	export function pause(): void {
		playerRef?.pause();
	}

	export function isReady(): boolean {
		return playerRef?.isReady() ?? false;
	}

	export function setPlaybackRate(rate: number): void {
		playerRef?.setPlaybackRate(rate);
	}
</script>

<div class="iiif-media-viewer {className}">
	{#if isLoading}
		<div class="iiif-media-viewer__loading" role="status" aria-label="Loading media">
			<div class="iiif-media-viewer__spinner"></div>
			<p class="iiif-media-viewer__loading-text">Loading IIIF media...</p>
		</div>
	{:else if hasError}
		<div class="iiif-media-viewer__error" role="alert">
			<p>Failed to load IIIF media: {errorMessage}</p>
		</div>
	{:else if mediaUrl}
		<MediaPlayer
			bind:this={playerRef}
			{mediaUrl}
			{mediaType}
			{dimensions}
			crossOrigin="anonymous"
			{controls}
			{...(onTimeUpdate ? { onTimeUpdate } : {})}
			{...(onPlayStateChange ? { onPlayStateChange } : {})}
			{...(onDurationChange ? { onDurationChange } : {})}
			onCanPlay={handleMediaLoad}
			onError={handleMediaError}
		/>
	{/if}
</div>

<style>
	/*
	 * Minimal unstyled layout - consumers can override with Tailwind or custom CSS
	 * BEM-style classes provide clear styling hooks
	 */
	.iiif-media-viewer {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.iiif-media-viewer__loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 1rem;
	}

	.iiif-media-viewer__spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #e5e5e5;
		border-top: 3px solid #0066cc;
		border-radius: 50%;
		animation: iiif-media-viewer-spin 1s linear infinite;
	}

	@keyframes iiif-media-viewer-spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.iiif-media-viewer__loading-text {
		margin: 0;
	}

	.iiif-media-viewer__error {
		padding: 2rem 1rem;
		text-align: center;
		color: #b91c1c;
	}
</style>
