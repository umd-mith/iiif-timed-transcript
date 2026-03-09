// Public API — exports added as components are extracted in LDA-1964 through LDA-1968
// Components from LDA-1965, LDA-1966 removed in LDA-1983 (replaced by IIIFPlayer namespace)

// ============================================================================
// Compound Components (LDA-1983)
// ============================================================================

/**
 * IIIFPlayer - Compound component namespace for building IIIF media players.
 *
 * Provides a flexible, composable API for creating custom IIIF media player UIs.
 *
 * @example
 * ```svelte
 * <script>
 *   import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';
 * </script>
 *
 * <IIIFPlayer.Root manifestUrl="..." canvasIndex={0}>
 *   <IIIFPlayer.Viewer />
 *   <IIIFPlayer.Controls>
 *     <IIIFPlayer.PlayButton />
 *     <IIIFPlayer.Progress />
 *     <IIIFPlayer.Skip seconds={10} />
 *     <IIIFPlayer.Speed />
 *     <IIIFPlayer.Time />
 *   </IIIFPlayer.Controls>
 *   <IIIFPlayer.Transcript annotations={...}>
 *     <IIIFPlayer.TranscriptSearch />
 *     <IIIFPlayer.TranscriptSegments />
 *   </IIIFPlayer.Transcript>
 * </IIIFPlayer.Root>
 * ```
 */
export { IIIFPlayer, getPlayerContext } from "./player";
export type {
  PlayerContext,
  PlayerState,
  PlayerActions,
  MediaStrategy,
  CanvasInfo,
} from "./player";
export type {
  TranscriptContext,
  TranscriptState,
  TranscriptActions,
} from "./player";
export type { SegmentSnippetProps } from "./player/TranscriptSegments.svelte";
export type { TrackDefinition } from "./player";

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
  AnnotationPageSchema,
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
  type AnnotationPageData,
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
  hasMotivation,
  getSupplementaryAnnotations,
  getSupplementaryTextualBodies,
  buildTranscriptAnnotations,
  getSupplementaryVTTTracks,
  buildCanvasInfoList,
  filterChaptersForCanvas,
  type SupplementaryTextualContent,
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
// Transcript Utilities (LDA-1967)
// ============================================================================
// Note: Individual transcript components removed from public API in LDA-1983.
// Use IIIFPlayer.Transcript, IIIFPlayer.TranscriptSearch, IIIFPlayer.TranscriptSegments instead.

// Utility functions remain exported for advanced use cases
export { formatTimestamp, getAnnotationById } from "./transcript/utils";
export { getNextIndex, focusSegmentAtIndex } from "./transcript/keyboardNav";

// Paragraph merging utility
export { mergeIntoParagraphs } from "./transcript/paragraphMerger";
export type {
  MergedParagraph,
  MergeConfig,
} from "./transcript/paragraphMerger";

// ============================================================================
// Media Utilities
// ============================================================================

export {
  isHlsUrl,
  isHlsNativelySupported,
  createHlsAdapter,
} from "./media/hlsUtils";
export type { HlsConstructor, HlsAdapter } from "./media/hlsUtils";
