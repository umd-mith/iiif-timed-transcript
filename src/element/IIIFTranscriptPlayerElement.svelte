<svelte:options
  customElement={{
    shadow: "open",
    props: {
      manifestUrl: { attribute: "manifest-url", type: "String" },
      canvasIndex: { attribute: "canvas-index", type: "Number", reflect: true },
      initialTime: { attribute: "initial-time", type: "Number" },
      autoplay: { attribute: "autoplay", type: "Boolean" },
      annotations: { attribute: "annotations" },
      preprocessManifest: { attribute: "preprocessmanifest" },
      errorCallback: { attribute: "errorcallback" },
    },
  }}
/>

<script module lang="ts">
  // Hosts on which `initial-time` has already been applied. Svelte destroys
  // the inner component a microtask after `disconnectedCallback` and rebuilds
  // it on the next `connectedCallback` (custom-element.js:93-151, :201-211),
  // so a tab/accordion host that re-parents the element gets a brand-new Root
  // whose own `initialTimeApplied` latch is fresh — and playback would rewind
  // to `initial-time` behind the user's back. Keyed on the host element, so
  // the record survives the rebuild and dies with the node.
  const initialTimeAppliedHosts = new WeakSet<HTMLElement>();
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { IIIFPlayer } from "../lib/index.js";
  import type {
    Annotation,
    CanvasInfo,
    PlayerErrorInfo,
    PlayerRef,
  } from "../lib/index.js";
  import { getDefaultHlsConstructor } from "./mediaDefaults.js";
  import type {
    CanvasChangeDetail,
    ErrorCallback,
    PlayerErrorDetail,
    PlayerRefAvailableDetail,
  } from "./events.js";

  let {
    manifestUrl = "",
    canvasIndex = 0,
    initialTime,
    autoplay = false,
    annotations = "auto",
    preprocessManifest,
    errorCallback,
  }: {
    manifestUrl?: string;
    canvasIndex?: number;
    initialTime?: number | undefined;
    autoplay?: boolean;
    annotations?: Annotation[] | "auto";
    preprocessManifest?: ((raw: unknown) => unknown) | undefined;
    errorCallback?: ErrorCallback | undefined;
  } = $props();

  // Exposed as a read-only getter on the element (Svelte turns instance
  // exports into prototype accessors on the generated class). Nullish until
  // Root's onPlayerInit fires — and it stays nullish only when the fatal
  // error is a manifest/first-canvas failure; a fatal *media* error is
  // detected by the media element, which exists only after onPlayerInit, so
  // by then this is set and stays set.
  let playerRefValue: PlayerRef | null = $state(null);
  export { playerRefValue as playerRef };

  // Events are dispatched on the host, outside the reactive cycle.
  function emit<T>(type: string, detail: T) {
    const host = $host();
    queueMicrotask(() => {
      host.dispatchEvent(
        new CustomEvent<T>(type, { detail, bubbles: true, composed: true }),
      );
    });
  }

  function report(
    error: Error,
    info: { fatal: boolean; source: PlayerErrorDetail["source"] },
  ) {
    // Read untracked: report() runs inside host-validation $effects (below),
    // and a tracked read of errorCallback here would make those effects
    // depend on it — so a later `el.errorCallback = fn` (the documented
    // <script src> pattern, set after customElements.whenDefined) would
    // re-run a still-failing validator and re-emit the same host error.
    const cb = untrack(() => errorCallback);
    if (typeof cb === "function") {
      try {
        cb(error, info);
      } catch (callbackError) {
        console.error(
          "[iiif-transcript-player] errorCallback threw:",
          callbackError,
        );
      }
    }
    emit<PlayerErrorDetail>("playererror", {
      error,
      fatal: info.fatal,
      source: info.source,
    });
  }

  // Properties-only inputs are type-checked at the boundary. Every declared
  // prop is also an observed attribute, so `annotations="…"` arrives as a
  // string; a misuse is reported as a non-fatal "host" error and the safe
  // default goes to Root instead. These effects run in the wrapper's first
  // flush, before Root's manifest fetch can settle, so a host error always
  // precedes playerrefavailable.
  const annotationsValid = $derived(
    annotations === "auto" || Array.isArray(annotations),
  );
  const preprocessValid = $derived(
    preprocessManifest === undefined ||
      typeof preprocessManifest === "function",
  );
  const errorCallbackValid = $derived(
    errorCallback === undefined || typeof errorCallback === "function",
  );
  // Belt-and-braces alongside the untracked read in report(): each validator
  // reports at most once ever, so a stray extra effect run (from an
  // unrelated dependency, now or introduced later) cannot resurface a host
  // error that was already delivered.
  let annotationsReported = false;
  let preprocessReported = false;
  let errorCallbackReported = false;
  $effect(() => {
    if (!annotationsValid && !annotationsReported) {
      annotationsReported = true;
      report(
        new Error(
          '`annotations` must be an Annotation[] or "auto"; ignoring it',
        ),
        {
          fatal: false,
          source: "host",
        },
      );
    }
  });
  $effect(() => {
    if (!preprocessValid && !preprocessReported) {
      preprocessReported = true;
      report(
        new Error("`preprocessManifest` must be a function; ignoring it"),
        {
          fatal: false,
          source: "host",
        },
      );
    }
  });
  $effect(() => {
    if (!errorCallbackValid && !errorCallbackReported) {
      errorCallbackReported = true;
      report(new Error("`errorCallback` must be a function; ignoring it"), {
        fatal: false,
        source: "host",
      });
    }
  });

  // `canvas-index` is coerced with `+value` (custom-element.js:258-259), so
  // `canvas-index="abc"` arrives as NaN, and `removeAttribute("canvas-index")`
  // arrives as null. The two are not the same kind of input:
  //
  //  - NaN (or a negative or fractional number) is misuse. It would slip past
  //    every ordering guard downstream, so it is replaced with 0, reported as
  //    a host error, and the reflected attribute is repaired (reflection
  //    writes `+value`, so otherwise the attribute is left reading "NaN").
  //  - A *removed* attribute is HTML for "back to the default", and it is
  //    what a framework binding does when its bound value goes undefined.
  //    That is not misuse: it silently means 0, with no report. Nothing
  //    re-adds the attribute for a player already on canvas 0 (there is no
  //    switch to reflect), so a host that removes it repeatedly has nothing
  //    to loop against. From another canvas the switch back to 0 does reflect
  //    "0" onto the attribute — the documented behaviour of every switch.
  //
  // Reported per distinct bad value, so a host that keeps writing garbage
  // gets one error per value rather than one per effect run. Plain arrays,
  // not Sets: nothing here is reactive, and `includes` dedupes on
  // SameValueZero, so NaN matches itself. The two reporters keep separate
  // lists so an index that is first seen as out-of-range and later as
  // non-integer (or the reverse) still gets its own diagnostic.
  const canvasIndexMissing = $derived(canvasIndex == null);
  const canvasIndexValid = $derived(
    canvasIndexMissing || (Number.isInteger(canvasIndex) && canvasIndex >= 0),
  );
  const safeCanvasIndex = $derived(
    canvasIndexValid && !canvasIndexMissing ? canvasIndex : 0,
  );
  const reportedBadCanvasIndexes: unknown[] = [];
  const reportedOutOfRangeIndexes: unknown[] = [];
  // `$effect.pre`, not `$effect`: a bad value is replaced with 0, which for a
  // player sitting on another canvas makes Root switch back — and that switch
  // rewrites the attribute (handleCanvasChange), which writes the prop again.
  // Root's effects run before user effects in the same flush, so a plain
  // `$effect` would only ever see the repaired value and report nothing.
  $effect.pre(() => {
    const value = canvasIndex;
    if (canvasIndexValid) return;
    untrack(() => {
      // Repair the reflected attribute for every bad value, not just the
      // first: the attribute is a public channel and must never be left
      // holding a value the player is not on. Deferred a microtask, like
      // emit(): during the wrapper's first flush the host's `$$c` is not
      // assigned yet, so attributeChangedCallback's `$set` would be dropped
      // and the reflect effect would then write NaN back over the repair.
      const host = $host();
      const repaired = String(safeCanvasIndex);
      queueMicrotask(() => host.setAttribute("canvas-index", repaired));
      if (reportedBadCanvasIndexes.includes(value)) return;
      reportedBadCanvasIndexes.push(value);
      report(
        new Error("`canvas-index` must be a non-negative integer; ignoring it"),
        { fatal: false, source: "host" },
      );
    });
  });
  // An in-range check needs the canvas count, which only exists once the
  // manifest has parsed. Root already ignores an out-of-range index on both
  // paths — the first-load reconcile range-checks it and performCanvasSwitch
  // returns early — so the player is never wrong; without this the host just
  // got no diagnostic at all.
  $effect(() => {
    const value = canvasIndex;
    const count = playerRefValue?.canvasCount ?? 0;
    if (!canvasIndexValid || canvasIndexMissing || count === 0 || value < count)
      return;
    untrack(() => {
      if (reportedOutOfRangeIndexes.includes(value)) return;
      reportedOutOfRangeIndexes.push(value);
      report(
        new Error(
          `\`canvas-index\` ${value} is out of range for ${count} canvases; ignoring it`,
        ),
        { fatal: false, source: "host" },
      );
    });
  });

  // A connected element with no `manifest-url` renders an empty shadow root
  // and says nothing. Deferred past the current task so the common host
  // pattern — append, then set the attribute — is not reported; only an
  // element that is still bare on the next task is.
  let manifestUrlReported = false;
  $effect(() => {
    if (manifestUrl) return;
    // No `manifest-url` means no Root: clearing it unmounts the player, and a
    // `playerRef` still pointing at the destroyed component would hand the
    // host live-looking `actions` that do nothing. (Safe to write here — this
    // effect does not read `playerRefValue`.)
    playerRefValue = null;
    const timer = setTimeout(() => {
      if (manifestUrlReported) return;
      manifestUrlReported = true;
      report(new Error("`manifest-url` is required; nothing will render"), {
        fatal: false,
        source: "host",
      });
    }, 0);
    return () => clearTimeout(timer);
  });

  const safeAnnotations = $derived<Annotation[] | "auto">(
    annotationsValid ? annotations : "auto",
  );
  const safePreprocess = $derived(
    preprocessValid ? preprocessManifest : undefined,
  );

  // `initial-time` is coerced with `+value` too, so `initial-time="abc"`
  // arrives as NaN. Root's `seekTo` would drop it on its own `isFinite`
  // guard as a bare console.warn — but by then the once-per-host latch below
  // has been burned by a value that never seeked, so a later valid
  // `initial-time` would be ignored. Validate here instead. A removed
  // attribute (null) is "unset", like elsewhere, not misuse.
  const initialTimeValid = $derived(
    initialTime == null || (Number.isFinite(initialTime) && initialTime >= 0),
  );
  let initialTimeReported = false;
  $effect(() => {
    if (initialTimeValid || initialTimeReported) return;
    initialTimeReported = true;
    report(
      new Error(
        "`initial-time` must be a non-negative number of seconds; ignoring it",
      ),
      { fatal: false, source: "host" },
    );
  });

  // `initial-time` applies once per host, not once per inner component — see
  // initialTimeAppliedHosts above. The flag is read once, at setup, before the
  // effect below records this connection. The latch is recorded only once a
  // valid `initial-time` was really handed to a Root that initialized
  // (`playerRefValue` set means onPlayerInit fired, so the manifest loaded) —
  // an invalid value, a failed manifest fetch, or no `manifest-url` (so no
  // Root mounted at all) must not burn it. Known gap: the manifest can load
  // and the media still fail before the seek runs (Root seeks only once
  // `state.isReady`), which burns the latch without a seek; closing that
  // window would need a new
  // "initial time applied" signal from Root.
  const initialTimeAlreadyApplied = initialTimeAppliedHosts.has($host());
  $effect(() => {
    if (playerRefValue && initialTime != null && initialTimeValid) {
      initialTimeAppliedHosts.add($host());
    }
  });

  // hls.js comes from the module-level default (set by the IIFE entry).
  const hlsDefault = getDefaultHlsConstructor();

  // exactOptionalPropertyTypes: only pass optional Root props when defined.
  const optionalRootProps = $derived({
    ...(initialTime != null && initialTimeValid && !initialTimeAlreadyApplied
      ? { initialTime }
      : {}),
    ...(safePreprocess ? { preprocessManifest: safePreprocess } : {}),
    ...(hlsDefault ? { hlsConstructor: hlsDefault } : {}),
  });

  function handlePlayerInit(player: PlayerRef) {
    playerRefValue = player;
    emit<PlayerRefAvailableDetail>("playerrefavailable", { playerRef: player });
  }

  function handleError(error: Error, info: PlayerErrorInfo) {
    report(error, info);
  }

  function handleCanvasChange(index: number, canvas: CanvasInfo) {
    // Write the ATTRIBUTE, not the prop, to keep the element in step with
    // switches made inside the shadow root (CanvasNav).
    //
    // A prop write (`canvasIndex = index`) is a *local override* on the
    // prop's derived (svelte/src/internal/client/reactivity/props.js:403-416)
    // and leaves the props source untouched; `reflect` then writes the
    // attribute back with `$$r` set, which attributeChangedCallback ignores
    // (custom-element.js:154-174, :195). The source would stay at the host's
    // original index, so the host writing that same index back again would
    // be an equality no-op and be silently dropped.
    //
    // An explicit setAttribute runs attributeChangedCallback without the
    // `$$r` guard, so the props source is refreshed too: attribute, source
    // and prop all hold `index`, and either channel keeps working
    // afterwards. It does not echo — the resulting prop change is equal to
    // the index Root just switched to, and performCanvasSwitch returns
    // early on `index === player.canvasIndex`.
    $host().setAttribute("canvas-index", String(index));
    emit<CanvasChangeDetail>("canvaschange", { index, canvas });
  }
</script>

<div class="iiif-tp">
  {#if manifestUrl}
    <IIIFPlayer.Root
      {manifestUrl}
      canvasIndex={safeCanvasIndex}
      {autoplay}
      annotations={safeAnnotations}
      {...optionalRootProps}
      onError={handleError}
      onPlayerInit={handlePlayerInit}
      onCanvasChange={handleCanvasChange}
    >
      {#snippet children({ player })}
        <IIIFPlayer.Viewer />
        <IIIFPlayer.Controls>
          <IIIFPlayer.PlayButton />
          <IIIFPlayer.Progress />
          <IIIFPlayer.Skip seconds={-10} />
          <IIIFPlayer.Skip seconds={30} />
          <IIIFPlayer.Speed />
          <IIIFPlayer.Time />
        </IIIFPlayer.Controls>
        {#if (playerRefValue?.canvasCount ?? 0) > 1}
          <IIIFPlayer.CanvasNav />
        {/if}
        {#if player.annotations.length > 0 || player.transcriptStatus === "loading"}
          <IIIFPlayer.Transcript>
            <IIIFPlayer.TranscriptSearch />
            <IIIFPlayer.TranscriptSegments />
          </IIIFPlayer.Transcript>
        {/if}
      {/snippet}
    </IIIFPlayer.Root>
  {/if}
</div>

<style>
  /*
    Theming contract (see the spec, "Theming contract"):
    - every rule that targets nested-component DOM is `.iiif-tp :global(hook)`,
      which compiles to `.iiif-tp.svelte-<hash> hook` (≥ (0,3,0) for an
      attribute hook) and therefore beats the nested baseline `all: unset`
      rules ((0,1,1)) without !important;
    - focus indicators are NOT restyled (the nested `:focus:not(:focus-visible)`
      rules are (0,3,1) and win by design);
    - custom properties are the public theming API; names are stable;
      `--iiif-player-accent-fg` and `--iiif-player-segment-fg` exist
      alongside their background counterparts so a host that remaps only the
      backgrounds (e.g. for dark mode) does not lose text contrast — they
      default to today's hard-coded colors.
  */
  :host {
    display: block;
  }

  .iiif-tp {
    font-family: var(--iiif-player-font-family, system-ui, sans-serif);
    background: var(--iiif-player-bg, #ffffff);
    color: var(--iiif-player-fg, #1a1a1a);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .iiif-tp :global(video),
  .iiif-tp :global(audio) {
    width: 100%;
    display: block;
  }

  .iiif-tp :global([data-audio-controls]) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--iiif-player-control-bg, #f3f4f6);
    color: var(--iiif-player-control-fg, inherit);
    border: 1px solid var(--iiif-player-border, #e5e7eb);
    border-radius: 4px;
  }

  .iiif-tp :global([data-audio-button]) {
    background: var(--iiif-player-accent, #1d4ed8);
    color: var(--iiif-player-accent-fg, #ffffff);
    border: 0;
    border-radius: 4px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
    font: inherit;
  }

  .iiif-tp :global([data-audio-control]) {
    font: inherit;
    color: inherit;
  }

  /* The UA's default <select> background is opaque and theme-independent,
     so `color: inherit` above is not enough on its own — without an
     explicit background a dark --iiif-player-control-fg reads as
     light-on-light against it (or the reverse). */
  .iiif-tp :global(select[data-audio-control]) {
    background: var(--iiif-player-control-bg, #f3f4f6);
  }

  .iiif-tp :global(input[type="range"]) {
    flex: 1;
    accent-color: var(--iiif-player-accent, #1d4ed8);
  }

  .iiif-tp :global(nav.canvas-nav) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .iiif-tp :global(nav.canvas-nav button) {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--iiif-player-border, #e5e7eb);
    border-radius: 4px;
    width: auto;
  }

  .iiif-tp :global(nav.canvas-nav button[data-state="active"]) {
    background: var(--iiif-player-accent, #1d4ed8);
    color: var(--iiif-player-accent-fg, #ffffff);
  }

  .iiif-tp :global(.transcript-panel) {
    background: var(--iiif-player-transcript-bg, transparent);
    border: 1px solid var(--iiif-player-border, #e5e7eb);
    border-radius: 4px;
    padding: 0.5rem;
    max-height: 24rem;
  }

  .iiif-tp :global(input[type="search"]) {
    width: 100%;
    box-sizing: border-box;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--iiif-player-border, #e5e7eb);
    border-radius: 4px;
    font: inherit;
  }

  .iiif-tp :global([data-annotation-id]) {
    padding: 0.375rem 0.5rem;
    border-radius: 4px;
  }

  .iiif-tp :global([data-annotation-id][data-state="active"]) {
    background: var(--iiif-player-segment-active-bg, #fef3c7);
    color: var(--iiif-player-segment-fg, #1a1a1a);
  }

  .iiif-tp :global([data-annotation-id][data-highlighted="true"]),
  .iiif-tp :global([data-annotation-id][data-current-match="true"]) {
    background: var(--iiif-player-segment-highlight-bg, #dbeafe);
    color: var(--iiif-player-segment-fg, #1a1a1a);
  }
</style>
