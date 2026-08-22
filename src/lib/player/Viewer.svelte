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

  // Native-caption policy (VTT design, requirement 5, revised for a
  // toggle-able transcript panel): tracks are attached exactly as today.
  // When the panel's effective annotations go empty -> non-empty, every
  // attached text track is set to "hidden" so the viewer does not see the
  // same text twice. When the panel then goes non-empty -> empty (a
  // consumer that conditionally renders <Transcript>, e.g. a toggle or tab),
  // any of those tracks still sitting at the "hidden" value we wrote are
  // restored to "showing" — a toggle-able panel must not leave the viewer
  // with neither captions nor a transcript. A track the viewer has since
  // changed (turned on via native controls, or off) is left alone either
  // way: we only ever act on a track whose mode still equals what we last
  // wrote. Explicit `tracks` prop is exempt (consumer's choice) throughout.
  let bookkeepingUrl = "";
  let hiddenTracks: TextTrack[] = [];
  $effect(() => {
    const el = localMediaElement;
    const populated = ctx.transcriptPopulated;
    const url = ctx.mediaUrl;
    const trackCount = effectiveTracks.length;
    const usingContextTracks = tracks.length === 0;
    if (!el || !url || trackCount === 0 || !usingContextTracks) return;
    if (!(el instanceof HTMLVideoElement)) return;

    untrack(() => {
      if (bookkeepingUrl !== url) {
        // New canvas: previously-tracked TextTrack objects belong to a
        // detached <video>; start over with "default" semantics.
        bookkeepingUrl = url;
        hiddenTracks = [];
      }

      if (populated) {
        if (hiddenTracks.length > 0) return; // already hidden this session
        const list = el.textTracks;
        if (list.length === 0) return;
        const hidden: TextTrack[] = [];
        for (let i = 0; i < list.length; i++) {
          const track = list[i];
          if (track) {
            track.mode = "hidden";
            hidden.push(track);
          }
        }
        hiddenTracks = hidden;
      } else if (hiddenTracks.length > 0) {
        for (const track of hiddenTracks) {
          if (track.mode === "hidden") track.mode = "showing";
        }
        hiddenTracks = [];
      }
    });
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
      {#each effectiveTracks as track, i (track.src)}
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
