import type { Annotation } from '../sync/types';

/**
 * Format time in seconds to MM:SS display
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Find annotation by ID
 */
export function getAnnotationById(
  annotations: Annotation[],
  id: string
): Annotation | null {
  return annotations.find(ann => ann.id === id) ?? null;
}
