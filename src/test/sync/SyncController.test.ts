import { describe, it, expect, vi, afterEach } from "vitest";
import { SyncController } from "../../lib/sync/SyncController.svelte";
import type { IIIFMediaViewerRef, Annotation } from "../../lib/sync/types";

// Regression tests for issue #55: media-driven auto-scroll fired on the first
// time-update poll at t=0, before playback started, scrolling the page to the
// transcript on load.

const annotations: Annotation[] = [
  { id: "a1", startTime: 0, endTime: 5, text: "First" },
  { id: "a2", startTime: 5, endTime: 10, text: "Second" },
  { id: "a3", startTime: 10, endTime: 15, text: "Third" },
];

function createMockViewer(getCurrentTime: () => number): IIIFMediaViewerRef {
  return {
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(getCurrentTime),
    getDuration: vi.fn(() => 60),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    isReady: vi.fn(() => true),
  };
}

type Segments = { a1: HTMLElement; a2: HTMLElement; a3: HTMLElement };

/** A scroll container holding one element per annotation, each with a spied scrollIntoView. */
function createContainer(): { container: HTMLElement; segments: Segments } {
  const container = document.createElement("div");
  const make = (id: string): HTMLElement => {
    const el = document.createElement("div");
    el.setAttribute("data-annotation-id", id);
    el.scrollIntoView = vi.fn();
    container.appendChild(el);
    return el;
  };
  return {
    container,
    segments: { a1: make("a1"), a2: make("a2"), a3: make("a3") },
  };
}

describe("SyncController media-driven auto-scroll", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not auto-scroll while the media sits at its initial time", async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer(() => 0);
    const { container, segments } = createContainer();
    const ctrl = new SyncController();
    ctrl.initialize(viewer, container, annotations);

    // Several polling ticks at t=0, paused
    await vi.advanceTimersByTimeAsync(1000);

    expect(segments.a1.scrollIntoView).not.toHaveBeenCalled();
    expect(segments.a2.scrollIntoView).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it("auto-scrolls once playback has advanced the time", async () => {
    vi.useFakeTimers();
    let time = 0;
    const viewer = createMockViewer(() => time);
    const { container, segments } = createContainer();
    const ctrl = new SyncController();
    ctrl.initialize(viewer, container, annotations);

    await vi.advanceTimersByTimeAsync(300);
    expect(segments.a1.scrollIntoView).not.toHaveBeenCalled();

    // Playback starts and crosses into the second annotation
    time = 6;
    await vi.advanceTimersByTimeAsync(300);

    expect(segments.a2.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "center" }),
    );
    ctrl.destroy();
  });

  it("keeps auto-scrolling after playback has started even when time is momentarily constant", async () => {
    vi.useFakeTimers();
    let time = 0;
    const viewer = createMockViewer(() => time);
    const { container, segments } = createContainer();
    const ctrl = new SyncController();
    ctrl.initialize(viewer, container, annotations);

    time = 1; // playback started, still inside a1
    await vi.advanceTimersByTimeAsync(300);
    // pause inside a1 for a while
    await vi.advanceTimersByTimeAsync(1000);
    // resume and cross into a3
    time = 11;
    await vi.advanceTimersByTimeAsync(300);

    expect(segments.a3.scrollIntoView).toHaveBeenCalled();
    ctrl.destroy();
  });

  it("setAutoScrollEnabled sends SET_AUTO_SCROLL_ENABLED to the underlying actor", () => {
    const viewer = createMockViewer(() => 0);
    const { container } = createContainer();
    const ctrl = new SyncController();
    ctrl.initialize(viewer, container, annotations);

    ctrl.setAutoScrollEnabled(false);

    // @ts-expect-error -- reaching into the private actor field for this one assertion
    const ctx = ctrl.actor!.getSnapshot().context;
    expect(ctx.autoScrollEnabled).toBe(false);

    ctrl.destroy();
  });
});
