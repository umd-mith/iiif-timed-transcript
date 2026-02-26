<script lang="ts">
	import { getPlayerContext } from './context';

	let { onResult }: { onResult: (ctx: any) => void } = $props();

	const ctx = getPlayerContext();
	onResult(ctx);
</script>

<div data-testid="consumer">Context received</div>
