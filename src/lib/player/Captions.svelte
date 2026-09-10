<script lang="ts">
  import { getPlayerContext } from "./context";
  import { t } from "../i18n/registry.svelte";

  let { class: className = "" }: { class?: string } = $props();

  const ctx = getPlayerContext();

  // Video-only, and only when the current canvas actually has caption
  // tracks. Reads ctx.captionTracks — the tracks Viewer actually rendered,
  // including ones passed straight to Viewer's `tracks` prop — not ctx.tracks
  // (the manifest-only transcript-selection source). Track presence alone would
  // render a dead toggle on an audio oral history, hence the media-type gate.
  const visible = $derived(
    ctx.mediaType === "video" && ctx.captionTracks.length > 0,
  );

  // aria-pressed reads the machine's verdict, not a locally-tracked flag,
  // so it stays truthful even when captions were toggled through the
  // browser's native CC menu (fed back via ctx.reportNativeCaptionChange).
  const pressed = $derived(
    ctx.captionsState === "showing" || ctx.captionsState === "browserDefault",
  );

  function handleClick() {
    ctx.toggleCaptions();
  }
</script>

{#if visible}
  <button
    type="button"
    part="button"
    data-audio-button="captions"
    aria-pressed={pressed}
    aria-label={t("captions.toggleLabel")}
    onclick={handleClick}
    class={className}
  >
    CC
  </button>
{/if}
