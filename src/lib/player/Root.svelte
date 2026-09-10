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
  import { createActor } from "xstate";
  import { captionsMachine, captionsVerdict } from "./captionsMachine.js";
  import {
    getFirstCanvas,
    getPrimaryResource,
    hasAuthService,
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
  import { t, setLocale } from "../i18n/registry.svelte";

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
    preprocessManifest,
    locale,
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
    /**
     * Runs on the parsed manifest JSON before validation. The hook's output
     * is both validated and kept as `raw` (chapters are read from it). When
     * set, Root bypasses the module-level manifest cache entirely.
     */
    preprocessManifest?: (raw: unknown) => unknown;
    /**
     * Sets the term registry's locale for Svelte-API consumers (element
     * hosts resolve their own locale from the DOM instead — see 4.2).
     * Omitted means "whatever the registry already has" — English by
     * default. The registry is one shared module-level state, so the last
     * `locale` prop (or `setLocale` call) to run wins across every Root on
     * the page.
     */
    locale?: string;
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

  // The captions machine's actor reference: declared before `player` so the
  // onToggleCaptions/onNativeCaptionChange closures below can capture it —
  // they only run later (after a click or a native 'change' event), by
  // which point the actor has been assigned further down.
  let captionsActor: ReturnType<typeof createActor<typeof captionsMachine>>;

  // Create reactive state manager — onRetry delegates to loadManifest
  const player = new PlayerStateManager({
    onRetry: () => fetchManifestData(),
    onSwitchCanvas: (index: number) => performCanvasSwitch(index),
    onPlaybackError: (error: Error) =>
      reportError(error, { fatal: false, source: "playback" }),
    onToggleCaptions: () => captionsActor.send({ type: "USER_TOGGLE" }),
    onNativeCaptionChange: (mode) =>
      captionsActor.send({ type: "NATIVE_CHANGE", mode }),
    // Viewer reports the caption tracks it actually rendered (its `tracks` prop
    // when set, else the manifest tracks). Stored separately from
    // `player.tracks` — that stays the manifest-only transcript-selection
    // source — and used to drive the machine, so captions supplied via the
    // Viewer prop light the CC button. A redundant TRACKS_CHANGED for the
    // manifest case (also sent in loadCanvas) is a no-op in every machine state
    // except unavailable→browserDefault.
    onReportCaptionTracks: (tracks) => {
      player.captionTracks = tracks;
      captionsActor.send({
        type: "TRACKS_CHANGED",
        hasTracks: player.mediaType === "video" && tracks.length > 0,
      });
    },
  });

  // Provide context — the class instance satisfies PlayerContext
  setPlayerContext(player);

  // Captions policy (WCAG 1.2.2): a small state machine, the same pattern
  // syncMachine uses for media/transcript sync. loadCanvas below feeds it
  // CANVAS_SWITCH/TRACKS_CHANGED; the transcriptPopulated watcher feeds it
  // TRANSCRIPT_POPULATED; Viewer feeds it NATIVE_CHANGE via
  // onNativeCaptionChange above. player.captionsState mirrors its verdict.
  captionsActor = createActor(captionsMachine);
  captionsActor.subscribe((snapshot) => {
    player.captionsState = captionsVerdict(snapshot.value);
  });
  captionsActor.start();

  $effect(() => {
    if (locale != null) setLocale(locale);
  });

  // Apply initialTime (first canvas load only) and autoplay (every canvas load)
  let initialTimeApplied = false;
  let initFired = false;

  // Latches the one-time reconcile of the canvasIndex prop in
  // fetchManifestData, which runs on mount but must not run again on retry.
  let initialIndexApplied = false;

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

  // The last fully-resolved canvas — assigned only once loadCanvas has got
  // past every check that can throw, so it always agrees with player.tracks.
  // The annotations-prop effect re-derives "auto" against it after a mode
  // flip; a canvas that failed to load never becomes it.
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
      // Drop any VTT fetch still in flight from before the flip — in *both*
      // directions. Flipping to an array must invalidate it too, or the fetch
      // lands afterwards and overwrites the consumer's annotations. Only the
      // transcript counter moves — bumping loadGeneration here would cancel
      // an in-flight resolveHlsAdapter/resolveDashAdapter import started by
      // the current loadCanvas.
      transcriptGeneration += 1;
      // A mode flip is a transcript-ownership change, so it gets the same
      // reset as loadCanvas: whatever the panel showed under the old mode no
      // longer says anything about what it will show under the new one. The
      // clear converges the same way — Transcript re-publishes `true` on the
      // next flush while the panel is still populated — and its point is that
      // a flip whose re-derive ends up EMPTY does not leave a stale `true`
      // behind. Viewer's once-per-load latch is keyed on (canvasIndex,
      // mediaUrl) and deliberately does not re-arm on a flip: the one-time
      // write has already happened for this canvas load.
      player.transcriptPopulated = false;
      if (Array.isArray(mode)) {
        player.annotations = mode;
        player.transcriptStatus = "idle";
      } else if (mode === "auto" && currentCanvas) {
        deriveAutoAnnotations(currentCanvas);
      } else if (mode === "auto") {
        // No resolved canvas (the last load failed), so there is nothing to
        // derive against — but "auto" still means Root owns `annotations`.
        // Leaving the consumer's array in place would keep it rendering under
        // Root's ownership next to the error banner. The next successful
        // loadCanvas derives.
        player.annotations = [];
        player.transcriptStatus = "idle";
      }
    });
  });

  // React to prop-driven canvas changes after manifest is loaded.
  // This effect drives external side effects (media teardown/setup), not state derivation.
  //
  // Only the prop is tracked. `manifestData` is read untracked because retry
  // reassigns it: tracking it would re-run this effect on every retry and
  // switch back to the prop's index, discarding a canvas the user had
  // selected internally. A prop change that arrives before the manifest is
  // loaded is not lost — fetchManifestData reconciles the prop into state
  // before the first canvas load.
  $effect(() => {
    const propIndex = canvasIndex;
    untrack(() => {
      if (manifestData && propIndex !== player.canvasIndex) {
        performCanvasSwitch(propIndex);
      }
    });
  });

  // Feed the captions machine when the transcript panel populates — the
  // same signal the old Viewer-owned latch used to key off, now routed
  // through the machine so a user's toggle is never rewritten by a later
  // populate (TRANSCRIPT_POPULATED is unhandled in userControlled).
  $effect(() => {
    if (player.transcriptPopulated) {
      captionsActor.send({ type: "TRANSCRIPT_POPULATED" });
    }
  });

  // One reset for every transient field PlayerState carries — see the
  // reset-or-survives table on PlayerState (context.ts). Called at the start
  // of both performCanvasSwitch and loadCanvas so a canvas switch (which
  // calls both) and a first load (which calls only loadCanvas) each end up
  // with a fully-reset transient state; calling it twice in the switch path
  // is redundant, not wrong — every field it touches is idempotent.
  function resetTransientPlaybackState() {
    player.state.isPlaying = false;
    player.state.currentTime = 0;
    player.state.duration = 0;
    player.state.isReady = false;
    player.state.error = null;
    player.state.hasEnded = false;
    player.state.isSeeking = false;

    player.tracks = [];
    player.chapters = [];
    player.transcriptPopulated = false;
    if (annotations === "auto") {
      player.annotations = [];
      player.transcriptStatus = "idle";
    }
  }

  function performCanvasSwitch(index: number) {
    if (!manifestData) return;
    // Integer check first: the range comparisons below are all false for NaN
    // (`NaN < 0`, `NaN >= len`) and so is `NaN === player.canvasIndex`, so a
    // non-integer would fall through every guard, tear down the media and
    // set player.canvasIndex to NaN — after which loadCanvas silently falls
    // back to canvas 0 and onCanvasChange never fires (canvases[NaN] is
    // undefined). Fractional indices are rejected for the same reason.
    if (!Number.isInteger(index)) return;
    if (index < 0 || index >= player.canvases.length) return;
    if (index === player.canvasIndex) return;

    // Pause and detach current media
    player.mediaElement?.pause();
    player.hlsAdapter?.detach();
    player.dashAdapter?.detach();
    player.hlsAdapter = null;
    player.dashAdapter = null;

    // Reset player state for new canvas
    resetTransientPlaybackState();

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

  // Fetch and validate a manifest. `preprocessManifest`, when set, runs on
  // the parsed JSON first; its output is what the validator sees AND what is
  // kept as `raw` (one document, not two — chapters read `raw.structures`).
  async function fetchAndValidateManifest(
    url: string,
  ): Promise<{ validated: ManifestData; raw: unknown }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch manifest: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();
    const manifest = preprocessManifest ? preprocessManifest(json) : json;
    const validationResult = ManifestSchema.safeParse(manifest);
    if (!validationResult.success) {
      throw new Error(
        `Invalid IIIF manifest: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    return { validated: validationResult.data, raw: manifest };
  }

  // Fetch manifest — called on mount and on retry.
  // Cache rule: with `preprocessManifest` set, Root does not touch the
  // module-level cache at all — no get, no set, and no delete on error (a
  // bypassing instance's failure must not evict a plain instance's good
  // entry for the same URL).
  async function fetchManifestData() {
    const usesCache = !preprocessManifest;
    try {
      let manifestPromise = usesCache
        ? manifestCache.get(manifestUrl)
        : undefined;
      if (!manifestPromise) {
        manifestPromise = fetchAndValidateManifest(manifestUrl);
        if (usesCache) manifestCache.set(manifestUrl, manifestPromise);
      }

      const data = await manifestPromise;
      if (destroyed) return;
      manifestData = data;
      player.canvases = buildCanvasInfoList(data.validated);

      // Reconcile the prop into state BEFORE the first load, and only then.
      // On mount `player.canvasIndex` still holds its $state(0) default;
      // without this, mounting with canvasIndex > 0 would load canvas 0 and
      // only then have the prop-watch effect switch away — a discarded load,
      // including a wasted tier-2 VTT fetch under annotations="auto". The
      // range check matters because loadCanvas (unlike performCanvasSwitch)
      // does not guard its index: an out-of-range prop keeps the canvas-0
      // fallback.
      //
      // This function is also the retry path, where the reconcile must NOT
      // run again: by then the canvas may have been selected internally
      // (CanvasNav / actions.switchCanvas) while the prop stayed put, and
      // re-applying the prop would overwrite that selection behind
      // performCanvasSwitch's back — no onCanvasChange, no media teardown.
      // The latch flips either way, so an out-of-range prop is not retried.
      if (!initialIndexApplied) {
        initialIndexApplied = true;
        if (canvasIndex >= 0 && canvasIndex < player.canvases.length) {
          player.canvasIndex = canvasIndex;
        }
      }

      loadCanvas(player.canvasIndex);
    } catch (error) {
      // The cache is module-level: evict unconditionally so a rejected
      // promise is never served to the next instance — then bail if we are
      // already torn down.
      if (usesCache) manifestCache.delete(manifestUrl);
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
    // Reactive load counter: unlike loadGeneration (an internal let), this is
    // on context so Viewer re-reports its effective caption tracks after the
    // machine reset below — including on retry, which reloads the same canvas.
    player.loadNonce += 1;

    // Reset before anything below can throw. Without this, a canvas switch
    // that lands on a non-AV canvas (or otherwise throws before reaching the
    // tier-1/2 block) would leave the *previous* canvas's transcript
    // annotations and "ready" status in place — the panel would render
    // segments for media that never loaded. Tracks are canvas-scoped for the
    // same reason: a failed canvas must not inherit the previous canvas's
    // VTT, which a later "auto" re-derive would then fetch. Chapters are
    // canvas-scoped too — a failed switch must not leave the previous
    // canvas's ranges in the navigation.
    //
    // transcriptPopulated belongs in the same reset: Viewer's effect runs
    // before Transcript's in tree order, so without this it would see the
    // *previous* canvas's `true`, hide the new canvas's tracks, and spend its
    // once-per-load latch before the new panel ever populates — leaving a
    // canvas whose transcript then fails with neither captions nor
    // transcript. Transcript re-publishes it truthfully on the next flush.
    //
    // Also resets isPlaying/currentTime/duration/isReady/error/hasEnded/
    // isSeeking — a no-op on the initial load (already at their $state
    // defaults) and idempotent on a canvas-switch call (performCanvasSwitch
    // already reset them just above, before calling loadCanvas).
    resetTransientPlaybackState();
    // Every load is a canvas switch (including the first): reset the
    // machine's tracks-known state to false up front so a canvas that
    // throws below (non-AV, no primary resource) still lands on
    // "unavailable" rather than carrying the previous canvas's verdict.
    captionsActor.send({ type: "CANVAS_SWITCH" });
    captionsActor.send({ type: "TRACKS_CHANGED", hasTracks: false });

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

      // Detected here, not left for the <video>/<audio> element to fail on:
      // by the time playback would error, the wrapper has already reported
      // a "media" fatal error and there is no way to tell an auth lock
      // apart from a broken URL. Returning here (not throwing) means this
      // canvas never reaches `player.mediaUrl = …`, so the generic media
      // failure this would otherwise cause never fires — one error, not two.
      if (hasAuthService(primaryResource)) {
        currentCanvas = null;
        const err = new Error(
          "This resource requires authentication and cannot be played.",
        );
        player.state.error = err;
        player.state.isReady = false;
        reportError(err, { fatal: true, source: "auth" });
        return;
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
      if (player.mediaType === "video" && player.tracks.length > 0) {
        captionsActor.send({ type: "TRACKS_CHANGED", hasTracks: true });
      }

      // Only now is the canvas genuinely resolved: media type, primary
      // resource and tracks all agree with it. Assigning earlier would let a
      // canvas that throws above pair its identity with the previous canvas's
      // tracks in a later "auto" re-derive.
      currentCanvas = canvas;

      // annotations="auto": tier 1 — embedded TextualBody (synchronous);
      // tier 2 — the canvas's external VTT supplementing track (async,
      // see resolveVTTTranscript). A canvas with neither yields [] / "ready".
      if (annotations === "auto") {
        deriveAutoAnnotations(canvas);
      }
    } catch (error) {
      // No canvas is loaded any more, so nothing may be re-derived against
      // one: leaving the last good canvas here would let a later flip back to
      // "auto" put its tier-1 transcript on screen next to the error banner.
      currentCanvas = null;
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
    // Blank-text annotations (a TextualBody with `value: ""`) do not count as
    // a tier-1 hit: they would put empty segments on screen *and* suppress the
    // canvas's real VTT. Same rule tier 2 applies to parsed cues.
    const embedded = buildTranscriptAnnotations(canvas, [
      "supplementing",
      "commenting",
      "tagging",
    ]).annotations.filter((a) => a.text.trim().length > 0);
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
      resolveVTTTranscript(track.src, track.srclang);
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
  async function resolveVTTTranscript(url: string, language?: string) {
    const generation = transcriptGeneration;
    try {
      const result = await loadVTTTranscript(url, language);
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
      // A replay after the media ended: clear the latch so a subsequent
      // `ended` can fire (and the pause-suppression rule below can work)
      // again for this second run-through.
      player.state.hasEnded = false;
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
    const handleEnded = () => {
      player.state.hasEnded = true;
    };
    const handleSeeking = () => {
      player.state.isSeeking = true;
    };
    const handleSeeked = () => {
      player.state.isSeeking = false;
    };

    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("durationchange", handleDurationChange);
    el.addEventListener("ratechange", handleRateChange);
    el.addEventListener("waiting", handleWaiting);
    el.addEventListener("canplay", handleCanPlay);
    el.addEventListener("ended", handleEnded);
    el.addEventListener("seeking", handleSeeking);
    el.addEventListener("seeked", handleSeeked);

    return () => {
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("durationchange", handleDurationChange);
      el.removeEventListener("ratechange", handleRateChange);
      el.removeEventListener("waiting", handleWaiting);
      el.removeEventListener("canplay", handleCanPlay);
      el.removeEventListener("ended", handleEnded);
      el.removeEventListener("seeking", handleSeeking);
      el.removeEventListener("seeked", handleSeeked);
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
      <strong>{t("player.errorLabel")}</strong>
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
