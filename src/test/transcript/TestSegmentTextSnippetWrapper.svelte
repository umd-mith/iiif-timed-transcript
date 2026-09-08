<!--
  Test wrapper proving Segment's `text` snippet receives the `language`
  param (A2). Mirrors TestSegmentSnippetWrapper.svelte's pattern one
  directory over, for the transcript-tree Segment component.
-->
<script lang="ts">
  import Segment from "../../lib/transcript/Segment.svelte";
  import type { Annotation } from "../../lib/sync/types";

  interface Props {
    annotation: Annotation;
  }
  let { annotation }: Props = $props();
</script>

<Segment {annotation}>
  {#snippet text({ annotation: ann, language })}
    <p class="custom-text" data-language={language ?? ""}>{ann.text}</p>
  {/snippet}
</Segment>
