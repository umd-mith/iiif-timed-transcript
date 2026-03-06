<!-- src/lib/player/Transcript.svelte -->
<script lang="ts">
  import { untrack, setContext } from "svelte";
  import { getPlayerContext } from "./context";
  import {
    TRANSCRIPT_CONTEXT_KEY,
    type TranscriptContext,
  } from "./transcript-context";
  import type { Annotation, IIIFMediaViewerRef } from "../sync/types";
  import type { Snippet } from "svelte";
  import { SyncController } from "../sync/SyncController.svelte";

  interface Props {
    /** Array of transcript annotations with timing and text */
    annotations?: Annotation[];

    // Sync configuration
    syncDebounceMs?: number;
    syncSettleMs?: number;
    syncPriorityLockDuration?: number;

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

    class?: string;
    children?: Snippet;
  }

  let {
    annotations = [],
    syncDebounceMs = 150,
    syncSettleMs = 100,
    syncPriorityLockDuration = 1000,
    ariaLabel = "Media transcript",
    announceActiveSegment = true,
    onActiveAnnotationChange,
    onSegmentClick,
    empty,
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
   * Closes over scrollContainer so any child component can call it via context.
   */
  function scrollToAnnotation(
    annotationId: string,
    // eslint-disable-next-line no-undef
    options?: ScrollIntoViewOptions,
  ): boolean {
    if (!scrollContainer) return false;
    const el = scrollContainer.querySelector(
      `[data-annotation-id="${annotationId}"]`,
    );
    if (!el) return false;

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

  // Provide TranscriptContext for compound children (TranscriptSearch, TranscriptSegments)
  setContext(TRANSCRIPT_CONTEXT_KEY, {
    get state() {
      return {
        annotations: resolvedAnnotations,
        activeAnnotationId,
        searchMatches,
        currentMatchIndex,
        highlightedIds,
        currentMatchId,
      };
    },
    actions: {
      handleAnnotationClick,
      handleMatchChange,
      scrollToAnnotation,
    },
  } satisfies TranscriptContext);

  // Search handler - unified callback from Search component
  function handleMatchChange(matches: Annotation[], index: number) {
    searchMatches = matches;
    currentMatchIndex = index;

    // Scroll to and seek to current match
    if (index >= 0 && matches[index]) {
      const match = matches[index];
      lastInteractionWasUser = true;
      // Seek media to match start time
      actions.seekTo(match.startTime);
    }
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

  // Reset user interaction flag after announcement has been processed
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track activeAnnotationId
    activeAnnotationId;
    if (lastInteractionWasUser) {
      // Allow one render cycle for the live region to update, then reset
      untrack(() => {
        lastInteractionWasUser = false;
      });
    }
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
  role="region"
  aria-label={ariaLabel}
  bind:this={scrollContainer}
>
  {#if resolvedAnnotations.length === 0}
    <!-- Empty state -->
    {#if empty}
      {@render empty()}
    {:else}
      <p class="empty-message">No transcript available.</p>
    {/if}
  {:else if children}
    {@render children()}
  {/if}

  <!-- Screen reader announcements for active segment (user-initiated changes only) -->
  {#if announceActiveSegment && activeAnnotationId && lastInteractionWasUser}
    {@const activeAnnotation = resolvedAnnotations.find(
      (a) => a.id === activeAnnotationId,
    )}
    {#if activeAnnotation}
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {activeAnnotation.text}
      </div>
    {/if}
  {/if}
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
