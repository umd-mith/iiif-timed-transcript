import { describe, it, expect, vi } from "vitest";
import { createActor } from "xstate";
import { videoController } from "../../lib/sync/actors/videoController";
import type { IIIFMediaViewerRef } from "../../lib/sync/types";

function createMockViewer(
  overrides: Partial<IIIFMediaViewerRef> = {},
): IIIFMediaViewerRef {
  return {
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 60),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    isReady: vi.fn(() => true),
    ...overrides,
  };
}

/** Wait for a promise actor to complete. */
function waitForDone(
  actor: ReturnType<typeof createActor<typeof videoController>>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    actor.subscribe({
      complete: () => resolve(),
    });
  });
}

describe("videoController actor", () => {
  it("seeks to target time when viewer is ready", async () => {
    const viewer = createMockViewer();
    const actor = createActor(videoController, {
      input: { viewer, targetTime: 30 },
    });

    actor.start();
    await waitForDone(actor);

    expect(viewer.seekTo).toHaveBeenCalledWith(30);
  });

  it("clamps target time to [0, duration]", async () => {
    const viewer = createMockViewer({ getDuration: vi.fn(() => 60) });
    const actor = createActor(videoController, {
      input: { viewer, targetTime: 100 },
    });

    actor.start();
    await waitForDone(actor);

    // 100 > 60, clamped to 60, then 60-59=1 < 1, so seeks to 59
    expect(viewer.seekTo).toHaveBeenCalledWith(59);
  });

  it("handles near-end seeks by backing off 1 second", async () => {
    const viewer = createMockViewer({ getDuration: vi.fn(() => 60) });
    const actor = createActor(videoController, {
      input: { viewer, targetTime: 59.5 },
    });

    actor.start();
    await waitForDone(actor);

    // 60 - 59.5 = 0.5 < 1, so seeks to 59
    expect(viewer.seekTo).toHaveBeenCalledWith(59);
  });

  it("waits for viewer to become ready", async () => {
    let readyCount = 0;
    const viewer = createMockViewer({
      isReady: vi.fn(() => {
        readyCount++;
        return readyCount > 3; // Ready after 3 polls
      }),
    });

    const actor = createActor(videoController, {
      input: { viewer, targetTime: 10 },
    });

    actor.start();
    await waitForDone(actor);

    expect(viewer.seekTo).toHaveBeenCalledWith(10);
    expect(readyCount).toBeGreaterThan(3);
  });

  it("times out if viewer never becomes ready", async () => {
    const viewer = createMockViewer({
      isReady: vi.fn(() => false), // Never ready
    });

    vi.useFakeTimers();

    const actor = createActor(videoController, {
      input: { viewer, targetTime: 10 },
    });

    actor.subscribe({
      error: () => {
        // Expected — timeout error
      },
    });
    actor.start();

    // Advance past the 5-second timeout
    await vi.advanceTimersByTimeAsync(6000);

    expect(viewer.seekTo).not.toHaveBeenCalled();
    // The actor should have errored
    expect(actor.getSnapshot().status).toBe("error");

    vi.useRealTimers();
  });
});
