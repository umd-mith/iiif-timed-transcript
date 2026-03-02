/**
 * scrollController Actor
 *
 * XState actor that manages automatic transcript scrolling during video playback.
 * Scrolls annotation elements into view with smooth behavior when video time changes.
 */

import { fromPromise } from "xstate";
import type { Annotation } from "../types";

/**
 * Input configuration for the scrollController actor.
 */
export interface ScrollControllerInput {
  /** The transcript container element to scroll */
  scrollContainer: HTMLElement;
  /** Target annotation to scroll into view */
  targetAnnotation: Annotation;
}

/**
 * scrollController actor implementation.
 * Finds annotation element in DOM and scrolls it into view smoothly.
 *
 * Follows ScrollyVideo.js pattern: simple scrollIntoView, no complex coordination.
 */
export const scrollController = fromPromise(
  async ({ input }: { input: ScrollControllerInput }) => {
    const { scrollContainer, targetAnnotation } = input;

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
