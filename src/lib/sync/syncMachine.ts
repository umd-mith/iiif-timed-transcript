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

import { setup, assign } from 'xstate';
import type {
	SyncContext,
	SyncEvent,
	SyncPriority,
	Annotation,
	IIIFMediaViewerRef
} from './types';
import { videoController } from './actors/videoController';
import { scrollController } from './actors/scrollController';
import { scrollObserver } from './actors/scrollObserver';
import { getActiveAnnotation, scrollProgressToTime } from './annotationUtils';

/**
 * Create initial context for the sync machine.
 */
function createInitialContext(): SyncContext {
	return {
		currentTime: 0,
		targetTime: 0,
		scrollPosition: 0,
		targetScroll: 0,
		syncPriority: {
			direction: null,
			timestamp: 0
		},
		scrollTimeCache: new Map(),
		annotationIndex: -1,
		viewer: null,
		scrollContainer: null,
		annotations: []
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
	if (!syncPriority.direction || now - syncPriority.timestamp > 1000) {
		return true;
	}

	// Allow if we already have scroll priority
	return syncPriority.direction === 'scroll';
}

/**
 * Guard: Has the active annotation changed?
 * Used to trigger transcript auto-scroll only on annotation boundaries.
 */
function annotationChanged({ context, event }: { context: SyncContext; event: SyncEvent }): boolean {
	if (event.type !== 'VIDEO_TIME_UPDATE') return false;

	const activeAnnotation = getActiveAnnotation(event.currentTime, context.annotations);
	const currentIndex = activeAnnotation
		? context.annotations.findIndex((ann) => ann.id === activeAnnotation.id)
		: -1;

	return currentIndex !== context.annotationIndex;
}

/**
 * The sync state machine.
 *
 * Flow:
 * 1. Start in idle
 * 2. INITIALIZE event → ready state, spawn scrollObserver
 * 3. User scrolls → scrollDriven, invoke videoController
 * 4. Video updates → mediaDriven, invoke scrollController (on annotation change)
 * 5. RESET event → back to idle
 */
export const syncMachine = setup({
	types: {
		context: {} as SyncContext,
		events: {} as SyncEvent
	},
	actors: {
		videoController,
		scrollController,
		scrollObserver
	},
	guards: {
		canSyncToVideo,
		annotationChanged
	},
	actions: {
		/**
		 * Update current time from video.
		 */
		updateCurrentTime: assign({
			currentTime: ({ event }) => {
				if (event.type === 'VIDEO_TIME_UPDATE') {
					return event.currentTime;
				}
				return 0;
			}
		}),

		/**
		 * Update scroll progress from transcript.
		 */
		updateScrollProgress: assign({
			scrollPosition: ({ event }) => {
				if (event.type === 'TRANSCRIPT_SCROLL') {
					return event.scrollProgress;
				}
				return 0;
			}
		}),

		/**
		 * Calculate target time from scroll position.
		 * Uses annotation-based mapping for non-linear time distribution.
		 */
		calculateTargetTime: assign({
			targetTime: ({ context, event }) => {
				if (event.type !== 'TRANSCRIPT_SCROLL') return context.targetTime;

				return scrollProgressToTime(event.scrollProgress, context.annotations);
			}
		}),

		/**
		 * Acquire scroll priority lock.
		 */
		acquireScrollPriority: assign({
			syncPriority: (): SyncPriority => ({
				direction: 'scroll',
				timestamp: Date.now()
			})
		}),

		/**
		 * Acquire media priority lock.
		 */
		acquireMediaPriority: assign({
			syncPriority: (): SyncPriority => ({
				direction: 'media',
				timestamp: Date.now()
			})
		}),

		/**
		 * Update annotation index on video time change.
		 */
		updateAnnotationIndex: assign({
			annotationIndex: ({ context, event }) => {
				if (event.type !== 'VIDEO_TIME_UPDATE') return context.annotationIndex;

				const activeAnnotation = getActiveAnnotation(event.currentTime, context.annotations);
				if (!activeAnnotation) return -1;

				return context.annotations.findIndex((ann: Annotation) => ann.id === activeAnnotation.id);
			}
		}),

		/**
		 * Initialize sync context with refs and annotations.
		 */
		initializeSync: assign({
			viewer: ({ event }) => {
				if (event.type === 'INITIALIZE') {
					return event.viewer;
				}
				return null;
			},
			scrollContainer: ({ event }) => {
				if (event.type === 'INITIALIZE') {
					return event.scrollContainer;
				}
				return null;
			},
			annotations: ({ event }) => {
				if (event.type === 'INITIALIZE') {
					return event.annotations;
				}
				return [];
			}
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
				timestamp: 0
			})
		})
	}
}).createMachine({
	id: 'sync',
	initial: 'idle',
	context: createInitialContext,
	states: {
		idle: {
			on: {
				INITIALIZE: {
					target: 'ready',
					actions: ['initializeSync']
				}
			}
		},
		ready: {
			invoke: {
				id: 'scrollObserver',
				src: 'scrollObserver',
				input: ({ context }) => ({
					scrollContainer: context.scrollContainer!,
					duration: context.viewer?.getDuration() ?? 0
				})
			},
			on: {
				TRANSCRIPT_SCROLL: {
					target: 'scrollDriven',
					guard: 'canSyncToVideo',
					actions: ['updateScrollProgress', 'calculateTargetTime', 'acquireScrollPriority']
				},
				VIDEO_TIME_UPDATE: {
					target: 'mediaDriven',
					guard: 'annotationChanged',
					actions: ['updateCurrentTime', 'updateAnnotationIndex', 'acquireMediaPriority']
				},
				RESET: {
					target: 'idle',
					actions: ['clearSync']
				}
			}
		},
		scrollDriven: {
			invoke: {
				id: 'videoController',
				src: 'videoController',
				input: ({ context }) => ({
					viewer: context.viewer!,
					targetTime: context.targetTime
				}),
				onDone: 'ready'
			},
			on: {
				TRANSCRIPT_SCROLL: {
					target: 'scrollDriven',
					reenter: true,
					actions: ['updateScrollProgress', 'calculateTargetTime', 'acquireScrollPriority']
				},
				RESET: {
					target: 'idle',
					actions: ['clearSync']
				}
			}
		},
		mediaDriven: {
			invoke: {
				id: 'scrollController',
				src: 'scrollController',
				input: ({ context }) => {
					const activeAnnotation = getActiveAnnotation(context.currentTime, context.annotations);
					// Fall back to first annotation if no active annotation found
					const targetAnnotation = activeAnnotation || context.annotations[0];

					if (!targetAnnotation) {
						throw new Error('No annotations available for scroll sync');
					}

					return {
						scrollContainer: context.scrollContainer!,
						targetAnnotation
					};
				},
				onDone: 'ready'
			},
			on: {
				VIDEO_TIME_UPDATE: {
					target: 'mediaDriven',
					guard: 'annotationChanged',
					reenter: true,
					actions: ['updateCurrentTime', 'updateAnnotationIndex', 'acquireMediaPriority']
				},
				RESET: {
					target: 'idle',
					actions: ['clearSync']
				}
			}
		}
	}
});
