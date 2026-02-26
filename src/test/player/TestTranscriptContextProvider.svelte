<script lang="ts">
	import { setContext } from 'svelte';
	import { TRANSCRIPT_CONTEXT_KEY } from '../../lib/player/transcript-context';
	import type { TranscriptContext } from '../../lib/player/transcript-context';

	let { context, children }: { context: TranscriptContext; children: any } = $props();

	setContext(TRANSCRIPT_CONTEXT_KEY, context);
</script>

{@render children()}
