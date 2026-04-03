<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { setPlayerContext, type CanvasInfo, type PlayerRef } from "./context";
  import { PlayerStateManager } from "./PlayerState.svelte";
  import {
    getFirstCanvas,
    getPrimaryResource,
    isAudioCanvas,
    isVideoCanvas,
    getSupplementaryVTTTracks,
    buildCanvasInfoList,
    filterChaptersForCanvas,
  } from "../iiif/helpers";
  import { ManifestSchema, type ManifestData } from "../iiif/validators";
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
    class: className = "",
    children,
  }: {
    manifestUrl: string;
    canvasIndex?: number;
    annotations?: Annotation[];
    initialTime?: number;
    autoplay?: boolean;
    hlsConstructor?: HlsConstructor;
    dashConstructor?: DashConstructor;
    onCanvasChange?: (index: number, canvas: CanvasInfo) => void;
    /** Called once after manifest loads and first canvas is parsed. `state.isReady` is false at this point. */
    onPlayerInit?: (player: PlayerRef) => void;
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
  });

  // Provide context — the class instance satisfies PlayerContext
  setPlayerContext(player);

  // Apply initialTime (first canvas load only) and autoplay (every canvas load)
  let initialTimeApplied = false;
  let initFired = false;

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

  // Sync annotations prop into player context.
  // This bridges the prop→class-state boundary (same pattern as canvasIndex effect below,
  // but without side effects — just a reactive assignment).
  $effect(() => {
    player.annotations = annotations;
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

    // Reset player state for new canvas
    player.state.isPlaying = false;
    player.state.currentTime = 0;
    player.state.duration = 0;
    player.state.isReady = false;
    player.state.error = null;

    // Clear mediaUrl to trigger Viewer unmount
    player.mediaUrl = "";

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

      manifestData = await manifestPromise;
      player.canvases = buildCanvasInfoList(manifestData.validated);

      loadCanvas(player.canvasIndex);
    } catch (error) {
      manifestCache.delete(manifestUrl);
      player.state.error =
        error instanceof Error ? error : new Error(String(error));
      player.state.isReady = false;
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

    try {
      const canvas =
        manifestData.validated.items?.[index] ??
        getFirstCanvas(manifestData.validated);

      if (!canvas) {
        throw new Error("No canvas found in IIIF manifest");
      }

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
    } catch (error) {
      player.state.error =
        error instanceof Error ? error : new Error(String(error));
      player.state.isReady = false;
    }
  }

  function isHlsConstructorLike(obj: unknown): obj is HlsConstructor {
    return (
      typeof obj === "function" &&
      "isSupported" in obj &&
      typeof (obj as Record<string, unknown>).isSupported === "function"
    );
  }

  function isDashConstructorLike(obj: unknown): obj is DashConstructor {
    return (
      obj !== null &&
      typeof obj === "object" &&
      "create" in obj &&
      typeof (obj as Record<string, unknown>).create === "function"
    );
  }

  async function resolveHlsAdapter() {
    const Hls =
      hlsConstructor ??
      (await import("hls.js")
        .then((m) => {
          const candidate = m.default;
          if (!isHlsConstructorLike(candidate)) {
            throw new Error(
              "hls.js module does not export expected HLS constructor",
            );
          }
          return candidate;
        })
        .catch(() => null));
    if (Hls && player.mediaStrategy === "hls-js") {
      player.hlsAdapter = createHlsAdapter(Hls);
    } else if (!Hls && player.mediaStrategy === "hls-js") {
      player.state.error = new Error(
        "HLS stream detected but hls.js is not installed. " +
          "Install it with: npm install hls.js",
      );
      player.state.isReady = false;
    }
  }

  async function resolveDashAdapter() {
    const Dash =
      dashConstructor ??
      (await import("dashjs")
        .then((m) => {
          const mod = ("default" in m ? m.default : m) ?? m;
          if (
            !mod ||
            typeof mod !== "object" ||
            !("MediaPlayer" in mod) ||
            typeof (mod as Record<string, unknown>).MediaPlayer !== "function"
          ) {
            throw new Error(
              "dashjs module does not export expected MediaPlayer factory",
            );
          }
          const factory = (mod as { MediaPlayer: () => unknown }).MediaPlayer();
          if (!isDashConstructorLike(factory)) {
            throw new Error(
              "dashjs MediaPlayer() did not return expected constructor",
            );
          }
          return factory;
        })
        .catch(() => null));
    if (Dash && player.mediaStrategy === "dash-js") {
      player.dashAdapter = createDashAdapter(Dash);
    } else if (!Dash && player.mediaStrategy === "dash-js") {
      player.state.error = new Error(
        "DASH stream detected but dashjs is not installed. " +
          "Install it with: npm install dashjs",
      );
      player.state.isReady = false;
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
      },
    })}
  {/if}
</div>
