<script lang="ts">
	/**
	 * MediaPlayer - HTML5 audio/video with defensive seekTo()
	 * Built via TDD for LDA-592
	 */

	// Props
	let {
		mediaUrl,
		mediaType,
		dimensions,
		autoplay = false,
		controls = true,
		crossOrigin = 'anonymous',
		captionTrack,
		onTimeUpdate,
		onDurationChange: _onDurationChange,
		onPlay: _onPlay,
		onPause: _onPause,
		onEnded: _onEnded,
		onError: _onError,
		onLoadStart,
		onCanPlay,
		onPlayStateChange
	}: {
		mediaUrl: string;
		mediaType: 'audio' | 'video';
		dimensions?: { width?: number; height?: number };
		autoplay?: boolean;
		controls?: boolean;
		crossOrigin?: 'anonymous' | 'use-credentials';
		/** Optional caption/subtitle track for WCAG 1.2.2 compliance */
		captionTrack?: { src: string; srclang: string; label: string; kind?: 'captions' | 'subtitles' };
		onTimeUpdate?: (currentTime: number) => void;
		onDurationChange?: (duration: number) => void;
		onPlay?: () => void;
		onPause?: () => void;
		onEnded?: () => void;
		onError?: (error: { code: number; message: string; userMessage: string }) => void;
		onLoadStart?: () => void;
		onCanPlay?: () => void;
		/** Callback when play/pause state changes (LDA-1563) */
		onPlayStateChange?: (isPlaying: boolean) => void;
	} = $props();

	// Internal state
	let mediaElement: HTMLAudioElement | HTMLVideoElement | null = $state(null);

	/**
	 * Public API: Seek to specific time with defensive guards
	 */
	export function seekTo(time: number): void {
		// Guard 1: Element must be bound
		if (!mediaElement) {
			// eslint-disable-next-line no-console
			console.warn('[MediaPlayer] Cannot seek: element not initialized');
			return;
		}

		// Guard 2: Time must be valid number
		if (!isFinite(time) || time < 0) {
			// eslint-disable-next-line no-console
			console.warn(`[MediaPlayer] Invalid seek time: ${time}`);
			return;
		}

		// Guard 3: Media must be ready
		if (mediaElement.readyState < 2) {
			// HAVE_CURRENT_DATA
			// eslint-disable-next-line no-console
			console.warn('[MediaPlayer] Cannot seek: media not ready');
			return;
		}

		// Guard 4: Clamp to duration
		const duration = mediaElement.duration;
		const clampedTime = Math.min(time, duration);

		mediaElement.currentTime = clampedTime;
	}

	/**
	 * Public API: Get current playback time
	 */
	export function getCurrentTime(): number {
		return mediaElement?.currentTime ?? 0;
	}

	/**
	 * Public API: Get media duration
	 */
	export function getDuration(): number {
		return mediaElement?.duration ?? 0;
	}

	/**
	 * Public API: Play media
	 */
	export async function play(): Promise<void> {
		if (mediaElement) {
			await mediaElement.play();
		}
	}

	/**
	 * Public API: Pause media
	 */
	export function pause(): void {
		mediaElement?.pause();
	}

	/**
	 * Public API: Check if media is ready
	 */
	export function isReady(): boolean {
		return !!mediaElement && mediaElement.readyState >= 2; // HAVE_CURRENT_DATA
	}

	/**
	 * Public API: Set playback rate (for speed control)
	 */
	export function setPlaybackRate(rate: number): void {
		if (!mediaElement) {
			// eslint-disable-next-line no-console
			console.warn('[MediaPlayer] Cannot set playback rate: element not initialized');
			return;
		}

		// Clamp to reasonable range (0.25 to 4x)
		const clampedRate = Math.max(0.25, Math.min(4, rate));
		mediaElement.playbackRate = clampedRate;
	}

	// Cleanup
	import { onDestroy } from 'svelte';

	onDestroy(() => {
		if (mediaElement) {
			mediaElement.pause();
			mediaElement.src = '';
		}
		mediaElement = null;
	});
</script>

{#if mediaType === 'audio'}
	<audio
		bind:this={mediaElement}
		src={mediaUrl}
		{controls}
		crossorigin={crossOrigin}
		{autoplay}
		onloadstart={() => onLoadStart?.()}
		oncanplay={() => onCanPlay?.()}
		ondurationchange={(e) => _onDurationChange?.(e.currentTarget.duration)}
		onloadedmetadata={(e) => _onDurationChange?.(e.currentTarget.duration)}
		ontimeupdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
		onplay={() => onPlayStateChange?.(true)}
		onpause={() => onPlayStateChange?.(false)}
	>
		{#if captionTrack}
			<track
				kind={captionTrack.kind ?? 'captions'}
				src={captionTrack.src}
				srclang={captionTrack.srclang}
				label={captionTrack.label}
				default
			/>
		{/if}
	</audio>
{:else}
	<video
		bind:this={mediaElement}
		src={mediaUrl}
		{controls}
		crossorigin={crossOrigin}
		{autoplay}
		width={dimensions?.width}
		height={dimensions?.height}
		onloadstart={() => onLoadStart?.()}
		oncanplay={() => onCanPlay?.()}
		ondurationchange={(e) => _onDurationChange?.(e.currentTarget.duration)}
		onloadedmetadata={(e) => _onDurationChange?.(e.currentTarget.duration)}
		ontimeupdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
		onplay={() => onPlayStateChange?.(true)}
		onpause={() => onPlayStateChange?.(false)}
	>
		{#if captionTrack}
			<track
				kind={captionTrack.kind ?? 'captions'}
				src={captionTrack.src}
				srclang={captionTrack.srclang}
				label={captionTrack.label}
				default
			/>
		{/if}
	</video>
{/if}
