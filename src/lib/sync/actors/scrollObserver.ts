/**
 * scrollObserver Actor
 *
 * XState actor that observes scroll events on a container element and maps
 * scroll position to media time. Features adaptive throttling based on document
 * size and caching for performance.
 */

import { fromCallback } from "xstate";

/**
 * Input configuration for the scrollObserver actor.
 */
export interface ScrollObserverInput {
  /** The container element to observe for scroll events */
  scrollContainer: HTMLElement;
  /** Total duration of the media in seconds */
  duration: number;
}

/**
 * Output event emitted by the scrollObserver actor.
 */
export interface ScrollObserverOutput {
  type: "TRANSCRIPT_SCROLL";
  /** Scroll progress as a value between 0 and 1 */
  scrollProgress: number;
  /** Mapped time in seconds based on scroll position */
  mappedTime: number;
}

/**
 * Calculate adaptive throttle interval based on document height.
 * Larger documents need more aggressive throttling to maintain performance.
 *
 * @param documentHeight - Total scrollable height in pixels
 * @returns Throttle interval in milliseconds
 */
function getAdaptiveThrottle(documentHeight: number): number {
  return documentHeight > 10000 ? 100 : 50;
}

/**
 * Calculate scroll progress (0-1 range) from scroll container.
 * Handles edge cases like missing dimensions.
 *
 * @param scrollContainer - The scrolling element
 * @returns Scroll progress clamped to [0, 1]
 */
function calculateScrollProgress(scrollContainer: HTMLElement): number {
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const maxScroll = scrollHeight - clientHeight;

  // Handle edge case where there's no scrollable content
  if (maxScroll <= 0) return 0;

  const progress = scrollTop / maxScroll;

  // Clamp to [0, 1] range
  return Math.max(0, Math.min(1, progress));
}

/**
 * Map scroll progress to media time using a cache for performance.
 * Cache key uses 0.001 precision (rounded to nearest thousandth).
 *
 * @param progress - Scroll progress between 0 and 1
 * @param duration - Total media duration in seconds
 * @param cache - Map cache for storing computed values
 * @returns Mapped time in seconds
 */
function mapScrollToTime(
  progress: number,
  duration: number,
  cache: Map<number, number>,
): number {
  // Create cache key with 0.001 precision
  const cacheKey = Math.round(progress * 1000);

  // Check cache first
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Calculate time and cache it
  const time = progress * duration;
  cache.set(cacheKey, time);

  return time;
}

/**
 * scrollObserver actor logic.
 * Uses fromCallback to observe scroll events with adaptive throttling.
 */
export const scrollObserver = fromCallback<
  ScrollObserverOutput,
  ScrollObserverInput
>(({ sendBack, input }) => {
  const { scrollContainer, duration } = input;

  // Initialize cache for scroll-to-time mappings
  const scrollTimeCache = new Map<number, number>();

  // Calculate adaptive throttle based on document size
  const documentHeight = scrollContainer.scrollHeight;
  const throttleMs = getAdaptiveThrottle(documentHeight);

  // Throttle state
  let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastScrollTime = 0;
  let pendingScroll = false;

  const handleScroll = () => {
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;

    if (timeSinceLastScroll >= throttleMs) {
      // Emit immediately (leading edge)
      lastScrollTime = now;
      pendingScroll = false;

      const scrollProgress = calculateScrollProgress(scrollContainer);
      const mappedTime = mapScrollToTime(
        scrollProgress,
        duration,
        scrollTimeCache,
      );

      sendBack({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress,
        mappedTime,
      });
    } else if (!pendingScroll) {
      // Schedule trailing edge emission
      pendingScroll = true;
      const delay = throttleMs - timeSinceLastScroll;

      throttleTimeout = setTimeout(() => {
        lastScrollTime = Date.now();
        pendingScroll = false;

        const scrollProgress = calculateScrollProgress(scrollContainer);
        const mappedTime = mapScrollToTime(
          scrollProgress,
          duration,
          scrollTimeCache,
        );

        sendBack({
          type: "TRANSCRIPT_SCROLL",
          scrollProgress,
          mappedTime,
        });
      }, delay);
    }
  };

  // Add scroll event listener
  scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

  // Cleanup function
  return () => {
    scrollContainer.removeEventListener("scroll", handleScroll);
    if (throttleTimeout) {
      clearTimeout(throttleTimeout);
    }
  };
});
