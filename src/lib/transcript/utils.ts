import type { Annotation } from "../sync/types.js";

/**
 * Format time in seconds to MM:SS or H:MM:SS display
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Find annotation by ID
 */
export function getAnnotationById(
  annotations: Annotation[],
  id: string,
): Annotation | null {
  return annotations.find((ann) => ann.id === id) ?? null;
}
