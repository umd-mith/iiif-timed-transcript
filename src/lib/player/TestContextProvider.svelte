<script lang="ts">
	import { setContext } from 'svelte';
	import { PLAYER_CONTEXT_KEY } from './context';
	import type { PlayerContext } from './context';

	let { context, children }: { context: PlayerContext; children: any } = $props();

	setContext(PLAYER_CONTEXT_KEY, context);
</script>

{@render children()}
