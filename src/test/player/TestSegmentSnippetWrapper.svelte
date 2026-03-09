<!--
  Test wrapper that renders TranscriptSegments with a custom segment snippet.
  The snippet renders a <div> (not button) with segmentAttrs spread,
  proving consumers can use any element type.
-->
<script lang="ts">
  import TranscriptSegments from "../../lib/player/TranscriptSegments.svelte";
  import type { Annotation } from "../../lib/sync/types";

  interface Props {
    annotations: Annotation[];
    activeAnnotationId?: string | null;
    onclick?: (annotation: Annotation) => void;
  }

  let { annotations, activeAnnotationId = null, onclick }: Props = $props();
</script>

<TranscriptSegments
  {annotations}
  {activeAnnotationId}
  {...onclick ? { onclick } : {}}
>
  {#snippet segment({ annotation, isActive, segmentAttrs })}
    <div class="custom-segment" {...segmentAttrs}>
      <span class="custom-text">{annotation.text}</span>
      {#if isActive}
        <span class="active-badge">ACTIVE</span>
      {/if}
    </div>
  {/snippet}
</TranscriptSegments>
