/**
 * SyncController Types
 *
 * Type definitions for the bidirectional media-transcript synchronization system.
 * Supports both scroll-to-seek and seek-to-scroll with simple conflict resolution.
 */

/**
 * Atomic direction priority system for sync operations.
 * Prevents race conditions by using timestamp-based locking.
 */
export interface SyncPriority {
  /** Current sync direction: null (no lock), 'scroll' (scroll-to-seek), or 'media' (seek-to-scroll) */
  direction: "scroll" | "media" | null;
  /** Timestamp when priority was set (milliseconds) */
  timestamp: number;
}

/**
 * Context for the sync state machine.
 * Tracks current state and performance optimizations.
 */
export interface SyncContext {
  /** Current media playback time (seconds) */
  currentTime: number;
  /** Target time for pending seek operations (seconds) */
  targetTime: number;
  /** Current scroll position (0-1 normalized) */
  scrollPosition: number;
  /** Target scroll position for pending operations (0-1 normalized) */
  targetScroll: number;
  /** Current sync priority state */
  syncPriority: SyncPriority;
  /** Cache mapping scroll positions to timestamps for performance */
  scrollTimeCache: Map<number, number>;
  /** Index of currently active annotation */
  annotationIndex: number;
  /** Reference to IIIF media viewer for actor invocation */
  viewer: IIIFMediaViewerRef | null;
  /** Reference to transcript scroll container for actor invocation */
  scrollContainer: HTMLElement | null;
  /** Annotations for time-mapping operations */
  annotations: Annotation[];
  /** Duration to lock sync priority after user interaction (milliseconds) */
  priorityLockDuration: number;
}

/**
 * Events that drive the sync state machine.
 */
export type SyncEvent =
  | {
      type: "INITIALIZE";
      viewer: IIIFMediaViewerRef;
      scrollContainer: HTMLElement;
      annotations: Annotation[];
      priorityLockDuration?: number;
    }
  | { type: "VIDEO_TIME_UPDATE"; currentTime: number }
  | { type: "TRANSCRIPT_SCROLL"; scrollProgress: number; mappedTime: number }
  | { type: "RESET" };

/**
 * Configuration for sync behavior.
 * All timing values are in milliseconds.
 */
export interface SyncConfig {
  /** Debounce delay for scroll events (50-1000ms) */
  debounceMs: number;
  /** Time to wait for operations to settle (10-500ms) */
  settleMs: number;
  /** Duration to lock sync priority after user interaction (milliseconds) */
  priorityLockDuration: number;
}

/**
 * Annotation data structure.
 * Represents a timed annotation in the transcript.
 *
 * The `metadata` field supports arbitrary key-value pairs for consumer-specific
 * data. Common patterns include:
 *
 * @example Speaker labels
 * ```ts
 * const annotation: Annotation = {
 *   id: 'seg-1',
 *   startTime: 0,
 *   endTime: 5.2,
 *   text: 'Can you tell us about your childhood?',
 *   metadata: { speaker: 'Interviewer' }
 * };
 * ```
 *
 * @example Review/QA flags
 * ```ts
 * const annotation: Annotation = {
 *   id: 'seg-42',
 *   startTime: 120,
 *   endTime: 128.5,
 *   text: '[inaudible] the community center',
 *   metadata: {
 *     reviewStatus: 'needs-review',
 *     confidence: 0.45,
 *     flaggedBy: 'auto-qa'
 *   }
 * };
 * ```
 *
 * @example Custom display hints
 * ```ts
 * const annotation: Annotation = {
 *   id: 'seg-10',
 *   startTime: 30,
 *   endTime: 38,
 *   text: 'We called it the Lakeland Community.',
 *   metadata: {
 *     entityRefs: ['lakeland-community'],
 *     highlight: true
 *   }
 * };
 * ```
 */
export interface Annotation {
  /** Unique identifier for the annotation */
  id: string;
  /** Start time of the annotation (seconds) */
  startTime: number;
  /** End time of the annotation (seconds) */
  endTime: number;
  /** Text content of the annotation */
  text: string;
  /**
   * Optional BCP 47 language code for this annotation's text (e.g. "en",
   * "es", "fr"). Sourced from the manifest's annotation body language (tier
   * 1) or the selected VTT track's `srclang` (tier 2). Applied as `lang` on
   * the rendered segment text ONLY — never on the transcript panel's
   * `role="region"` element, which carries host-language chrome.
   */
  language?: string;
  /**
   * Optional metadata for consumer-specific data.
   * Access in custom segment snippets via `annotation.metadata?.speaker`, etc.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Reference interface for IIIFMediaViewer component.
 * Provides programmatic control over media playback.
 */
export interface IIIFMediaViewerRef {
  /** Seek to a specific time in the media */
  seekTo: (time: number) => void;
  /** Get current playback time */
  getCurrentTime: () => number;
  /** Get media duration */
  getDuration: () => number;
  /** Play media (async operation) */
  play: () => Promise<void>;
  /** Pause media */
  pause: () => void;
  /** Check if media player is ready */
  isReady: () => boolean;
  /** Set playback rate (optional - for speed control) */
  setPlaybackRate?: (rate: number) => void;
}

/**
 * Reason an annotation was skipped during transcript building.
 *
 * - `no-text-body`: Annotation had no TextualBody (e.g., VTT external resource)
 * - `no-temporal-fragment`: Target URI lacked a `#t=` fragment, so cannot be
 *    placed on the transcript timeline
 * - `parse-failed`: Target was present but could not be parsed (null, empty,
 *    unrecognized format)
 */
export type SkipReason =
  | "no-text-body"
  | "no-temporal-fragment"
  | "parse-failed";

/**
 * Diagnostic record for an annotation that was skipped during transcript building.
 */
export interface SkippedAnnotation {
  /** The annotation's original id */
  annotationId: string;
  /** Why the annotation was skipped */
  reason: SkipReason;
  /** The raw target value, for debugging */
  target?: unknown;
}

/**
 * Result of building transcript annotations from a canvas.
 *
 * Separates successfully parsed annotations from skipped ones,
 * giving callers structured diagnostics without console noise.
 */
export interface TranscriptAnnotationResult {
  /** Annotations ready for transcript display */
  annotations: Annotation[];
  /** Annotations that were skipped, with reasons */
  skipped: SkippedAnnotation[];
}

/**
 * Strategy for handling annotation clicks.
 * Determines how the system responds to user interaction.
 */
export type AnnotationStrategy = "seek-only" | "seek-and-play" | "preview";
