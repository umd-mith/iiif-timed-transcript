/**
 * Annotation Utility Functions
 *
 * Pure utility functions for annotation time-mapping operations.
 */

import type { Annotation } from "./types.js";

/**
 * Get the annotation that should be active at a given time.
 * When multiple annotations overlap, returns the narrowest (most specific) match.
 *
 * @param time - Current playback time in seconds
 * @param annotations - Array of annotations sorted by startTime
 * @returns The active annotation, or null if none
 */
export function getActiveAnnotation(
  time: number,
  annotations: Annotation[],
): Annotation | null {
  return getActiveAnnotationWithIndex(time, annotations)?.annotation ?? null;
}

/**
 * Get the active annotation and its index at a given time.
 * Uses linear scan with narrowest-span tiebreaker to handle overlapping
 * annotations (common in speaker diarization). When spans are equal,
 * the first match in array order wins for stable highlighting.
 *
 * @param time - Current playback time in seconds
 * @param annotations - Array of annotations sorted by startTime
 * @returns Object with annotation and index, or null if none active
 */
export function getActiveAnnotationWithIndex(
  time: number,
  annotations: Annotation[],
): { annotation: Annotation; index: number } | null {
  let best: { annotation: Annotation; index: number } | null = null;
  let bestSpan = Infinity;

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i]!;

    // Annotations are sorted by startTime — once we pass the current time,
    // no further annotations can contain it.
    if (ann.startTime > time) break;

    if (time >= ann.startTime && time < ann.endTime) {
      const span = ann.endTime - ann.startTime;
      if (span < bestSpan) {
        best = { annotation: ann, index: i };
        bestSpan = span;
      }
    }
  }
  return best;
}

/**
 * Calculate the scroll position for a given time.
 * Assumes annotations are evenly distributed in the transcript.
 *
 * @param time - Current playback time in seconds
 * @param duration - Total video duration in seconds
 * @returns Scroll progress from 0 to 1
 */
export function timeToScrollProgress(time: number, duration: number): number {
  if (duration === 0) return 0;
  return Math.max(0, Math.min(1, time / duration));
}

/**
 * Calculate the time for a given scroll position using annotation-based mapping.
 *
 * Instead of linear interpolation across video duration, this maps scroll position
 * to annotation time ranges. This ensures scrolling through the transcript
 * corresponds to the actual annotation content, not the full video duration.
 *
 * @param scrollProgress - Scroll position from 0 to 1
 * @param annotations - Array of annotations with time ranges
 * @returns Mapped time in seconds
 *
 * @example
 * // For 24 annotations spanning 0-120s:
 * scrollProgressToTime(0.0, annotations) // => 0s (first annotation start)
 * scrollProgressToTime(0.5, annotations) // => ~60s (middle annotation)
 * scrollProgressToTime(1.0, annotations) // => 120s (last annotation end)
 */
export function scrollProgressToTime(
  scrollProgress: number,
  annotations: Annotation[],
): number {
  // Handle edge cases
  if (annotations.length === 0) return 0;

  // Clamp scroll progress to [0, 1]
  const clampedProgress = Math.max(0, Math.min(1, scrollProgress));

  // Special case: 100% scroll should map to end of last annotation
  if (clampedProgress === 1.0) {
    const lastAnnotation = annotations.at(-1);
    return lastAnnotation?.endTime ?? 0;
  }

  // Map scroll progress (0-1) to annotation array index
  // Example: 24 annotations, 50% scroll => index 12
  const exactIndex = clampedProgress * annotations.length;
  const baseIndex = Math.floor(exactIndex);

  // Clamp to valid array bounds
  const clampedIndex = Math.max(0, Math.min(baseIndex, annotations.length - 1));

  // Get the annotation at this index
  const annotation = annotations[clampedIndex];

  if (!annotation) {
    return 0;
  }

  // Calculate local progress within this annotation's time range
  // Example: exactIndex 12.3 => baseIndex 12, localProgress 0.3
  const localProgress = exactIndex - baseIndex;

  // Interpolate within the annotation's time range
  const timeWithinAnnotation =
    localProgress * (annotation.endTime - annotation.startTime);

  return annotation.startTime + timeWithinAnnotation;
}
