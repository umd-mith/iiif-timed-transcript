<script lang="ts">
  // Exercises Transcript's optional `loading` snippet, which cannot be passed
  // through the plain-props mount helpers used elsewhere in these tests.
  import Transcript from "../../lib/player/Transcript.svelte";
</script>

<Transcript annotations={[]}>
  {#snippet loading()}
    <p class="custom-loading">Fetching the transcript</p>
  {/snippet}
  {#snippet empty()}
    <p class="custom-empty">Nothing here</p>
  {/snippet}
</Transcript>
