<!-- src/lib/player/Transcript.svelte -->
<script lang="ts">
  import { untrack } from "svelte";
  import { getPlayerContext } from "./context";
  import {
    setTranscriptContext,
    type TranscriptContext,
  } from "./transcript-context";
  import type { Annotation, IIIFMediaViewerRef } from "../sync/types";
  import type { TranscriptStatus } from "./context";
  import type { Snippet } from "svelte";
  import { SyncController } from "../sync/SyncController.svelte";
  import { getActiveAnnotationWithIndex } from "../sync/annotationUtils";
  import { t } from "../i18n/registry.svelte";

  interface Props {
    /** Array of transcript annotations with timing and text */
    annotations?: Annotation[];

    // Sync configuration
    syncDebounceMs?: number;
    syncSettleMs?: number;
    syncPriorityLockDuration?: number;

    /**
     * Controls how a selected search match reaches playback.
     * - `"change"` (default): preserves legacy behavior — every match
     *   selection (typing or previous/next) seeks immediately.
     * - `"activate"`: typing and previous/next only update highlights;
     *   seeking happens once, only through explicit activation (Enter or
     *   "Go to match" in `TranscriptSearch`/`Search`).
     * @default "change"
     */
    searchSeekBehavior?: "change" | "activate";

    /**
     * When `false`, transcript scrolling never seeks the media — a
     * deliberate user scroll instead enters Browsing (reading mode) so the
     * next playback-driven update can't pull the panel back. Independent of
     * `readingMode`: both `scrollToSeek=false` and `readingMode=true` stop
     * scroll-to-seek; only `readingMode` also stops media-driven scrolling.
     * Can change at runtime without rebuilding the player.
     * @default true
     */
    scrollToSeek?: boolean;
    /**
     * Bindable. `false` (Following, the default): playback may scroll the
     * transcript, and, when `scrollToSeek` is enabled, transcript scrolling
     * may seek. `true` (Browsing): the panel is detached from playback —
     * media keeps updating the active-passage highlight and active-
     * annotation state, but never scrolls the panel, and transcript
     * scrolling never seeks. Panel-local: two `Transcript` instances track
     * this independently. Turning `readingMode` back off (via the bindable,
     * a host property write, or the "Follow along" switch) scrolls the
     * passage at the media's current time into view without seeking — the
     * same "return to Following" behavior as "Jump to current".
     * @default false
     */
    readingMode?: boolean;

    // Accessibility
    ariaLabel?: string;
    announceActiveSegment?: boolean;

    // Callbacks
    onActiveAnnotationChange?: (annotation: Annotation | null) => void;
    onSegmentClick?: (
      annotation: Annotation,
      event: { preventDefault: () => void },
    ) => void;

    // Snippets
    empty?: Snippet;
    /**
     * Replaces the built-in "Loading transcript…" affordance while
     * `transcriptStatus === "loading"` and there is nothing to show yet.
     */
    loading?: Snippet;

    class?: string;
    children?: Snippet;
  }

  let {
    annotations = [],
    syncDebounceMs = 150,
    syncSettleMs = 100,
    syncPriorityLockDuration = 1000,
    searchSeekBehavior = "change",
    scrollToSeek = true,
    readingMode = $bindable(false),
    ariaLabel = "Media transcript",
    announceActiveSegment = true,
    onActiveAnnotationChange,
    onSegmentClick,
    empty,
    loading,
    class: className = "",
    children,
  }: Props = $props();

  // Get player context
  const playerContext = getPlayerContext();
  const { actions } = playerContext;

  // Fall back to context annotations when none provided directly
  const resolvedAnnotations = $derived(
    annotations.length > 0 ? annotations : playerContext.annotations,
  );

  // `transcriptStatus` describes Root's own fetch, so it only speaks for this
  // panel while the panel is falling back to the context annotations. A panel
  // given its own `annotations` prop — `<Transcript annotations={filtered}/>`
  // beside a Root with a VTT fetch in flight — is not loading anything.
  // An empty `resolvedAnnotations` already implies the panel is falling back to
  // context (own annotations, when non-empty, are what it resolves to).
  const isLoading = $derived(
    resolvedAnnotations.length === 0 &&
      playerContext.transcriptStatus === "loading",
  );

  // Publish the panel's *effective* populated state so Viewer (a sibling
  // that cannot see TranscriptContext) can switch native captions off once
  // the same text is on screen. Root clears the flag on every canvas load
  // and on an `annotations` mode flip; Transcript only ever sets it.
  //
  // The flag is monotonic per canvas load: "true wins", and only Root clears
  // it (on every `loadCanvas`). Writing `false` from here would make two
  // panels whose effective annotations differ — say `<Transcript
  // annotations={notes}/>` beside a bare `<Transcript/>` — ping-pong the flag
  // forever and blow the effect update depth.
  //
  // The context read is tracked on purpose. With a consumer-supplied
  // annotations *array* nothing else this effect reads ever changes, so an
  // untracked read would latch the flag at `false` for the life of the
  // component and native captions would never be hidden on the documented
  // primary path. Tracking it makes Root's per-load clear force one extra run
  // that re-publishes the truth; the write happens inside `untrack` and only
  // in the false→true direction, so it converges in that one run.
  $effect(() => {
    const populated = resolvedAnnotations.length > 0;
    const current = playerContext.transcriptPopulated;
    if (populated && !current) {
      untrack(() => {
        playerContext.transcriptPopulated = true;
      });
    }
  });

  // Create viewer adapter for SyncController
  // This adapts the player context to the full IIIFMediaViewerRef interface
  const viewerAdapter: IIIFMediaViewerRef = {
    seekTo: (time: number) => actions.seekTo(time),
    getCurrentTime: () => playerContext.state.currentTime,
    getDuration: () => playerContext.state.duration,
    play: async () => actions.play(),
    pause: () => actions.pause(),
    isReady: () => playerContext.state.isReady,
    setPlaybackRate: (rate: number) => actions.setPlaybackRate(rate),
  };

  // Refs
  let scrollContainer: HTMLElement | null = $state(null);

  // SyncController instance
  let syncController: SyncController | null = $state.raw(null);

  // Reading mode refs: the "Follow along" switch (persistent) and "Jump to
  // current" button (rendered only while Browsing) — see the focus-transfer
  // effect below.
  let followAlongSwitchEl: HTMLButtonElement | null = $state(null);
  let jumpToCurrentEl: HTMLButtonElement | null = $state(null);

  // Derived active annotation ID from SyncController
  let activeAnnotationId = $derived.by(() => {
    if (!syncController || syncController.activeAnnotations.length === 0) {
      return null;
    }
    return syncController.activeAnnotations[0]!.id;
  });

  // Track whether last annotation change was user-initiated (for screen reader announcements)
  let lastInteractionWasUser = $state(false);

  // Search state
  let searchMatches = $state<Annotation[]>([]);
  let currentMatchIndex = $state(-1);

  // Bumped on annotation replacement in "activate" mode or while reading
  // mode is active — the external reset path TranscriptSearch forwards to
  // Search's resetSignal prop (docs/specs/transcript-reading-mode.md,
  // "Lifecycle": clear the query and selected result on canvas switch).
  let queryResetSignal = $state(0);

  // Derive set of highlighted IDs (all search matches)
  const highlightedIds = $derived(new Set(searchMatches.map((m) => m.id)));

  // Derive current match ID for stronger highlighting
  const currentMatchId = $derived.by(() => {
    if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) {
      return null;
    }
    return searchMatches[currentMatchIndex]?.id ?? null;
  });

  /**
   * Scroll a specific annotation into view within the transcript panel.
   * Available to child components via TranscriptContext.actions.scrollToAnnotation.
   */
  function scrollToAnnotation(
    annotationId: string,
    // eslint-disable-next-line no-undef
    options?: ScrollIntoViewOptions,
  ): boolean {
    if (!scrollContainer) return false;
    const el = scrollContainer.querySelector(
      `[data-annotation-id="${CSS.escape(annotationId)}"]`,
    );
    if (!el) return false;

    // Programmatic transcript movement (returning to Following, browsing
    // search matches, and this consumer-facing scrollToAnnotation itself)
    // must never feed back into scroll-to-seek as a "deliberate user
    // scroll" — mark it before the browser fires the resulting scroll
    // event(s), including through a smooth-scroll animation's duration.
    syncController?.notifyProgrammaticScroll();

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    el.scrollIntoView(
      options ?? {
        behavior: prefersReducedMotion ? "instant" : "smooth",
        block: "center",
        inline: "nearest",
      },
    );
    return true;
  }

  /**
   * The passage "Jump to current" / "Return" should scroll to, given the
   * media's current time: the active cue when inside one; the next cue
   * when between cues; the first cue before the first one starts; the last
   * cue after the last one ends; `null` with no annotations at all.
   * Deliberately does not touch `activeAnnotationId` — that stays purely a
   * function of playback, so a between-cues return never marks a cue
   * active that the current time doesn't actually contain.
   */
  function findReturnTarget(
    anns: Annotation[],
    time: number,
  ): Annotation | null {
    if (anns.length === 0) return null;

    const active = getActiveAnnotationWithIndex(time, anns);
    if (active) return active.annotation;

    const first = anns[0]!;
    if (time < first.startTime) return first;

    const last = anns[anns.length - 1]!;
    if (time >= last.endTime) return last;

    const next = anns.find((a) => a.startTime > time);
    return next ?? last;
  }

  // Detects annotation replacement (e.g. a canvas switch swapping in a new
  // annotations array) and, in "activate" mode or while reading mode is
  // active, bumps queryResetSignal so Search clears its otherwise-private
  // query and selection (docs/specs/transcript-reading-mode.md, "Lifecycle").
  // In "change" mode with reading mode off, the query persists — the
  // existing re-notification path through Search's own annotations-prop
  // reactivity is untouched. `previousResolvedAnnotations` is a plain
  // variable (not $state) captured once at setup, so the first run always
  // sees `current === prev` and never bumps on mount.
  // svelte-ignore state_referenced_locally
  let previousResolvedAnnotations = resolvedAnnotations;
  $effect(() => {
    const current = resolvedAnnotations;
    untrack(() => {
      const prev = previousResolvedAnnotations;
      previousResolvedAnnotations = current;
      if (current === prev) return;
      if (searchSeekBehavior === "activate" || readingMode) {
        queryResetSignal++;
      }
    });
  });

  // Provide TranscriptContext for compound children (TranscriptSearch, TranscriptSegments)
  setTranscriptContext({
    get state() {
      return {
        annotations: resolvedAnnotations,
        activeAnnotationId,
        searchMatches,
        currentMatchIndex,
        highlightedIds,
        currentMatchId,
        searchSeekBehavior,
        readingMode,
        queryResetSignal,
      };
    },
    actions: {
      handleAnnotationClick,
      handleMatchChange,
      handleMatchActivate,
      handleQueryInput,
      scrollToAnnotation,
      enterBrowsing,
      returnToFollowing,
    },
  } satisfies TranscriptContext);

  // Search handler - unified callback from Search component. Updates
  // highlight/selection state always; seeks only in legacy "change" mode —
  // "activate" mode routes seeking exclusively through handleMatchActivate.
  // Browsing takes precedence even in "change" mode (docs/specs/
  // transcript-reading-mode.md, "Browsing takes precedence"): once the
  // reader has detached the panel from playback, match selection must not
  // seek regardless of searchSeekBehavior. A host that seeks inside its own
  // onmatchchange override owns that side effect — this only gates the
  // library's own default.
  function handleMatchChange(matches: Annotation[], index: number) {
    searchMatches = matches;
    currentMatchIndex = index;

    if (
      searchSeekBehavior === "change" &&
      !readingMode &&
      index >= 0 &&
      matches[index]
    ) {
      const match = matches[index];
      lastInteractionWasUser = true;
      actions.seekTo(match.startTime);
    }
  }

  // Explicit search-result activation (Enter or "Go to match"). Seeks
  // exactly once, regardless of searchSeekBehavior or reading mode — this
  // is the only seek path search takes in "activate" mode, and activation
  // stays in Browsing per the spec (it never calls enterBrowsing/
  // returnToFollowing itself).
  function handleMatchActivate(annotation: Annotation, index: number) {
    currentMatchIndex = index;
    lastInteractionWasUser = true;
    actions.seekTo(annotation.startTime);
  }

  // Synchronous query-input intent (Search's onqueryinput, forwarded
  // through TranscriptSearch). Editing a nonempty query enters Browsing
  // immediately, before debounce or rendering can cause scrolling — but
  // only in "activate" mode; legacy "change" mode keeps its existing
  // seek-on-select behavior and does not auto-enter Browsing from typing.
  function handleQueryInput(value: string) {
    if (searchSeekBehavior === "activate" && value.trim() !== "") {
      enterBrowsing();
    }
  }

  /** Enters Browsing. Idempotent. */
  function enterBrowsing() {
    readingMode = true;
  }

  /**
   * Returns to Following. The actual work — scrolling the passage at the
   * media's current time into view and the focus-transfer rule — happens
   * in the readingMode `$effect.pre` below, uniformly for every path that
   * can flip `readingMode` false→true→false: this action, the "Follow
   * along" switch, "Jump to current", and a host's own bindable-prop write.
   */
  function returnToFollowing() {
    readingMode = false;
  }

  // Initialize and reinitialize SyncController when dependencies change
  $effect(() => {
    // Capture reactive dependencies
    const container = scrollContainer;
    const anns = resolvedAnnotations;
    const mediaEl = playerContext.mediaElement;

    // Early return if requirements not met
    if (!mediaEl || !container || anns.length === 0) {
      return;
    }

    // Create new controller with current annotations
    const ctrl = new SyncController({
      debounceMs: syncDebounceMs,
      settleMs: syncSettleMs,
      priorityLockDuration: syncPriorityLockDuration,
      onUserScroll: handleUserScroll,
    });

    try {
      ctrl.initialize(viewerAdapter, container, anns);
    } catch (error) {
      console.error(
        "[Transcript] SyncController initialization failed:",
        error,
      );
    }

    // Update the component-level reference (untrack to avoid infinite loop)
    untrack(() => {
      syncController = ctrl;
    });

    // Cleanup: destroy controller when dependencies change or component unmounts
    return () => {
      ctrl.destroy();
    };
  });

  // Push the fold's two effective policies to whichever controller instance
  // is current — separate from the controller-creation effect above so
  // toggling either doesn't tear down and recreate the controller.
  // Following/Browsing is the single public toggle, but it maps to two
  // independent SyncController gates: Browsing stops BOTH media->scroll
  // (autoScrollEnabled) and scroll->seek (scrollToSeekEnabled), while
  // `scrollToSeek=false` alone — still Following — stops only the latter.
  $effect(() => {
    const enabled = !readingMode;
    syncController?.setAutoScrollEnabled(enabled);
  });

  $effect(() => {
    const enabled = scrollToSeek && !readingMode;
    syncController?.setScrollToSeekEnabled(enabled);
  });

  // A genuine, deliberate transcript scroll reported by SyncController
  // (already filtered from auto-scroll echoes and throttled — see
  // SyncController.onUserScroll). Only relevant while still Following with
  // scroll-to-seek configured off: that combination is the one case where
  // user scrolling itself must enter Browsing (docs/specs/
  // transcript-reading-mode.md, "Reading mode"). When scrollToSeek is true,
  // scrolling keeps driving the legacy scroll-to-seek behavior instead.
  function handleUserScroll() {
    if (!scrollToSeek) {
      enterBrowsing();
    }
  }

  // Returning to Following — by any path that flips readingMode true->false
  // (the "Follow along" switch, "Jump to current", the returnToFollowing
  // context action, or a host's own bindable-prop write) — scrolls the
  // passage at the media's CURRENT time into view (never seeks) and, only
  // when the disappearing "Jump to current" button currently owns focus,
  // moves focus to the persistent "Follow along" switch. $effect.pre (not
  // $effect) so the focus check runs before Svelte removes the Jump button
  // from the DOM — after removal the browser has already moved focus away
  // and `document.activeElement` can no longer tell us it was the button.
  let previousReadingMode = readingMode;
  $effect.pre(() => {
    const current = readingMode;
    const wasBrowsing = previousReadingMode;
    previousReadingMode = current;

    if (!(wasBrowsing && !current)) return;

    // Untracked: this reads playerContext.state.currentTime and
    // resolvedAnnotations, neither of which should make this effect re-run
    // on every playback tick — it must fire only on the readingMode
    // transition read above.
    untrack(() => {
      const jumpButtonHadFocus =
        jumpToCurrentEl !== null && document.activeElement === jumpToCurrentEl;

      const target = findReturnTarget(
        resolvedAnnotations,
        playerContext.state.currentTime,
      );
      if (target) {
        scrollToAnnotation(target.id);
      }

      if (jumpButtonHadFocus) {
        followAlongSwitchEl?.focus();
      }
    });
  });

  // Single sr-only announcement channel (A5): swaps text rather than
  // mounting/unmounting the live region, since inserting a live region
  // simultaneously with its content is unreliable across SR/browser pairs.
  let announcementText = $state("");

  // Segment announcements: user-initiated active-annotation changes only
  // (existing gating, now writing into the shared channel instead of the
  // template computing it inline).
  $effect(() => {
    const id = activeAnnotationId;
    if (announceActiveSegment && lastInteractionWasUser) {
      const activeAnnotation = resolvedAnnotations.find((a) => a.id === id);
      untrack(() => {
        announcementText = activeAnnotation ? activeAnnotation.text : "";
        lastInteractionWasUser = false;
      });
    }
  });

  // Status announcements (A5, closes the 4.1.3 gap): fire once per
  // loading -> ready / loading -> error transition, regardless of
  // announceActiveSegment (these are one-shot status messages, not
  // segment announcements). idle -> ready (tier-1 embedded annotations,
  // which never pass through "loading") intentionally does not announce —
  // there is nothing that was silently failing to report there.
  let lastTranscriptStatus: TranscriptStatus | undefined;
  $effect(() => {
    const status = playerContext.transcriptStatus;
    const count = resolvedAnnotations.length;
    untrack(() => {
      if (lastTranscriptStatus === "loading" && status === "ready") {
        announcementText = t("transcript.loadedAnnouncement", { count });
      } else if (lastTranscriptStatus === "loading" && status === "error") {
        announcementText = t("transcript.unavailableAnnouncement");
      }
      lastTranscriptStatus = status;
    });
  });

  // Mode-change announcements (spec accessibility bullet: "Announce match
  // counts and mode changes politely"). `previousReadingModeForAnnouncement`
  // is a plain variable captured once at setup — same pattern as
  // `previousReadingMode` above — so the first run always sees no change and
  // never announces on mount.
  let previousReadingModeForAnnouncement = readingMode;
  $effect(() => {
    const current = readingMode;
    untrack(() => {
      const was = previousReadingModeForAnnouncement;
      previousReadingModeForAnnouncement = current;
      if (was === current) return;
      announcementText = current
        ? t("transcript.browsingAnnouncement")
        : t("transcript.followingAnnouncement");
    });
  });

  // Fire onActiveAnnotationChange when active annotation changes
  $effect(() => {
    const id = activeAnnotationId;
    untrack(() => {
      if (onActiveAnnotationChange) {
        const active = id
          ? (resolvedAnnotations.find((a) => a.id === id) ?? null)
          : null;
        onActiveAnnotationChange(active);
      }
    });
  });

  // Click handler for annotations
  function handleAnnotationClick(annotation: Annotation) {
    if (onSegmentClick) {
      let prevented = false;
      onSegmentClick(annotation, {
        preventDefault: () => {
          prevented = true;
        },
      });
      if (prevented) return;
    }
    lastInteractionWasUser = true;
    actions.seekTo(annotation.startTime);
  }
</script>

<div
  class="transcript-panel {className}"
  part="transcript"
  role="region"
  aria-label={ariaLabel}
  aria-busy={isLoading}
  bind:this={scrollContainer}
>
  {#if resolvedAnnotations.length === 0}
    <!-- Empty state -->
    {#if isLoading}
      {#if loading}
        {@render loading()}
      {:else}
        <p class="loading-message">{t("transcript.loading")}</p>
      {/if}
    {:else if empty}
      {@render empty()}
    {:else}
      <p class="empty-message">{t("transcript.unavailable")}</p>
    {/if}
  {:else if children}
    <button
      type="button"
      class="follow-along-switch"
      role="switch"
      aria-checked={!readingMode}
      data-following={!readingMode}
      bind:this={followAlongSwitchEl}
      onclick={() => (readingMode ? returnToFollowing() : enterBrowsing())}
    >
      {t("transcript.followAlong")}
    </button>
    {#if readingMode}
      <button
        type="button"
        class="jump-to-current"
        bind:this={jumpToCurrentEl}
        onclick={returnToFollowing}
      >
        {t("transcript.jumpToCurrent")}
      </button>
    {/if}
    {@render children()}
  {/if}

  <!-- Screen reader announcements: active segment (user-initiated) and
       transcript load/failure status (A5). Persistently mounted — see the
       announcementText effects above. -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">
    {announcementText}
  </div>
</div>

<style>
  .transcript-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }

  .empty-message {
    padding: 1rem;
    text-align: center;
    color: #595959;
  }

  .loading-message {
    padding: 1rem;
    text-align: center;
    color: #595959;
  }

  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
