<script lang="ts">
  import { getPlayerContext } from "./context";
  import { t } from "../i18n/registry.svelte";

  let { class: className = "" }: { class?: string } = $props();

  const ctx = getPlayerContext();

  // Video-only, and only when the current canvas actually has caption
  // tracks — Root populates ctx.tracks with no media-type gate, while
  // <track> children only render on Viewer's video branch, so track
  // presence alone would render a dead toggle on an audio oral history.
  const visible = $derived(ctx.mediaType === "video" && ctx.tracks.length > 0);

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
