/**
 * scrollController Actor
 *
 * XState actor that manages automatic transcript scrolling during video playback.
 * Scrolls annotation elements into view with smooth behavior when video time changes.
 */

import { fromPromise } from "xstate";
import type { Annotation } from "../types.js";

/**
 * Input configuration for the scrollController actor.
 */
export interface ScrollControllerInput {
  /** The transcript container element to scroll */
  scrollContainer: HTMLElement;
  /** Target annotation to scroll into view */
  targetAnnotation: Annotation;
  /**
   * A4: when false, this actor is a no-op. Set from the transcript panel's
   * auto-scroll pause toggle. This also silences seek-driven scrolls
   * (segment click, search-match seek) that route through this same
   * actor — accepted: a user who paused auto-scroll has asked the panel
   * to stop moving on its own. Does not affect Transcript.scrollToAnnotation
   * or TranscriptSegments.scrollToAnnotation, which never invoke this actor.
   */
  autoScrollEnabled: boolean;
}

/**
 * scrollController actor implementation.
 * Finds annotation element in DOM and scrolls it into view smoothly.
 *
 * Follows ScrollyVideo.js pattern: simple scrollIntoView, no complex coordination.
 */
export const scrollController = fromPromise(
  async ({ input }: { input: ScrollControllerInput }) => {
    const { scrollContainer, targetAnnotation, autoScrollEnabled } = input;

    if (!autoScrollEnabled) {
      return;
    }

    // Find annotation element by data-annotation-id attribute
    // Page must render annotations with: <div data-annotation-id={ann.id}>
    const annotationElement = scrollContainer.querySelector(
      `[data-annotation-id="${targetAnnotation.id}"]`,
    );

    if (!annotationElement) {
      // Annotation not in DOM - fail silently (common during initialization)
      return;
    }

    // Respect prefers-reduced-motion for users with vestibular disorders
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Scroll annotation into view
    // 'center' block positioning keeps annotation in middle of viewport
    annotationElement.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
      block: "center",
      inline: "nearest",
    });

    // scrollIntoView is async but doesn't return a Promise
    // Wait a frame to ensure scroll has started
    await new Promise((resolve) => requestAnimationFrame(resolve));
  },
);
