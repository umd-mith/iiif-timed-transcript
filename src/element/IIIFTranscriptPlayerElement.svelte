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
    const cb = errorCallback;
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
  $effect(() => {
    if (!annotationsValid) {
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
    if (!preprocessValid) {
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
    if (!errorCallbackValid) {
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
  :host {
    display: block;
  }
</style>
