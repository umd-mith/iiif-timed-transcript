<svelte:options
  customElement={{
    shadow: "open",
    props: {
      manifestUrl: { attribute: "manifest-url", type: "String" },
      canvasIndex: { attribute: "canvas-index", type: "Number", reflect: true },
      initialTime: { attribute: "initial-time", type: "Number" },
      autoplay: { attribute: "autoplay", type: "Boolean" },
      label: { attribute: "label", type: "String" },
      crossorigin: { attribute: "crossorigin", type: "String" },
      annotations: { attribute: "annotations" },
      preprocessManifest: { attribute: "preprocessmanifest" },
      errorCallback: { attribute: "errorcallback" },
    },
    extend,
  }}
/>

<script module lang="ts">
  import { setLocale } from "../lib/index.js";
  import { hoistShadowStyles, warnIfNoStylesFound } from "./cssHoist.js";

  // Hosts on which `initial-time` has already been applied. Svelte destroys
  // the inner component a microtask after `disconnectedCallback` and rebuilds
  // it on the next `connectedCallback` (custom-element.js:93-151, :201-211),
  // so a tab/accordion host that re-parents the element gets a brand-new Root
  // whose own `initialTimeApplied` latch is fresh — and playback would rewind
  // to `initial-time` behind the user's back. Keyed on the host element, so
  // the record survives the rebuild and dies with the node.
  const initialTimeAppliedHosts = new WeakSet<HTMLElement>();

  /**
   * Minimal typing for the private fields this dance reaches into directly
   * on the generated custom-element instance
   * (svelte/internal/client/dom/elements/custom-element.js): `$$p_d` is the
   * props-definition map, assigned in the base class's own constructor
   * (custom-element.js:300) before any subclass `connectedCallback` runs, so
   * `Object.keys(this.$$p_d)` is always exactly the `customElement.props`
   * map above — it cannot drift from a hand-duplicated key list.
   * `connectedCallback` is Svelte's generated async upgrade routine
   * (custom-element.js:93-184).
   */
  interface SvelteCustomElementInstance extends HTMLElement {
    $$p_d: Record<string, unknown>;
    connectedCallback(): Promise<void>;
    disconnectedCallback(): void;
  }
  interface SvelteCustomElementConstructor {
    new (...params: never[]): SvelteCustomElementInstance;
  }

  /**
   * The standard custom-element upgrade dance (WHATWG custom-elements spec,
   * "upgrades"): a property set on the element before it upgrades — before
   * `define()` runs, or before this element's own subclass is defined — must
   * win over a same-name attribute once it does upgrade, and must not
   * permanently shadow the prototype accessor afterward.
   *
   * Svelte's generated `connectedCallback` already ports and deletes an
   * attribute-less pre-upgrade own property (custom-element.js:133-142) —
   * but when the SAME key is also present as an attribute, its earlier
   * attribute loop (custom-element.js:126-132) has already written that
   * key into `$$d`, so the port loop's `!(key in this.$$d)` guard skips it:
   * the pre-upgrade property is left as a permanent own-property shadow, and
   * the attribute's value — not the property's — is what the component gets.
   *
   * The fix: capture and delete every declared prop that is currently an own
   * property BEFORE deferring to Svelte's `connectedCallback` (so its
   * attribute loop can never make the port loop think the key is already
   * spoken for, and its port loop finds nothing left to port), then
   * re-assign each captured value through the prototype accessor AFTER the
   * component exists — an ordinary property write, indistinguishable from a
   * host writing it post-upgrade, which already wins over the attribute
   * (README, "Attributes vs properties"). Applied uniformly to every
   * declared prop (not just ones with a same-name attribute) so there is one
   * code path instead of two: the cost is that a pre-upgrade property with
   * no attribute now mounts at its default and is reassigned a tick later,
   * instead of mounting with the right value the first time — invisible to
   * a host (same task, before paint), and covered by case 2b below.
   */
  function extend(Class: new () => HTMLElement) {
    const Base = Class as unknown as SvelteCustomElementConstructor;
    return class extends Base {
      // DOM locale resolution (hardening spec 4.2): closest `lang` wins,
      // falling back to `<html lang>`, falling back to English.
      // `this.closest("[lang]")` already implements that whole order in one
      // call — it checks the host itself first, then walks ancestors, and
      // `<html>` is reachable the same way since it too can carry `lang`.
      // Reactive to any `lang` mutation anywhere in the document (not just
      // on this host) via a single MutationObserver on `documentElement`
      // with `subtree: true` — cheaper than a Node-level observer per
      // ancestor, and correct because a change to an *ancestor's* lang can
      // change what this host's `closest("[lang]")` resolves to even when
      // the host's own attribute didn't move.
      //
      // Sets the registry's shared `locale` (registry.svelte.ts's known
      // limitation): two elements on one page with different `lang` will
      // not get independently-localized chrome — the most recently
      // connected (or most recently lang-mutated) element's resolution
      // wins for both. Not addressed here; nothing today asks for two
      // differently-localized players sharing a page.
      #localeObserver: MutationObserver | undefined;

      // CSP-safe style hoist (hardening spec 2.1): hoists Svelte's injected
      // style nodes into adoptedStyleSheets on connect, and again on every
      // later mutation (a canvas switch mounts new lib components lazily).
      #styleObserver: MutationObserver | undefined;

      // Set once in the constructor (attachInternals() may be called at
      // most once per element) so the inner Svelte component ($host()) can
      // reflect player state onto it as custom states — see the
      // `internals.states` effect in the component script below.
      __internals?: ElementInternals;

      constructor(...params: never[]) {
        super(...params);
        this.__internals = this.attachInternals();
      }

      #resolveLocale(): void {
        const match = this.closest("[lang]");
        const value = match?.getAttribute("lang");
        setLocale(value && value.trim() !== "" ? value : "en");
      }

      async connectedCallback() {
        this.#resolveLocale();
        this.#localeObserver = new MutationObserver(() =>
          this.#resolveLocale(),
        );
        this.#localeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["lang"],
          subtree: true,
        });

        const self = this as unknown as Record<string, unknown>;
        const captured: Record<string, unknown> = {};
        for (const key of Object.keys(this.$$p_d)) {
          if (Object.prototype.hasOwnProperty.call(this, key)) {
            captured[key] = self[key];
            delete self[key];
          }
        }
        await super.connectedCallback();
        hoistShadowStyles(this.shadowRoot!);
        this.#styleObserver = new MutationObserver(() => {
          hoistShadowStyles(this.shadowRoot!);
        });
        this.#styleObserver.observe(this.shadowRoot!, { childList: true });
        setTimeout(() => warnIfNoStylesFound(this.shadowRoot!), 0);
        for (const key of Object.keys(captured)) {
          self[key] = captured[key];
        }
      }

      disconnectedCallback() {
        this.#localeObserver?.disconnect();
        this.#localeObserver = undefined;
        this.#styleObserver?.disconnect();
        this.#styleObserver = undefined;
        super.disconnectedCallback();
      }

      // 1.2: a no-op so browsers doing a `moveBefore()` move skip Svelte's
      // disconnect/reconnect teardown (custom-element.js:201-211) entirely —
      // state-preserving moves for hosts using the modern API. Zero effect
      // on hosts that never call `moveBefore()`; AJAX *replacement* (remove
      // + a brand-new node) still rebuilds, same as before (README,
      // "Reconnection").
      connectedMoveCallback() {}
    };
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { IIIFPlayer, t } from "../lib/index.js";
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
    PlaybackEventDetail,
    PlayerErrorDetail,
    PlayerRefAvailableDetail,
    RateChangeDetail,
  } from "./events.js";

  let {
    manifestUrl = "",
    canvasIndex = 0,
    initialTime,
    autoplay = false,
    label,
    crossorigin,
    annotations = "auto",
    preprocessManifest,
    errorCallback,
  }: {
    manifestUrl?: string;
    canvasIndex?: number;
    initialTime?: number | undefined;
    autoplay?: boolean;
    /** `label` attribute. Host-settable accessible name for the element's
     * top-level region. Falls back to the localized generic name. */
    label?: string;
    /**
     * `crossorigin` attribute. Forwarded to the underlying media element.
     * Any value other than "anonymous"/"use-credentials" is passed through
     * unvalidated, same as the native HTML attribute.
     */
    crossorigin?: string;
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
    if (info.fatal) hasFatalHostError = true;
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
    emit<PlayerErrorDetail>("iiif-player-error", {
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
  // precedes iiif-player-ready.
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

  // Fatal errors that happen before playerRefValue is ever set (a manifest
  // or first-canvas failure — report()'s `fatal: true` path) need their own
  // flag: PlayerRef.state doesn't exist yet to read `.error` off of.
  let hasFatalHostError = $state(false);

  const isPlayingState = $derived(playerRefValue?.state.isPlaying ?? false);
  // "loading": the manifest/first canvas hasn't resolved yet. Deliberately
  // narrower than isBuffering (a mid-playback stall) — a host wanting a
  // spinner during startup only, not every rebuffer, wants this one.
  const isLoadingState = $derived(
    !playerRefValue || !playerRefValue.state.isReady,
  );
  const isErrorState = $derived(
    hasFatalHostError || playerRefValue?.state.error != null,
  );

  $effect(() => {
    const internals = ($host() as unknown as { __internals?: ElementInternals })
      .__internals;
    if (!internals) return;
    internals.states[isPlayingState ? "add" : "delete"]("playing");
    internals.states[isLoadingState ? "add" : "delete"]("loading");
    internals.states[isErrorState ? "add" : "delete"]("error");
  });

  const safeAnnotations = $derived<Annotation[] | "auto">(
    annotationsValid ? annotations : "auto",
  );
  const safePreprocess = $derived(
    preprocessValid ? preprocessManifest : undefined,
  );

  // A blank/whitespace-only label attribute (e.g. `label=""`) is treated
  // like "not set" rather than an empty accessible name — an empty
  // aria-label is worse than the localized default, not more specific.
  const effectiveLabel = $derived(
    label && label.trim() !== "" ? label : t("playerRegionLabel"),
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

  // exactOptionalPropertyTypes: Viewer's crossOrigin prop is
  // `"anonymous" | "use-credentials"` (no explicit `| undefined`), so it can
  // only be passed when it is actually one of those two values.
  const optionalViewerProps = $derived<{
    crossOrigin?: "anonymous" | "use-credentials";
  }>(
    crossorigin === "anonymous" || crossorigin === "use-credentials"
      ? { crossOrigin: crossorigin }
      : {},
  );

  function handlePlayerInit(player: PlayerRef) {
    playerRefValue = player;
    emit<PlayerRefAvailableDetail>("iiif-player-ready", { playerRef: player });
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
    emit<CanvasChangeDetail>("iiif-player-canvas-change", { index, canvas });
  }

  // Playback events are derived from actual player.state transitions
  // (Shoelace's "state-driven only" rule), never from a programmatic prop
  // write — a canvas switch resets several PlayerState fields via
  // resetTransientPlaybackState() but never actually starts playback, so
  // it must never look like a `play` transition here.
  let prevPlaybackState: {
    isPlaying: boolean;
    hasEnded: boolean;
    isSeeking: boolean;
    playbackRate: number;
  } | null = null;

  $effect(() => {
    const state = playerRefValue?.state;
    if (!state) return;
    const current = {
      isPlaying: state.isPlaying,
      hasEnded: state.hasEnded,
      isSeeking: state.isSeeking,
      playbackRate: state.playbackRate,
    };
    const prev = prevPlaybackState;
    prevPlaybackState = current;
    // The first observation establishes the baseline; nothing transitioned
    // yet, so there is nothing to report.
    if (!prev) return;

    const justEnded = current.hasEnded && !prev.hasEnded;
    if (justEnded) {
      emit<PlaybackEventDetail>("iiif-player-ended", {});
    }
    if (current.isPlaying !== prev.isPlaying) {
      if (current.isPlaying) {
        emit<PlaybackEventDetail>("iiif-player-play", {});
      } else if (!justEnded) {
        // Ordering pin (3.2 in the hardening spec): HTML fires `pause`
        // then `ended` in one queued task, so this flush sees isPlaying
        // and hasEnded flip together. Suppress `iiif-player-pause` in
        // that case — `iiif-player-ended` already reported it, by design.
        emit<PlaybackEventDetail>("iiif-player-pause", {});
      }
    }
    if (prev.isSeeking && !current.isSeeking) {
      emit<PlaybackEventDetail>("iiif-player-seeked", {});
    }
    if (current.playbackRate !== prev.playbackRate) {
      emit<RateChangeDetail>("iiif-player-rate-change", {
        rate: current.playbackRate,
      });
    }
  });
</script>

<div class="iiif-tp" role="region" aria-label={effectiveLabel}>
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
        <IIIFPlayer.Viewer {...optionalViewerProps} />
        <IIIFPlayer.Controls>
          <IIIFPlayer.PlayButton />
          <IIIFPlayer.Progress />
          <IIIFPlayer.Skip seconds={-10} />
          <IIIFPlayer.Skip seconds={30} />
          <IIIFPlayer.Speed />
          <IIIFPlayer.Time />
          <IIIFPlayer.Captions />
        </IIIFPlayer.Controls>
        {#if (playerRefValue?.canvasCount ?? 0) > 1}
          <IIIFPlayer.CanvasNav />
        {/if}
        {#if player.annotations.length > 0 || player.transcriptStatus === "loading" || player.transcriptStatus === "error"}
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
    /* Without this the control bar is a single non-wrapping row that
       overflows any host narrower than about 484px, including the 320px
       width WCAG 1.4.10 Reflow is tested at. Canvas nav below already
       wraps; the control bar had been left out. */
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--iiif-player-control-bg, #f3f4f6);
    color: var(--iiif-player-control-fg, inherit);
    border: 1px solid var(--iiif-player-border, #767676);
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
    border: 1px solid var(--iiif-player-border, #767676);
    /* Reserved on every button so the active one gains an indicator rather
       than a width — same reserve-then-color pattern as the segments below.
       Without it, which canvas you are on is conveyed by the accent
       background alone, which is 1.4.1 Use of Color: `aria-current` is
       programmatic rather than visual, and the forced-colors rule at the
       bottom of this stylesheet only fires under a contrast theme. */
    border-inline-start: 4px solid transparent;
    border-radius: 4px;
    width: auto;
  }

  .iiif-tp :global(nav.canvas-nav button[data-state="active"]) {
    background: var(--iiif-player-accent, #1d4ed8);
    color: var(--iiif-player-accent-fg, #ffffff);
    /* Keyed to accent-fg, not the segment indicator token: this bar sits on
       the accent background, where --iiif-player-segment-indicator's default
       would be the same blue as the button it marks. */
    border-inline-start-color: var(--iiif-player-accent-fg, #ffffff);
  }

  .iiif-tp :global(.transcript-panel) {
    background: var(--iiif-player-transcript-bg, transparent);
    border: 1px solid var(--iiif-player-border, #767676);
    border-radius: 4px;
    padding: 0.5rem;
    max-height: 24rem;
  }

  .iiif-tp :global(input[type="search"]) {
    width: 100%;
    box-sizing: border-box;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--iiif-player-border, #767676);
    border-radius: 4px;
    font: inherit;
  }

  .iiif-tp :global([data-annotation-id]) {
    /* Segment.svelte's `all: unset` resets box-sizing to content-box, so
       this padding and the 4px indicator below would otherwise be added
       *outside* a width:100% box — 20px of overflow per segment at any
       width, visible as horizontal scroll in a narrow column. */
    box-sizing: border-box;
    padding: 0.375rem 0.5rem;
    border-radius: 4px;
    border-inline-start: 4px solid transparent;
  }

  .iiif-tp :global([data-annotation-id][data-state="active"]) {
    background: var(--iiif-player-segment-active-bg, #fef3c7);
    color: var(--iiif-player-segment-fg, #1a1a1a);
    border-inline-start-color: var(--iiif-player-segment-indicator, #1d4ed8);
  }

  .iiif-tp :global([data-annotation-id][data-highlighted="true"]),
  .iiif-tp :global([data-annotation-id][data-current-match="true"]) {
    background: var(--iiif-player-segment-highlight-bg, #dbeafe);
    color: var(--iiif-player-segment-fg, #1a1a1a);
    border-inline-start-color: var(--iiif-player-segment-indicator, #1d4ed8);
  }

  .iiif-tp :global(nav.canvas-nav button:focus),
  .iiif-tp :global([data-annotation-id]:focus) {
    outline-color: var(--iiif-player-focus, #1d4ed8);
  }

  @media (forced-colors: active) {
    .iiif-tp :global([data-annotation-id][data-state="active"]),
    .iiif-tp :global([data-annotation-id][data-highlighted="true"]),
    .iiif-tp :global([data-annotation-id][data-current-match="true"]) {
      border-inline-start-color: Highlight;
    }

    .iiif-tp :global(nav.canvas-nav button[data-state="active"]) {
      border-color: Highlight;
    }

    .iiif-tp :global(nav.canvas-nav button:focus),
    .iiif-tp :global([data-annotation-id]:focus) {
      outline-color: Highlight;
    }
  }
</style>
