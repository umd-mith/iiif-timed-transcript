import type { Annotation } from "../sync/types.js";

/**
 * Format time in seconds to M:SS or H:MM:SS display (minutes are not
 * zero-padded below one hour, so 65s renders as "1:05")
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
 * True when a non-collapsed, non-empty text selection currently exists.
 * Used to suppress click-activation at the end of a drag-to-select gesture —
 * selecting/copying transcript text is not a request to jump to that
 * passage (docs/specs/transcript-reading-mode.md, "Reading mode").
 */
export function isTextSelectionActive(): boolean {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  return !!sel && !sel.isCollapsed && sel.toString().trim() !== "";
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
