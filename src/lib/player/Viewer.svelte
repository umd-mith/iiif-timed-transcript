<script lang="ts">
  import { untrack } from "svelte";
  import { getPlayerContext, type TrackDefinition } from "./context";

  // Props
  let {
    controls = false,
    crossOrigin,
    preload = "auto",
    poster,
    tracks = [],
    class: className = "",
  }: {
    controls?: boolean;
    crossOrigin?: "anonymous" | "use-credentials";
    preload?: "auto" | "metadata" | "none";
    /**
     * Poster image for video (the still shown before playback). Overrides the
     * IIIF-derived poster. Pass "" to suppress the derived poster entirely.
     */
    poster?: string;
    tracks?: TrackDefinition[];
    class?: string;
  } = $props();

  // Get context
  const ctx = getPlayerContext();
  let localMediaElement = $state<HTMLMediaElement | null>(null);

  // Merge tracks: explicit prop overrides auto-discovered context tracks
  const effectiveTracks = $derived(tracks.length > 0 ? tracks : ctx.tracks);

  // Explicit poster prop overrides the IIIF-derived poster from context.
  // `poster=""` suppresses the derived poster (empty string is not nullish).
  const resolvedPoster = $derived(poster ?? ctx.posterUrl);

  // When hls-js strategy, src is managed by the adapter, not via attribute
  // When an adapter manages the source (HLS or DASH), don't set src attribute
  const mediaSrc = $derived(
    ctx.mediaStrategy === "native" ? ctx.mediaUrl : undefined,
  );

  // Dev warning: video without captions (WCAG 1.2.2) — warn once per mediaUrl
  let warnedForUrl = "";
  $effect(() => {
    if (
      ctx.mediaType === "video" &&
      effectiveTracks.length === 0 &&
      ctx.mediaUrl &&
      ctx.mediaUrl !== warnedForUrl
    ) {
      warnedForUrl = ctx.mediaUrl;
      console.warn(
        "[IIIFPlayer] Video has no caption tracks. " +
          "Provide captions via the tracks prop or IIIF manifest annotations for WCAG 1.2.2 compliance.",
      );
    }
  });

  // Captions policy is owned by the captions state machine in Root
  // (captionsMachine.ts) — ctx.captionsState is the machine's current
  // verdict; ctx.reportNativeCaptionChange feeds native CC-menu changes
  // back into it. Viewer is a pure sink: it applies the verdict to the DOM
  // and reports what the DOM reports. It never decides policy itself.
  //
  // Only the selected track (index 0, matching the `default={i === 0}`
  // wiring below) ever leaves "disabled": a multi-language Choice canvas
  // must never show two caption tracks at once, so every other track is
  // forced to "disabled" regardless of machine state. This runs for both
  // context-discovered and explicit `tracks`-prop tracks — the machine
  // policy is not exempt for an explicit prop the way the old latch was
  // (behavior change, noted in the changeset).
  $effect(() => {
    const el = localMediaElement;
    const verdict = ctx.captionsState;
    const trackCount = effectiveTracks.length;
    if (!el || !(el instanceof HTMLVideoElement)) return;
    if (trackCount === 0) return;
    untrack(() => {
      const list = el.textTracks;
      for (let i = 0; i < list.length; i++) {
        const track = list[i];
        if (!track) continue;
        if (i !== 0) {
          track.mode = "disabled";
          continue;
        }
        // "unavailable"/"browserDefault": leave the browser's own default
        // selection alone — the machine has not decided anything yet.
        if (verdict === "showing") track.mode = "showing";
        else if (verdict === "hidden" || verdict === "autoHidden")
          track.mode = "hidden";
      }
    });
  });

  // The browser mutates TextTrack.mode behind our backs via the native CC
  // menu. This listener is an input to the machine, not policy: it reports
  // what the DOM says, and the machine (in Root) decides what that means.
  //
  // A `<track default>` element makes the browser select and show that
  // track on its own (HTML spec's "honor user preferences for automatic
  // text track selection"), and that selection queues its own 'change'
  // event on textTracks — indistinguishable, from this listener's view,
  // from a real native CC-menu action. Left unfiltered, that echo would
  // reach the machine as a NATIVE_CHANGE before it ever sees
  // TRANSCRIPT_POPULATED, jumping straight to userControlled and defeating
  // the auto-hide policy on every load. The listener is recreated (and this
  // flag reset) whenever `el` changes, so each canvas/media load gets its
  // own one-time skip.
  $effect(() => {
    const el = localMediaElement;
    if (!el || !(el instanceof HTMLVideoElement)) return;
    const list = el.textTracks;
    let skippedInitialSelection = false;
    const handleChange = () => {
      if (!skippedInitialSelection) {
        skippedInitialSelection = true;
        return;
      }
      const selected = list[0];
      if (!selected) return;
      if (selected.mode === "showing" || selected.mode === "hidden") {
        ctx.reportNativeCaptionChange(selected.mode);
      }
    };
    list.addEventListener("change", handleChange);
    return () => list.removeEventListener("change", handleChange);
  });

  // Update context's mediaElement when ours is mounted
  $effect(() => {
    if (localMediaElement) {
      ctx.mediaElement = localMediaElement;
    }
    return () => {
      // Cleanup on unmount
      if (ctx.mediaElement === localMediaElement) {
        ctx.mediaElement = null;
      }
    };
  });

  // Native media error handler — unifies with HLS errors under ctx.state.error.
  // Messages are written for end users in plain language.
  const MEDIA_ERROR_MESSAGES: Record<number, string> = {
    2: "Unable to load media. Check your network connection and try again.",
    3: "This media file could not be played. The file may be damaged.",
    4: "This media format is not supported by your browser.",
  };

  function handleMediaError(e: Event) {
    const el = e.currentTarget as HTMLMediaElement;
    const err = el.error;

    // Code 1 (MEDIA_ERR_ABORTED) is intentional — triggered by src changes
    // during canvas switching, not a real error. Same pattern as AbortError
    // filtering in PlayerState.svelte.ts.
    if (err?.code === 1) return;

    // Code 3 (MEDIA_ERR_DECODE) can be transient for large files — browsers
    // fire it during initial buffering but the media may still be playable.
    // If metadata already loaded (duration > 0), treat as non-fatal.
    if (err?.code === 3 && el.duration > 0 && !Number.isNaN(el.duration)) {
      console.warn(
        `[IIIFPlayer] Transient decode error ignored (duration=${el.duration}s already loaded)`,
      );
      return;
    }

    const message = err?.code
      ? (MEDIA_ERROR_MESSAGES[err.code] ??
        `Media playback failed (code ${err.code}).`)
      : "Media playback failed.";
    ctx.state.error = new Error(message);
    ctx.state.isReady = false;
  }

  // HLS adapter wiring: attach when strategy is hls-js and adapter exists
  $effect(() => {
    const el = localMediaElement;
    const adapter = ctx.hlsAdapter;
    if (!el || !adapter) return;

    adapter.attach(el, ctx.mediaUrl, {
      onError: (data: unknown) => {
        const errorData = data as {
          fatal?: boolean;
          type?: string;
          details?: string;
        };
        if (errorData.fatal) {
          ctx.state.error = new Error(
            `HLS error: ${errorData.type || "unknown"}`,
          );
          ctx.state.isReady = false;
        } else {
          console.warn(
            `[IIIFPlayer] Non-fatal HLS error: ${errorData.type || "unknown"} (${errorData.details || "no details"})`,
          );
        }
      },
    });

    return () => {
      adapter.detach();
    };
  });

  // DASH adapter wiring: attach when strategy is dash-js and adapter exists
  $effect(() => {
    const el = localMediaElement;
    const adapter = ctx.dashAdapter;
    if (!el || !adapter) return;

    // dash.js only fires ERROR events after internal recovery fails,
    // so all errors are effectively fatal. The error field is either a
    // string (e.g. "download", "capability") or an object with code/message.
    adapter.attach(el, ctx.mediaUrl, {
      onError: (data: unknown) => {
        const errorData = data as {
          error?: string | { code: number; message: string };
        };
        let message: string;
        if (typeof errorData.error === "string") {
          message = errorData.error;
        } else if (errorData.error && typeof errorData.error === "object") {
          message = errorData.error.message || `code ${errorData.error.code}`;
        } else {
          message = "unknown";
        }
        ctx.state.error = new Error(`DASH playback failed: ${message}`);
        ctx.state.isReady = false;
      },
    });

    return () => {
      adapter.detach();
    };
  });
</script>

{#if ctx.mediaUrl}
  {#if ctx.mediaType === "audio"}
    <audio
      bind:this={localMediaElement}
      src={mediaSrc}
      {controls}
      {preload}
      crossorigin={crossOrigin || undefined}
      class={className}
      onerror={handleMediaError}
    ></audio>
  {:else if ctx.mediaType === "video"}
    <!--
      Captions are provided at runtime from IIIF manifest annotations / the
      tracks prop (rendered dynamically below), so the static a11y check can't
      see them. A runtime dev-warning covers the genuinely caption-less case.
    -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={localMediaElement}
      src={mediaSrc}
      poster={resolvedPoster || undefined}
      {controls}
      {preload}
      crossorigin={crossOrigin || undefined}
      class={className}
      style="width: 100%;"
      onerror={handleMediaError}
    >
      <!--
        Keyed on the canvas as well as the src: a `<track>` node reused across
        a canvas switch keeps its `TextTrack.mode`, so a canvas that repeats a
        src would inherit the previous canvas's `hidden` and show no captions
        even with an empty transcript panel.
      -->
      {#each effectiveTracks as track, i (`${ctx.canvasIndex}:${track.src}`)}
        <track
          src={track.src}
          kind={track.kind}
          srclang={track.srclang}
          label={track.label}
          default={i === 0}
        />
      {/each}
    </video>
  {/if}
{/if}
