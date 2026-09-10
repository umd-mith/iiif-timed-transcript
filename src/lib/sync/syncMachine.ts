/**
 * syncMachine - XState State Machine for Bidirectional Media-Transcript Sync
 *
 * Manages bidirectional synchronization between video playback and transcript scrolling.
 * Uses priority-based locking to coordinate competing sync directions.
 *
 * States:
 * - idle: Initial state, no sync ready
 * - ready: Both viewer and container available, waiting for user interaction
 * - scrollDriven: User scrolled transcript, video is syncing
 * - mediaDriven: Video is playing/seeking, transcript is syncing
 *
 * Priority Locking:
 * - Each direction (scroll→seek, seek→scroll) can request priority
 * - Lock expires after priorityLockDuration ms
 * - Prevents race conditions and competing updates
 */

import { setup, assign } from "xstate";
import type { SyncContext, SyncEvent, SyncPriority } from "./types.js";
import { videoController } from "./actors/videoController.js";
import { scrollController } from "./actors/scrollController.js";
import {
  getActiveAnnotation,
  getActiveAnnotationWithIndex,
  scrollProgressToTime,
} from "./annotationUtils.js";

/**
 * Create initial context for the sync machine.
 */
function createInitialContext(): SyncContext {
  return {
    currentTime: 0,
    targetTime: 0,
    scrollPosition: 0,
    syncPriority: {
      direction: null,
      timestamp: 0,
    },
    annotationIndex: -1,
    viewer: null,
    scrollContainer: null,
    annotations: [],
    priorityLockDuration: 1000,
    autoScrollEnabled: true,
  };
}

/**
 * Guard: Can we sync to video?
 * Checks if scroll-to-seek is allowed based on priority lock.
 */
function canSyncToVideo({ context }: { context: SyncContext }): boolean {
  const { syncPriority } = context;
  const now = Date.now();

  // Allow if no lock or lock expired
  if (
    !syncPriority.direction ||
    now - syncPriority.timestamp > context.priorityLockDuration
  ) {
    return true;
  }

  // Allow if we already have scroll priority
  return syncPriority.direction === "scroll";
}

/**
 * Guard: Has the active annotation changed?
 * Used to trigger transcript auto-scroll only on annotation boundaries.
 */
function annotationChanged({
  context,
  event,
}: {
  context: SyncContext;
  event: SyncEvent;
}): boolean {
  if (event.type !== "VIDEO_TIME_UPDATE") return false;

  const result = getActiveAnnotationWithIndex(
    event.currentTime,
    context.annotations,
  );
  const currentIndex = result?.index ?? -1;

  // Only trigger transition if there IS an active annotation and it changed
  // Prevents scroll-to-top bug when entering gaps in transcript coverage
  return currentIndex !== context.annotationIndex && currentIndex !== -1;
}

/**
 * The sync state machine.
 *
 * Flow:
 * 1. Start in idle
 * 2. INITIALIZE event → ready state, listen for scroll and video events
 * 3. User scrolls → scrollDriven, invoke videoController
 * 4. Video updates → mediaDriven, invoke scrollController (on annotation change)
 * 5. RESET event → back to idle
 */
export const syncMachine = setup({
  types: {
    context: {} as SyncContext,
    events: {} as SyncEvent,
  },
  actors: {
    videoController,
    scrollController,
  },
  guards: {
    canSyncToVideo,
    annotationChanged,
  },
  actions: {
    /**
     * Update current time from video.
     */
    updateCurrentTime: assign({
      currentTime: ({ event }) => {
        if (event.type === "VIDEO_TIME_UPDATE") {
          return event.currentTime;
        }
        return 0;
      },
    }),

    /**
     * Update scroll progress from transcript.
     */
    updateScrollProgress: assign({
      scrollPosition: ({ event }) => {
        if (event.type === "TRANSCRIPT_SCROLL") {
          return event.scrollProgress;
        }
        return 0;
      },
    }),

    /**
     * Calculate target time from scroll position.
     * Uses annotation-based mapping for non-linear time distribution.
     */
    calculateTargetTime: assign({
      targetTime: ({ context, event }) => {
        if (event.type !== "TRANSCRIPT_SCROLL") return context.targetTime;

        return scrollProgressToTime(event.scrollProgress, context.annotations);
      },
    }),

    /**
     * Acquire scroll priority lock.
     */
    acquireScrollPriority: assign({
      syncPriority: (): SyncPriority => ({
        direction: "scroll",
        timestamp: Date.now(),
      }),
    }),

    /**
     * Acquire media priority lock.
     */
    acquireMediaPriority: assign({
      syncPriority: (): SyncPriority => ({
        direction: "media",
        timestamp: Date.now(),
      }),
    }),

    /**
     * Update annotation index on video time change.
     */
    updateAnnotationIndex: assign({
      annotationIndex: ({ context, event }) => {
        if (event.type !== "VIDEO_TIME_UPDATE") return context.annotationIndex;

        const result = getActiveAnnotationWithIndex(
          event.currentTime,
          context.annotations,
        );
        return result?.index ?? -1;
      },
    }),

    /**
     * Initialize sync context with refs and annotations.
     */
    initializeSync: assign({
      viewer: ({ event }) => {
        if (event.type === "INITIALIZE") {
          return event.viewer;
        }
        return null;
      },
      scrollContainer: ({ event }) => {
        if (event.type === "INITIALIZE") {
          return event.scrollContainer;
        }
        return null;
      },
      annotations: ({ event }) => {
        if (event.type === "INITIALIZE") {
          return event.annotations;
        }
        return [];
      },
      priorityLockDuration: ({ context, event }) => {
        if (event.type === "INITIALIZE" && event.priorityLockDuration != null) {
          return event.priorityLockDuration;
        }
        return context.priorityLockDuration;
      },
    }),

    /**
     * Clear sync context on reset.
     */
    clearSync: assign({
      viewer: () => null,
      scrollContainer: () => null,
      annotations: () => [],
      currentTime: () => 0,
      targetTime: () => 0,
      scrollPosition: () => 0,
      annotationIndex: () => -1,
      syncPriority: (): SyncPriority => ({
        direction: null,
        timestamp: 0,
      }),
    }),

    /**
     * Toggle the auto-scroll pause flag (A4). Internal transition — no
     * state change, just context.
     */
    setAutoScrollEnabled: assign({
      autoScrollEnabled: ({ context, event }) => {
        if (event.type === "SET_AUTO_SCROLL_ENABLED") {
          return event.enabled;
        }
        return context.autoScrollEnabled;
      },
    }),
  },
}).createMachine({
  id: "sync",
  initial: "idle",
  context: createInitialContext,
  states: {
    idle: {
      on: {
        INITIALIZE: {
          target: "ready",
          actions: ["initializeSync"],
        },
      },
    },
    ready: {
      // Scroll observation is handled by SyncController.setupEventListeners()
      // which provides programmatic-scroll suppression and annotation-based time mapping.
      on: {
        TRANSCRIPT_SCROLL: {
          target: "scrollDriven",
          guard: "canSyncToVideo",
          actions: [
            "updateScrollProgress",
            "calculateTargetTime",
            "acquireScrollPriority",
          ],
        },
        VIDEO_TIME_UPDATE: {
          target: "mediaDriven",
          guard: "annotationChanged",
          actions: [
            "updateCurrentTime",
            "updateAnnotationIndex",
            "acquireMediaPriority",
          ],
        },
        SET_AUTO_SCROLL_ENABLED: {
          actions: ["setAutoScrollEnabled"],
        },
        RESET: {
          target: "idle",
          actions: ["clearSync"],
        },
      },
    },
    scrollDriven: {
      invoke: {
        id: "videoController",
        src: "videoController",
        input: ({ context }) => ({
          viewer: context.viewer!,
          targetTime: context.targetTime,
        }),
        onDone: "ready",
        onError: "ready",
      },
      on: {
        TRANSCRIPT_SCROLL: {
          target: "scrollDriven",
          reenter: true,
          actions: [
            "updateScrollProgress",
            "calculateTargetTime",
            "acquireScrollPriority",
          ],
        },
        SET_AUTO_SCROLL_ENABLED: {
          actions: ["setAutoScrollEnabled"],
        },
        RESET: {
          target: "idle",
          actions: ["clearSync"],
        },
      },
    },
    mediaDriven: {
      invoke: {
        id: "scrollController",
        src: "scrollController",
        input: ({ context }) => {
          const activeAnnotation = getActiveAnnotation(
            context.currentTime,
            context.annotations,
          );

          if (!activeAnnotation) {
            throw new Error("No active annotation for scroll sync");
          }

          return {
            scrollContainer: context.scrollContainer!,
            targetAnnotation: activeAnnotation,
            autoScrollEnabled: context.autoScrollEnabled,
          };
        },
        onDone: "ready",
        onError: "ready",
      },
      on: {
        VIDEO_TIME_UPDATE: {
          target: "mediaDriven",
          guard: "annotationChanged",
          reenter: true,
          actions: [
            "updateCurrentTime",
            "updateAnnotationIndex",
            "acquireMediaPriority",
          ],
        },
        SET_AUTO_SCROLL_ENABLED: {
          actions: ["setAutoScrollEnabled"],
        },
        RESET: {
          target: "idle",
          actions: ["clearSync"],
        },
      },
    },
  },
});
