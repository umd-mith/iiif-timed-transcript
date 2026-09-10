/**
 * videoController Actor
 *
 * XState actor that manages video seeking operations with viewer readiness
 * checking and boundary handling.
 */

import { fromPromise } from "xstate";
import type { IIIFMediaViewerRef } from "../types.js";

/**
 * Input configuration for the videoController actor.
 */
export interface VideoControllerInput {
  /** The media viewer instance to control */
  viewer: IIIFMediaViewerRef;
  /** Target time to seek to (seconds) */
  targetTime: number;
  /**
   * Scroll-to-seek policy epoch captured when this seek was queued (when
   * `scrollDriven` was entered). Compared against the live epoch —
   * `getCurrentEpoch()` — immediately before `seekTo()`, so a seek queued
   * while scrolling drops silently if the policy (`scrollToSeek` /
   * reading mode) changed while this actor was still awaiting readiness. A
   * transition guard on the *next* event would be too late: this promise
   * calls `seekTo()` itself, before it resolves.
   */
  queuedEpoch: number;
  /** Reads the parent machine's live epoch at call time — not a snapshot. */
  getCurrentEpoch: () => number;
}

/**
 * Wait for the viewer to be ready with polling.
 * Polls isReady() until it returns true, with a 5-second timeout.
 */
async function waitForReady(viewer: IIIFMediaViewerRef): Promise<void> {
  const pollInterval = 50; // Poll every 50ms
  const timeout = 5000;
  let elapsed = 0;

  while (!viewer.isReady()) {
    if (elapsed >= timeout) {
      throw new Error("Viewer did not become ready within 5 seconds");
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    elapsed += pollInterval;
  }
}

/**
 * videoController actor implementation.
 * Waits for viewer readiness and performs seek operation with clamping
 * and near-end handling.
 */
export const videoController = fromPromise(
  async ({ input }: { input: VideoControllerInput }) => {
    const { viewer, targetTime, queuedEpoch, getCurrentEpoch } = input;

    // Wait for viewer to be ready
    await waitForReady(viewer);

    // The policy check runs immediately before the seek — a state
    // transition guard elsewhere would be too late, since this promise is
    // what calls seekTo(), before it resolves. Drop the seek silently if
    // the scroll-to-seek policy changed while this actor was awaiting
    // readiness (docs/specs/transcript-reading-mode.md, "Toggle policy off
    // while a scroll-driven seek awaits readiness").
    if (getCurrentEpoch() !== queuedEpoch) {
      return;
    }

    // Get duration and clamp targetTime to valid range [0, duration]
    const duration = viewer.getDuration();
    let clampedTime = Math.max(0, Math.min(targetTime, duration));

    // Special handling for seeks near the end (within 1 second)
    // Seek to duration-1 to avoid player issues with end-of-media
    if (duration - clampedTime < 1) {
      clampedTime = duration - 1;
    }

    // Re-enforce the lower bound: for durations shorter than the 1s backoff,
    // the adjustment above can go negative (e.g. duration 0.5 -> -0.5). The
    // seek must stay within [0, duration].
    clampedTime = Math.max(0, clampedTime);

    // Perform seek with adjusted time
    viewer.seekTo(clampedTime);
  },
);
