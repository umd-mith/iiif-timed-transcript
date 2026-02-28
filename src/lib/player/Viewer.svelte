<script lang="ts">
	import { getPlayerContext } from './context';

	export interface TrackDefinition {
		src: string;
		kind: 'captions' | 'subtitles' | 'descriptions' | 'chapters' | 'metadata';
		srclang: string;
		label: string;
	}

	// Props
	let {
		controls = false,
		crossOrigin,
		preload = 'auto',
		tracks = [],
		class: className = ''
	}: {
		controls?: boolean;
		crossOrigin?: 'anonymous' | 'use-credentials';
		preload?: 'auto' | 'metadata' | 'none';
		tracks?: TrackDefinition[];
		class?: string;
	} = $props();

	// Get context
	const ctx = getPlayerContext();
	let localMediaElement = $state<HTMLMediaElement | null>(null);

	// Merge tracks: explicit prop overrides auto-discovered context tracks
	const effectiveTracks = $derived(tracks.length > 0 ? tracks : ctx.tracks);

	// When hls-js strategy, src is managed by the adapter, not via attribute
	const mediaSrc = $derived(ctx.mediaStrategy === 'hls-js' ? undefined : ctx.mediaUrl);

	// Update context's mediaElement when ours is mounted
	$effect(() => {
		if (localMediaElement) {
			ctx.mediaElement = localMediaElement;
		}
		return () => {
			// Cleanup on unmount
			if (ctx.mediaElement === localMediaElement) {
				ctx.mediaElement = null;
			}
		};
	});

	// HLS adapter wiring: attach when strategy is hls-js and adapter exists
	$effect(() => {
		const el = localMediaElement;
		const adapter = ctx.hlsAdapter;
		if (!el || !adapter) return;

		adapter.attach(el, ctx.mediaUrl, {
			onError: (data: unknown) => {
				const errorData = data as { fatal?: boolean; type?: string };
				if (errorData.fatal) {
					ctx.state.error = new Error(
						`HLS error: ${errorData.type || 'unknown'}`
					);
				}
			}
		});

		return () => {
			adapter.detach();
		};
	});
</script>

{#if ctx.mediaUrl}
	{#if ctx.mediaType === 'audio'}
		<audio
			bind:this={localMediaElement}
			src={mediaSrc}
			{controls}
			{preload}
			crossorigin={crossOrigin || undefined}
			class={className}
		></audio>
	{:else if ctx.mediaType === 'video'}
		<!-- svelte-ignore a11y_media_has_caption — tracks provided via tracks prop -->
		<video
			bind:this={localMediaElement}
			src={mediaSrc}
			{controls}
			{preload}
			crossorigin={crossOrigin || undefined}
			class={className}
			style="width: 100%;"
		>
			{#each effectiveTracks as track, i}
				<track
					src={track.src}
					kind={track.kind}
					srclang={track.srclang}
					label={track.label}
					default={i === 0}
				/>
			{/each}
		</video>
	{/if}
{/if}
