<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import {
    setPlayerContext,
    type CanvasInfo,
    type PlayerRef,
    type PlayerErrorInfo,
    type TranscriptStatus,
  } from "./context";
  import { PlayerStateManager } from "./PlayerState.svelte";
  import {
    getFirstCanvas,
    getPrimaryResource,
    getPosterUrl,
    isAudioCanvas,
    isVideoCanvas,
    getSupplementaryVTTTracks,
    buildCanvasInfoList,
    filterChaptersForCanvas,
    buildTranscriptAnnotations,
  } from "../iiif/helpers";
  import {
    ManifestSchema,
    type ManifestData,
    type CanvasData,
  } from "../iiif/validators";
  import {
    isHlsUrl,
    isHlsNativelySupported,
    createHlsAdapter,
    type HlsConstructor,
  } from "../media/hlsUtils";
  import {
    isDashUrl,
    createDashAdapter,
    type DashConstructor,
  } from "../media/dashUtils";
  import type { Annotation } from "../sync/types";
  import { manifestCache } from "./manifestCache";
  import {
    selectTranscriptTrack,
    loadVTTTranscript,
  } from "../iiif/vttTranscript";

  // Props
  let {
    manifestUrl,
    canvasIndex = 0,
    annotations = [],
    initialTime,
    autoplay = false,
    hlsConstructor,
    dashConstructor,
    onCanvasChange,
    onPlayerInit,
    onError,
    class: className = "",
    children,
  }: {
    manifestUrl: string;
    canvasIndex?: number;
    annotations?: Annotation[] | "auto";
    initialTime?: number;
    autoplay?: boolean;
    hlsConstructor?: HlsConstructor;
    dashConstructor?: DashConstructor;
    onCanvasChange?: (index: number, canvas: CanvasInfo) => void;
    /** Called once after manifest loads and first canvas is parsed. `state.isReady` is false at this point. */
    onPlayerInit?: (player: PlayerRef) => void;
    /**
     * Called for every reported error. `info.fatal` is true when the player
     * will not become usable (manifest, canvas, media); false for recoverable
     * conditions (a rejected play(), a transcript that failed to load).
     */
    onError?: (error: Error, info: PlayerErrorInfo) => void;
    class?: string;
    children?: import("svelte").Snippet<
      [
        {
          player: {
            state: import("./context").PlayerState;
            actions: import("./context").PlayerActions;
            annotations: Annotation[];
            chapters: import("@umd-mith/iiif-media-parsers").Chapter[];
            activeChapterId: string | null;
            transcriptStatus: TranscriptStatus;
          };
        },
      ]
    >;
  } = $props();

  // Manifest data (stored outside PlayerStateManager since it's Root-specific)
  let manifestData = $state<{ validated: ManifestData; raw: unknown } | null>(
    null,
  );

  // Create reactive state manager — onRetry delegates to loadManifest
  const player = new PlayerStateManager({
    onRetry: () => fetchManifestData(),
    onSwitchCanvas: (index: number) => performCanvasSwitch(index),
    onPlaybackError: (error: Error) =>
      reportError(error, { fatal: false, source: "playback" }),
  });

  // Provide context — the class instance satisfies PlayerContext
  setPlayerContext(player);

  // Apply initialTime (first canvas load only) and autoplay (every canvas load)
  let initialTimeApplied = false;
  let initFired = false;

  // Set in onDestroy; checked after every await so continuations of in-flight
  // work never write state or fire callbacks on a torn-down instance.
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
  });

  // Errors already handed to onError. The fallback watcher below skips them.
  const reportedErrors = new WeakSet<Error>();

  // Bumped by loadCanvas and nothing else. The media-adapter imports capture
  // it before awaiting and drop their result if it changed — instance-local,
  // so two Roots on a page never interfere.
  let loadGeneration = 0;

  // Same idea for the tier-2 VTT fetch, but bumped by loadCanvas *and* by the
  // annotations-prop mode flip. It is deliberately separate from
  // loadGeneration: a mode flip must invalidate an in-flight transcript fetch
  // without invalidating an in-flight `import("hls.js")`/`import("dashjs")`,
  // which would leave mediaStrategy set and the adapter null with no error.
  let transcriptGeneration = 0;

  // The last successfully-resolved canvas (set even if a later step in
  // loadCanvas throws — e.g. a non-AV canvas — so the annotations-prop
  // effect can still re-derive "auto" against it after a mode flip).
  let currentCanvas: CanvasData | null = null;

  function reportError(error: Error, info: PlayerErrorInfo) {
    if (destroyed) return;
    reportedErrors.add(error);
    try {
      onError?.(error, info);
    } catch (callbackError) {
      console.error("[IIIFPlayer] onError callback threw:", callbackError);
    }
  }

  // Fallback watcher: errors written to player.state.error by Viewer (native
  // onerror, HLS/DASH adapter callbacks) are fatal media failures. Anything
  // Root or PlayerState reported directly is already in reportedErrors.
  $effect(() => {
    const error = player.state.error;
    if (!error) return;
    untrack(() => {
      if (reportedErrors.has(error)) return;
      reportError(error, { fatal: true, source: "media" });
    });
  });

  $effect(() => {
    if (!player.state.isReady) return;

    if (initialTime != null && !initialTimeApplied) {
      initialTimeApplied = true;
      player.actions.seekTo(initialTime);
    }

    if (autoplay) {
      player.actions.play();
    }
  });

  // Sync annotations prop into player context. Also reacts to the prop
  // switching *mode* (array <-> "auto") without a canvas switch: flipping to
  // an array resets transcriptStatus to "idle" (README: "idle when you pass
  // annotations yourself"); flipping to "auto" re-derives tier 1/2 against
  // the currently loaded canvas so the panel doesn't keep showing a stale
  // array or stay stuck on a stale status.
  $effect(() => {
    const mode = annotations;
    untrack(() => {
      if (Array.isArray(mode)) {
        player.annotations = mode;
        player.transcriptStatus = "idle";
      } else if (mode === "auto" && currentCanvas) {
        // Drop any VTT fetch still in flight from before the flip. Only the
        // transcript counter moves — bumping loadGeneration here would
        // cancel an in-flight resolveHlsAdapter/resolveDashAdapter import
        // started by the current loadCanvas.
        transcriptGeneration += 1;
        deriveAutoAnnotations(currentCanvas);
      }
    });
  });

  // React to prop-driven canvas changes after manifest is loaded.
  // This effect drives external side effects (media teardown/setup), not state derivation.
  $effect(() => {
    const propIndex = canvasIndex;
    const manifest = manifestData;
    untrack(() => {
      if (manifest && propIndex !== player.canvasIndex) {
        performCanvasSwitch(propIndex);
      }
    });
  });

  function performCanvasSwitch(index: number) {
    if (!manifestData) return;
    if (index < 0 || index >= player.canvases.length) return;
    if (index === player.canvasIndex) return;

    // Pause and detach current media
    player.mediaElement?.pause();
    player.hlsAdapter?.detach();
    player.dashAdapter?.detach();
    player.hlsAdapter = null;
    player.dashAdapter = null;

    // Reset player state for new canvas
    player.state.isPlaying = false;
    player.state.currentTime = 0;
    player.state.duration = 0;
    player.state.isReady = false;
    player.state.error = null;

    // Clear mediaUrl to trigger Viewer unmount
    player.mediaUrl = "";
    player.posterUrl = undefined;

    // Update active index and load new canvas
    player.canvasIndex = index;
    loadCanvas(index);

    // Fire callback
    if (onCanvasChange && player.canvases[index]) {
      onCanvasChange(index, player.canvases[index]);
    }
  }

  // Fetch and validate a manifest, using module-level cache to avoid duplicate requests
  async function fetchAndValidateManifest(
    url: string,
  ): Promise<{ validated: ManifestData; raw: unknown }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch manifest: ${response.status} ${response.statusText}`,
      );
    }

    const manifest = await response.json();
    const validationResult = ManifestSchema.safeParse(manifest);
    if (!validationResult.success) {
      throw new Error(
        `Invalid IIIF manifest: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    return { validated: validationResult.data, raw: manifest };
  }

  // Fetch manifest — called on mount and on retry
  async function fetchManifestData() {
    try {
      let manifestPromise = manifestCache.get(manifestUrl);
      if (!manifestPromise) {
        manifestPromise = fetchAndValidateManifest(manifestUrl);
        manifestCache.set(manifestUrl, manifestPromise);
      }

      const data = await manifestPromise;
      if (destroyed) return;
      manifestData = data;
      player.canvases = buildCanvasInfoList(data.validated);

      loadCanvas(player.canvasIndex);
    } catch (error) {
      // The cache is module-level: evict unconditionally so a rejected
      // promise is never served to the next instance — then bail if we are
      // already torn down.
      manifestCache.delete(manifestUrl);
      if (destroyed) return;
      const err = error instanceof Error ? error : new Error(String(error));
      player.state.error = err;
      player.state.isReady = false;
      reportError(err, { fatal: true, source: "manifest" });
      return;
    }

    // Fire init callback outside the manifest try/catch so consumer
    // errors don't corrupt manifest state or cache
    if (!initFired && !player.state.error) {
      initFired = true;
      try {
        onPlayerInit?.(player);
      } catch (callbackError) {
        console.error(
          "[IIIFPlayer] onPlayerInit callback threw:",
          callbackError,
        );
      }
    }
  }

  // Phase 2: Load a specific canvas — runs on each canvas switch
  function loadCanvas(index: number) {
    if (!manifestData) return;
    loadGeneration += 1;
    transcriptGeneration += 1;

    // Reset before anything below can throw. Without this, a canvas switch
    // that lands on a non-AV canvas (or otherwise throws before reaching the
    // tier-1/2 block) would leave the *previous* canvas's transcript
    // annotations and "ready" status in place — the panel would render
    // segments for media that never loaded.
    if (annotations === "auto") {
      player.annotations = [];
      player.transcriptStatus = "idle";
    }

    try {
      const canvas =
        manifestData.validated.items?.[index] ??
        getFirstCanvas(manifestData.validated);

      if (!canvas) {
        throw new Error("No canvas found in IIIF manifest");
      }
      currentCanvas = canvas;

      if (isAudioCanvas(canvas)) {
        player.mediaType = "audio";
      } else if (isVideoCanvas(canvas)) {
        player.mediaType = "video";
      } else {
        throw new Error("Canvas is not audio or video media");
      }

      const primaryResource = getPrimaryResource(canvas);
      if (!primaryResource?.id) {
        throw new Error("No media resource found in canvas");
      }

      player.mediaUrl = primaryResource.id;

      // Resolve poster image from IIIF placeholderCanvas/accompanyingCanvas.
      // Consumed by <video poster> in Viewer (video canvases only); the
      // explicit `poster` prop on Viewer takes precedence over this.
      player.posterUrl = getPosterUrl(canvas);

      // Determine media strategy for HLS streams
      if (isHlsUrl(primaryResource.id, primaryResource.format)) {
        if (isHlsNativelySupported()) {
          // Safari handles HLS natively — just set src like a normal file
          player.mediaStrategy = "native";
        } else {
          player.mediaStrategy = "hls-js";
          resolveHlsAdapter();
        }
      } else if (isDashUrl(primaryResource.id, primaryResource.format)) {
        player.mediaStrategy = "dash-js";
        resolveDashAdapter();
      } else {
        player.mediaStrategy = "native";
      }

      // Filter chapters to current canvas
      player.chapters = filterChaptersForCanvas(manifestData.raw, canvas.id);

      // Discover VTT caption tracks from canvas.annotations (recipe 0219)
      player.tracks = getSupplementaryVTTTracks(canvas);

      // annotations="auto": tier 1 — embedded TextualBody (synchronous);
      // tier 2 — the canvas's external VTT supplementing track (async,
      // see resolveVTTTranscript). A canvas with neither yields [] / "ready".
      if (annotations === "auto") {
        deriveAutoAnnotations(canvas);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      player.state.error = err;
      player.state.isReady = false;
      reportError(err, { fatal: true, source: "canvas" });
    }
  }

  // annotations="auto" tier 1/2 derivation, shared by loadCanvas (a fresh
  // canvas) and the annotations-prop effect above (a mode flip with no
  // canvas switch).
  //
  // Tier 1: embedded TextualBody annotations whose motivation is on the
  // allow-list below. Those three are the motivations that AVAnnotate/
  // Voices-style manifests (commenting, tagging) and Cookbook-style
  // manifests (supplementing) actually use for embedded transcript text;
  // everything else (describing, highlighting, ...) is excluded. Note this
  // does NOT disambiguate a transcript from an editorial note that happens
  // to use one of the three: a `commenting` note on a canvas that also has
  // a VTT transcript wins tier 1 and suppresses tier 2. That precedence is
  // accepted — a manifest carrying both should pass `annotations` explicitly.
  //
  // Tier 2: the canvas's external VTT track, only when tier 1 yields none.
  function deriveAutoAnnotations(canvas: CanvasData) {
    const embedded = buildTranscriptAnnotations(canvas, [
      "supplementing",
      "commenting",
      "tagging",
    ]).annotations;
    if (embedded.length > 0) {
      player.annotations = embedded;
      player.transcriptStatus = "ready";
      return;
    }

    const track = selectTranscriptTrack(
      player.tracks,
      typeof navigator !== "undefined" ? navigator.language : undefined,
    );
    player.annotations = [];
    if (track) {
      player.transcriptStatus = "loading";
      resolveVTTTranscript(track.src);
    } else {
      player.transcriptStatus = "ready";
    }
  }

  // Shared by resolveHlsAdapter/resolveDashAdapter when the media library
  // they need is unavailable (not installed, or the dynamic import threw).
  function reportMediaLibraryError(err: Error) {
    console.warn(`[IIIFPlayer] ${err.message}`);
    player.state.error = err;
    player.state.isReady = false;
    reportError(err, { fatal: true, source: "media" });
  }

  async function resolveHlsAdapter() {
    const generation = loadGeneration;
    const Hls =
      hlsConstructor ??
      (await import("hls.js")
        .then((m) => m.default as unknown as HlsConstructor | undefined)
        .catch(() => undefined));
    if (destroyed || generation !== loadGeneration) return;
    if (Hls) {
      player.hlsAdapter = createHlsAdapter(Hls);
      return;
    }
    reportMediaLibraryError(
      new Error(
        "HLS stream detected but hls.js is not available. Install it with: npm install hls.js",
      ),
    );
  }

  async function resolveDashAdapter() {
    const generation = loadGeneration;
    const Dash =
      dashConstructor ??
      (await import("dashjs")
        // dashjs 5.x is ESM-only with a named `MediaPlayer` factory export.
        .then((m) => m.MediaPlayer())
        .catch(() => undefined));
    if (destroyed || generation !== loadGeneration) return;
    if (Dash) {
      player.dashAdapter = createDashAdapter(Dash);
      return;
    }
    reportMediaLibraryError(
      new Error(
        "DASH stream detected but dashjs is not available. Install it with: npm install dashjs",
      ),
    );
  }

  // Tier 2 of annotations="auto". Failures are non-fatal: the panel stays
  // empty, native captions stay attached, playback is unaffected, and
  // player.state.error is never written. Stale results (canvas switched, the
  // annotations prop flipped mode, or Root destroyed while fetching) are
  // dropped via transcriptGeneration.
  async function resolveVTTTranscript(url: string) {
    const generation = transcriptGeneration;
    try {
      const result = await loadVTTTranscript(url);
      if (destroyed || generation !== transcriptGeneration) return;
      player.annotations = result.annotations;
      player.transcriptStatus = "ready";
    } catch (error) {
      if (destroyed || generation !== transcriptGeneration) return;
      const err = error instanceof Error ? error : new Error(String(error));
      player.annotations = [];
      player.transcriptStatus = "error";
      reportError(err, { fatal: false, source: "transcript" });
    }
  }

  // Set up media event listeners
  // Capture `el` at setup time so cleanup removes from the correct element,
  // even if mediaElement has changed to null by teardown.
  $effect(() => {
    const el = player.mediaElement;
    if (!el) return;

    const handlePlay = () => {
      player.state.isPlaying = true;
    };
    const handlePause = () => {
      player.state.isPlaying = false;
    };
    const handleTimeUpdate = () => {
      player.state.currentTime = el.currentTime;
    };
    const handleDurationChange = () => {
      player.state.duration = el.duration;
      player.state.isReady = true;
    };
    const handleRateChange = () => {
      player.state.playbackRate = el.playbackRate;
    };
    // Media error handling is in Viewer.svelte's onerror handler,
    // which provides user-friendly messages and sets isReady = false.
    const handleWaiting = () => {
      player.state.isBuffering = true;
    };
    const handleCanPlay = () => {
      player.state.isBuffering = false;
    };

    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("durationchange", handleDurationChange);
    el.addEventListener("ratechange", handleRateChange);
    el.addEventListener("waiting", handleWaiting);
    el.addEventListener("canplay", handleCanPlay);

    return () => {
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("durationchange", handleDurationChange);
      el.removeEventListener("ratechange", handleRateChange);
      el.removeEventListener("waiting", handleWaiting);
      el.removeEventListener("canplay", handleCanPlay);
    };
  });

  // Load manifest on mount
  onMount(async () => {
    await fetchManifestData();
  });

  // Cleanup on unmount — capture current element and adapter
  $effect(() => {
    const el = player.mediaElement;
    const hlsAdapter = player.hlsAdapter;
    const dashAdapter = player.dashAdapter;
    return () => {
      hlsAdapter?.detach();
      dashAdapter?.detach();
      if (el) {
        el.pause();
        el.src = "";
      }
    };
  });
</script>

<div class="iiif-player-root {className}">
  {#if player.state.error}
    <div role="alert" class="error">
      <strong>Error:</strong>
      {player.state.error.message}
    </div>
  {/if}

  {#if children}
    {@render children({
      player: {
        state: player.state,
        actions: player.actions,
        annotations: player.annotations,
        chapters: player.chapters,
        activeChapterId: player.activeChapterId,
        transcriptStatus: player.transcriptStatus,
      },
    })}
  {/if}
</div>
