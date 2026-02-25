/**
 * Local type definitions
 *
 * Media parsing types (Chapter, SpeakerSegment, TemporalFragment, SpatialFragment,
 * ParsedAnnotationTarget) are provided by @umd-mith/iiif-media-parsers.
 */

/**
 * Key frame data structure for still frame extraction
 *
 * Represents a timestamp and sequence position for extracting still frames
 * from video media. Used for stills-first scrolling and video preview thumbnails.
 */
export interface KeyFrame {
  /** Timestamp in seconds where the frame should be extracted */
  time: number;

  /** Zero-based sequence number for ordering frames */
  sequence: number;
}
