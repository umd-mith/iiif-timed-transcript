<script lang="ts">
	import { getPlayerContext } from './context';

	// Props
	let {
		controls = false,
		crossOrigin,
		preload = 'auto',
		class: className = ''
	}: {
		controls?: boolean;
		crossOrigin?: 'anonymous' | 'use-credentials';
		preload?: 'auto' | 'metadata' | 'none';
		class?: string;
	} = $props();

	// Get context
	const ctx = getPlayerContext();
	let localMediaElement = $state<HTMLMediaElement | null>(null);

	// When HLS, the src is managed externally (by hls.js adapter), not via attribute
	const mediaSrc = $derived(ctx.isHls ? undefined : ctx.mediaUrl);

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
		<video
			bind:this={localMediaElement}
			src={mediaSrc}
			{controls}
			{preload}
			crossorigin={crossOrigin || undefined}
			class={className}
			style="width: 100%;"
		>
		</video>
	{/if}
{/if}
