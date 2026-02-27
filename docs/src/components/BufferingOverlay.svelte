<script lang="ts">
	import { getPlayerContext } from '@umd-mith/svelte-iiif-transcript-player';
	const { state } = getPlayerContext();
</script>

{#if state.isBuffering}
	<div class="buffering-overlay" role="status" aria-label="Buffering audio">
		<div class="spinner"></div>
		<span class="sr-only">Buffering...</span>
	</div>
{/if}

<style>
	.buffering-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		border-radius: inherit;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

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
