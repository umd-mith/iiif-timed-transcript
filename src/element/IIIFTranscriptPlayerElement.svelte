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
  // Root's onPlayerInit fires.
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

  const safeAnnotations = $derived<Annotation[] | "auto">(
    annotationsValid ? annotations : "auto",
  );
  const safePreprocess = $derived(
    preprocessValid ? preprocessManifest : undefined,
  );

  // hls.js comes from the module-level default (set by the IIFE entry).
  const hlsDefault = getDefaultHlsConstructor();

  // exactOptionalPropertyTypes: only pass optional Root props when defined.
  const optionalRootProps = $derived({
    ...(initialTime != null ? { initialTime } : {}),
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
    // Keep the prop — and, through `reflect`, the canvas-index attribute —
    // in step with switches made inside the shadow root (CanvasNav), so a
    // later host write back to the old index is a real change for Root.
    canvasIndex = index;
    emit<CanvasChangeDetail>("canvaschange", { index, canvas });
  }
</script>

<div class="iiif-tp">
  {#if manifestUrl}
    <IIIFPlayer.Root
      {manifestUrl}
      {canvasIndex}
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
