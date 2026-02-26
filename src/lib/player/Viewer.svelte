<script lang="ts">
	import { getPlayerContext } from './context';

	// Props
	let {
		controls = true,
		crossOrigin = 'anonymous',
		class: className = ''
	}: {
		controls?: boolean;
		crossOrigin?: 'anonymous' | 'use-credentials' | '';
		class?: string;
	} = $props();

	// Get context
	const ctx = getPlayerContext();
	let localMediaElement = $state<HTMLMediaElement | null>(null);

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

{#if ctx.mediaType === 'audio'}
	<audio
		bind:this={localMediaElement}
		src={ctx.mediaUrl}
		{controls}
		crossorigin={crossOrigin}
		class={className}
	></audio>
{:else if ctx.mediaType === 'video'}
	<video
		bind:this={localMediaElement}
		src={ctx.mediaUrl}
		{controls}
		crossorigin={crossOrigin}
		class={className}
	>
		<!-- Caption track slot for accessibility - consumers should provide -->
	</video>
{/if}
