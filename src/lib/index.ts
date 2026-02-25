// Public API — exports added as components are extracted in LDA-1964 through LDA-1968

// ============================================================================
// Components (LDA-1965)
// ============================================================================
export { default as MediaPlayer } from "./components/MediaPlayer.svelte";
export { default as IIIFMediaViewer } from "./components/IIIFMediaViewer.svelte";

/**
 * AudioPlayerControls - Unstyled audio control bar with feature toggles (LDA-1966).
 *
 * @example
 * ```svelte
 * <script>
 *   import { AudioPlayerControls, IIIFMediaViewer } from '@umd-mith/svelte-iiif-transcript-player';
 *   let viewer;
 * </script>
 *
 * <IIIFMediaViewer bind:this={viewer} {manifestUrl} />
 * <AudioPlayerControls playerRef={viewer} skipAmounts={[10, 30]} />
 * ```
 */
export { default as AudioPlayerControls } from "./components/AudioPlayerControls.svelte";

// ============================================================================
// IIIF Utilities (LDA-1964)
// ============================================================================

// Types
export type { KeyFrame } from "./iiif/types";

// Re-export types from @umd-mith/iiif-media-parsers
export type {
  Chapter,
  SpeakerSegment,
  TemporalFragment,
  SpatialFragment,
  ParsedAnnotationTarget,
} from "@umd-mith/iiif-media-parsers";

// Re-export parsing utilities from @umd-mith/iiif-media-parsers
export {
  parseRanges,
  parseSpeakers as parseVTTSpeakers,
  parseMediaFragment,
  parseAnnotationTarget,
} from "@umd-mith/iiif-media-parsers";

// Validators and validated data types
export {
  ManifestSchema,
  CollectionSchema,
  ImageServiceSchema,
  IIIFResourceSchema,
  ExternalResourceSchema,
  TextualBodySchema,
  SpecificResourceSchema,
  ChoiceBodySchema,
  AnnotationBodySchema,
  type ManifestData,
  type CollectionData,
  type ImageServiceData,
  type CanvasData,
  type ContentResourceData,
  type AnnotationData,
  type TextualBodyData,
  type SpecificResourceData,
  type ChoiceBodyData,
  type AnnotationBodyData,
} from "./iiif/validators";

// Helper functions
export {
  getLabel,
  getThumbnail,
  getCanvases,
  getFirstCanvas,
  getManifests,
  getPaintingAnnotations,
  getPrimaryResource,
  getTextualBodies,
  isImageCanvas,
  isAudioCanvas,
  isVideoCanvas,
  isPDFCanvas,
  isTimeBasedCanvas,
  getCanvasDimensions,
  getCanvasAspectRatio,
  getAvailableLanguages,
  isMultiCanvas,
  isEmptyCollection,
  getManifestIds,
  getManifestLabels,
  findManifestInCollection,
  isValidIIIFResource,
  extractIdentifierFromUrl,
} from "./iiif/helpers";

// Cache
export {
  IIIFManifestCache,
  type IIIFCacheConfig,
  type CacheMetrics,
  type CacheLogger,
} from "./iiif/cache";

// ============================================================================
// Bidirectional Sync (LDA-1968)
// ============================================================================

// SyncController class
export { SyncController } from "./sync/SyncController.svelte";

// Types
export type {
  SyncConfig,
  Annotation,
  IIIFMediaViewerRef,
  SyncContext,
  SyncEvent,
  SyncPriority,
} from "./sync/types";

// Configuration
export { DEFAULT_SYNC_CONFIG } from "./sync/config";

// Utility functions
export {
  getActiveAnnotation,
  timeToScrollProgress,
  scrollProgressToTime,
} from "./sync/annotationUtils";

// ============================================================================
// Transcript Components (LDA-1967)
// ============================================================================

/**
 * TranscriptPanel - Main orchestrator component for transcript display and sync.
 *
 * @example
 * ```svelte
 * <script>
 *   import { TranscriptPanel } from '@umd-mith/svelte-iiif-transcript-player';
 * </script>
 *
 * <TranscriptPanel {annotations} {viewer} enableSearch />
 * ```
 */
export { default as TranscriptPanel } from "./transcript/Panel.svelte";

/**
 * TranscriptSearch - Standalone search component for transcript filtering.
 */
export { default as TranscriptSearch } from "./transcript/Search.svelte";

/**
 * TranscriptSegment - Reference implementation for individual transcript segments.
 */
export { default as TranscriptSegment } from "./transcript/Segment.svelte";

// Export transcript utilities
export { formatTimestamp, getAnnotationById } from "./transcript/utils";
export { keyboardNav, type KeyboardNavOptions } from "./transcript/keyboardNav";

// Paragraph merging utility
export { mergeIntoParagraphs } from "./transcript/paragraphMerger";
export type { MergedParagraph, MergeConfig } from "./transcript/paragraphMerger";
