<script lang="ts">
	let {
		class: className = '',
		children
	}: {
		class?: string;
		children?: any;
	} = $props();
</script>

<div data-audio-controls class={className}>
	{#if children}
		{@render children()}
	{/if}
</div>
