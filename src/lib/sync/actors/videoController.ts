/**
 * videoController Actor
 *
 * XState actor that manages video seeking operations with retry logic,
 * viewer readiness checking, and boundary handling.
 */

import { fromPromise } from "xstate";
import type { IIIFMediaViewerRef } from "../types";

/**
 * Input configuration for the videoController actor.
 */
export interface VideoControllerInput {
  /** The media viewer instance to control */
  viewer: IIIFMediaViewerRef;
  /** Target time to seek to (seconds) */
  targetTime: number;
}

/**
 * Wait for the viewer to be ready with polling.
 * Polls isReady() until it returns true.
 */
async function waitForReady(viewer: IIIFMediaViewerRef): Promise<void> {
  const pollInterval = 50; // Poll every 50ms

  while (!viewer.isReady()) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

/**
 * videoController actor implementation.
 * Waits for viewer readiness and performs seek operation with clamping
 * and near-end handling.
 */
export const videoController = fromPromise(
  async ({ input }: { input: VideoControllerInput }) => {
    const { viewer, targetTime } = input;

    // Wait for viewer to be ready
    await waitForReady(viewer);

    // Get duration and clamp targetTime to valid range [0, duration]
    const duration = viewer.getDuration();
    let clampedTime = Math.max(0, Math.min(targetTime, duration));

    // Special handling for seeks near the end (within 1 second)
    // Seek to duration-1 to avoid player issues with end-of-media
    if (duration - clampedTime < 1) {
      clampedTime = duration - 1;
    }

    // Perform seek with adjusted time
    viewer.seekTo(clampedTime);
  },
);
