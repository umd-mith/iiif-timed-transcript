/**
 * SyncController - Svelte 5 Class Wrapper
 *
 * Bidirectional media-transcript synchronization controller.
 * Wraps XState machine with reactive Svelte 5 runes API.
 */

import { createActor } from "xstate";
import type { Actor } from "xstate";
import { syncMachine } from "./syncMachine.js";
import type {
  SyncConfig,
  IIIFMediaViewerRef,
  Annotation,
  SyncContext,
} from "./types.js";
import { DEFAULT_SYNC_CONFIG } from "./config.js";
import {
  scrollProgressToTime,
  getActiveAnnotation,
} from "./annotationUtils.js";

/**
 * Type alias for SyncController's XState actor
 */
type SyncMachineActor = Actor<typeof syncMachine>;

/**
 * SyncController class for managing bidirectional sync between video and transcript.
 *
 * Usage:
 * ```ts
 * const controller = new SyncController({ debounceMs: 200 });
 * controller.initialize(viewerRef, scrollContainer, annotations);
 * ```
 */
export class SyncController {
  // Reactive state exposed via Svelte 5 $state
  currentTime = $state(0);
  scrollProgress = $state(0);
  activeAnnotations = $state<Annotation[]>([]);

  // Private state
  private actor: SyncMachineActor | null = null;
  private config: SyncConfig;
  private viewer: IIIFMediaViewerRef | null = null;
  private scrollContainer: HTMLElement | null = null;
  private annotations: Annotation[] = [];
  private isInitialized = false;
  private cleanupHandlers: Array<() => void> = [];
  private lastScrollEvent: number = 0; // Timestamp of last processed scroll event (for throttling)
  // Tracks an in-flight programmatic scroll (auto-scroll, return-to-following,
  // browsing search results, or a consumer scrollToAnnotation call) so the
  // container's own scroll listener can treat echoes of it as non-user
  // input rather than deliberate scrolling — see beginProgrammaticScroll().
  private programmaticScrollActive = false;
  private programmaticScrollCleanup: (() => void) | null = null;

  /**
   * Creates a new SyncController instance.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  /**
   * Validate viewer and scrollContainer inputs.
   * @throws {Error} if validation fails
   */
  private validateInputs(
    viewer: IIIFMediaViewerRef,
    scrollContainer: HTMLElement,
  ): void {
    if (
      !viewer ||
      typeof viewer.getCurrentTime !== "function" ||
      typeof viewer.seekTo !== "function"
    ) {
      throw new Error(
        "initialize() requires a valid IIIFMediaViewerRef with getCurrentTime() and seekTo() methods",
      );
    }

    if (!scrollContainer || !(scrollContainer instanceof HTMLElement)) {
      throw new Error(
        "initialize() requires a valid HTMLElement as scrollContainer",
      );
    }
  }

  /**
   * Initialize the controller with viewer and scroll container references.
   *
   * @param viewer - Reference to IIIFMediaViewer component
   * @param scrollContainer - HTML element containing the transcript
   * @param annotations - Array of annotations for scroll-to-time mapping (required)
   * @throws {Error} if viewer or scrollContainer is invalid
   */
  initialize(
    viewer: IIIFMediaViewerRef,
    scrollContainer: HTMLElement,
    annotations: Annotation[],
  ): void {
    if (this.isInitialized) {
      return;
    }

    this.validateInputs(viewer, scrollContainer);

    this.viewer = viewer;
    this.scrollContainer = scrollContainer;
    this.annotations = annotations;

    // Create the actor. Inputs (viewer, scrollContainer, annotations) are not
    // passed here — they are supplied via the INITIALIZE event below, after
    // the actor is started.
    this.actor = createActor(syncMachine);

    // Subscribe to state changes
    this.actor.subscribe((state) => {
      this.updateReactiveState(state.context);

      // Track when auto-scroll happens to block subsequent scroll events
      // mediaDriven means we're auto-scrolling the transcript
      if (state.matches("mediaDriven")) {
        this.beginProgrammaticScroll();
      }
    });

    this.actor.start();

    // Send INITIALIZE event to transition from idle → ready
    this.actor.send({
      type: "INITIALIZE",
      viewer: this.viewer,
      scrollContainer: this.scrollContainer,
      annotations: this.annotations,
      priorityLockDuration: this.config.priorityLockDuration,
    });

    // Set up event listeners to bridge DOM events to XState machine
    this.setupEventListeners();

    this.isInitialized = true;
  }

  /**
   * Set up DOM event listeners and connect them to the XState machine.
   * Creates the bridge between browser events and machine events.
   */
  private setupEventListeners(): void {
    if (!this.viewer || !this.scrollContainer || !this.actor) {
      return;
    }

    // Video timeupdate: Poll getCurrentTime() every 100ms (10 FPS update rate)
    // Polling is necessary because IIIFMediaViewerRef doesn't expose the raw video element
    // or timeupdate events. The viewer interface only provides getCurrentTime() method.
    // Alternative: If viewer API adds ontimeupdate callback, we could switch to event-based sync.
    //
    // Do not drive the machine until playback has actually moved the time.
    // The first poll after mount reports the initial time (usually 0) while
    // the media is paused; forwarding it would enter mediaDriven and scroll
    // the first segment into view before the user pressed play — in a
    // page-level layout that scrolls the whole document (#55).
    let initialTime: number | null = null;
    let playbackStarted = false;
    const timeupdateInterval = setInterval(() => {
      if (this.viewer && this.actor) {
        const currentTime = this.viewer.getCurrentTime();
        if (!playbackStarted) {
          if (initialTime === null) {
            initialTime = currentTime;
            return;
          }
          if (currentTime === initialTime) {
            return;
          }
          playbackStarted = true;
        }
        this.actor.send({ type: "VIDEO_TIME_UPDATE", currentTime });
      }
    }, 100);

    this.cleanupHandlers.push(() => clearInterval(timeupdateInterval));

    // Transcript scroll: Listen to scroll events and send to machine
    const handleScroll = () => {
      if (this.scrollContainer && this.actor) {
        const now = Date.now();

        // Ignore scroll events while a programmatic scroll transaction is
        // active. scrollIntoView({ behavior: 'smooth' }) triggers scroll
        // events throughout its animation, which can outlast any fixed
        // timeout — the transaction is closed explicitly by `scrollend`
        // (with a generous fallback timer), not by elapsed time.
        if (this.programmaticScrollActive) {
          return; // Skip scroll events during/after auto-scroll animation
        }

        // Throttle user scroll events to prevent video stuttering
        // Only process one scroll event per debounceMs during manual scrolling
        const timeSinceLastScroll = now - this.lastScrollEvent;
        if (timeSinceLastScroll < this.config.debounceMs) {
          return; // Skip rapid scroll events
        }
        this.lastScrollEvent = now;

        // A genuine, deliberate scroll — reported regardless of whether
        // scroll-to-seek is currently enabled; the panel decides what to do
        // with it (enter reading mode when scrollToSeek is configured off).
        this.config.onUserScroll?.();

        const { scrollTop, scrollHeight, clientHeight } = this.scrollContainer;
        const maxScroll = scrollHeight - clientHeight;
        const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;

        // Use annotation-based mapping instead of linear duration mapping
        // Maps scroll position to annotation time ranges, not full video duration
        const mappedTime = scrollProgressToTime(
          scrollProgress,
          this.annotations,
        );

        this.actor.send({
          type: "TRANSCRIPT_SCROLL",
          scrollProgress,
          mappedTime,
        });
      }
    };

    this.scrollContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    this.cleanupHandlers.push(() => {
      this.scrollContainer?.removeEventListener("scroll", handleScroll);
    });
  }

  /**
   * Updates reactive state from machine context.
   * Video seeking and scrolling are handled by actor invocations.
   */
  private updateReactiveState(context: SyncContext): void {
    this.currentTime = context.currentTime;
    // scrollPosition is already 0-1 progress from the machine
    this.scrollProgress = context.scrollPosition;

    // Track active annotation based on current time
    const activeAnnotation = getActiveAnnotation(
      context.currentTime,
      this.annotations,
    );
    this.activeAnnotations = activeAnnotation ? [activeAnnotation] : [];

    // Video seeking and transcript scrolling are now handled automatically by the machine's
    // videoController and scrollController actors invoked in scrollDriven and mediaDriven states.
  }

  /**
   * Reset the controller to idle state.
   */
  reset(): void {
    if (this.actor) {
      this.actor.send({ type: "RESET" });
    }
  }

  /**
   * Toggle the auto-scroll pause flag (A4). No-ops before initialize().
   */
  setAutoScrollEnabled(enabled: boolean): void {
    this.actor?.send({ type: "SET_AUTO_SCROLL_ENABLED", enabled });
  }

  /**
   * Push the effective scroll-to-seek policy (`scrollToSeek` prop AND NOT
   * reading mode). No-ops before initialize().
   */
  setScrollToSeekEnabled(enabled: boolean): void {
    this.actor?.send({ type: "SET_SCROLL_TO_SEEK_ENABLED", enabled });
  }

  /**
   * Marks a scroll about to happen (or already animating) as programmatic,
   * so the container's own scroll listener treats it as an auto-scroll echo
   * rather than a deliberate user scroll. Callers: the panel's own
   * `scrollToAnnotation` (covers returning to Following, browsing search
   * results, and the consumer-facing `scrollToAnnotation` API — all
   * programmatic transcript movement per
   * docs/specs/transcript-reading-mode.md's Lifecycle section).
   */
  notifyProgrammaticScroll(): void {
    this.beginProgrammaticScroll();
  }

  /**
   * Opens a programmatic-scroll transaction: scroll echoes are suppressed
   * until it closes. Closed by the container's `scrollend` event (fires
   * once a smooth-scroll animation settles, however long that takes) or,
   * as a fallback safety net, after 1s — covering both a target already in
   * view (no scroll, hence no `scrollend`, ever fires) and engines without
   * `scrollend` support. `scrollend` is the primary mechanism; the timer
   * only guards against it never firing.
   */
  private beginProgrammaticScroll(): void {
    this.endProgrammaticScroll();

    const container = this.scrollContainer;
    if (!container) return; // nothing can scroll → nothing to suppress

    this.programmaticScrollActive = true;

    const onScrollEnd = () => this.endProgrammaticScroll();
    container.addEventListener("scrollend", onScrollEnd, { once: true });
    const fallback = setTimeout(() => this.endProgrammaticScroll(), 1000);

    this.programmaticScrollCleanup = () => {
      container.removeEventListener("scrollend", onScrollEnd);
      clearTimeout(fallback);
    };
  }

  /** Closes the current programmatic-scroll transaction, if any. */
  private endProgrammaticScroll(): void {
    this.programmaticScrollActive = false;
    this.programmaticScrollCleanup?.();
    this.programmaticScrollCleanup = null;
  }

  /**
   * Check if the controller is ready (machine is in ready state).
   */
  get isReady(): boolean {
    if (!this.actor) {
      return false;
    }

    const snapshot = this.actor.getSnapshot();
    return snapshot.matches("ready");
  }

  /**
   * Cleanup and destroy the controller.
   * Stops the actor and clears references.
   * Safe to call multiple times (idempotent).
   */
  destroy(): void {
    // Idempotent: safe to call multiple times
    if (!this.isInitialized && !this.actor) {
      return;
    }

    // Clean up event listeners
    this.cleanupHandlers.forEach((cleanup) => cleanup());
    this.cleanupHandlers = [];
    this.endProgrammaticScroll();

    if (this.actor) {
      this.actor.stop();
      this.actor = null;
    }

    this.viewer = null;
    this.scrollContainer = null;
    this.isInitialized = false;
  }
}
