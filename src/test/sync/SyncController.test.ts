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

  it("setScrollToSeekEnabled sends SET_SCROLL_TO_SEEK_ENABLED to the underlying actor", () => {
    const viewer = createMockViewer(() => 0);
    const { container } = createContainer();
    const ctrl = new SyncController();
    ctrl.initialize(viewer, container, annotations);

    ctrl.setScrollToSeekEnabled(false);

    // @ts-expect-error -- reaching into the private actor field for this one assertion
    const ctx = ctrl.actor!.getSnapshot().context;
    expect(ctx.scrollToSeekEnabled).toBe(false);

    ctrl.destroy();
  });
});

// docs/specs/transcript-reading-mode.md "Lifecycle and accessibility":
// "Returning, browsing search results, and consumer scrollToAnnotation
// calls are programmatic transcript movement; they must never feed back
// into scroll-to-seek, including after a smooth-scroll animation ends."
describe("SyncController user-scroll reporting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function createScrollableContainer(): HTMLElement {
    const container = document.createElement("div");
    Object.defineProperty(container, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(container, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    });
    return container;
  }

  it("calls onUserScroll for a genuine scroll event", () => {
    const viewer = createMockViewer(() => 0);
    const container = createScrollableContainer();
    const onUserScroll = vi.fn();
    const ctrl = new SyncController({ onUserScroll });
    ctrl.initialize(viewer, container, annotations);

    container.scrollTop = 500;
    container.dispatchEvent(new Event("scroll"));

    expect(onUserScroll).toHaveBeenCalledTimes(1);
    ctrl.destroy();
  });

  it("does not call onUserScroll for a scroll suppressed as an echo of a programmatic scroll", () => {
    const viewer = createMockViewer(() => 0);
    const container = createScrollableContainer();
    const onUserScroll = vi.fn();
    const ctrl = new SyncController({ onUserScroll });
    ctrl.initialize(viewer, container, annotations);

    ctrl.notifyProgrammaticScroll();
    container.scrollTop = 500;
    container.dispatchEvent(new Event("scroll"));

    expect(onUserScroll).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it("suppresses echoes throughout a smooth scroll that outlasts the fallback window, releasing on scrollend", async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer(() => 0);
    const container = createScrollableContainer();
    const onUserScroll = vi.fn();
    const ctrl = new SyncController({ onUserScroll });
    ctrl.initialize(viewer, container, annotations);

    ctrl.notifyProgrammaticScroll();

    // A long smooth scroll emits echo events continuously, well past 1s. Each
    // echo re-arms the settle fallback, so no echo may be reclassified as a
    // user scroll mid-animation, however long the scroll runs.
    for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
      await vi.advanceTimersByTimeAsync(100);
      container.scrollTop += 25;
      container.dispatchEvent(new Event("scroll"));
    }
    expect(onUserScroll).not.toHaveBeenCalled();

    // The animation settles: scrollend closes the transaction; a later genuine
    // scroll is reported.
    container.dispatchEvent(new Event("scrollend"));
    await vi.advanceTimersByTimeAsync(300);
    container.scrollTop += 25;
    container.dispatchEvent(new Event("scroll"));
    expect(onUserScroll).toHaveBeenCalledTimes(1);

    ctrl.destroy();
  });

  it("releases the transaction a settle period after scrolling stops, without a scrollend event", async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer(() => 0);
    const container = createScrollableContainer();
    const onUserScroll = vi.fn();
    const ctrl = new SyncController({ onUserScroll });
    ctrl.initialize(viewer, container, annotations);

    ctrl.notifyProgrammaticScroll();

    // Echoes past 1s, then scrolling stops. No scrollend is dispatched (engines
    // without scrollend support). The quiet-period fallback must close the
    // transaction — but only after the echoes stop, never during them.
    for (let elapsed = 0; elapsed < 1500; elapsed += 100) {
      await vi.advanceTimersByTimeAsync(100);
      container.scrollTop += 25;
      container.dispatchEvent(new Event("scroll"));
    }
    expect(onUserScroll).not.toHaveBeenCalled();

    // A quiet settle period with no further echoes closes the transaction.
    await vi.advanceTimersByTimeAsync(300);
    container.scrollTop += 25;
    container.dispatchEvent(new Event("scroll"));
    expect(onUserScroll).toHaveBeenCalledTimes(1);

    ctrl.destroy();
  });

  it("collapses overlapping programmatic scrolls into one transaction with no premature close", async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer(() => 0);
    const container = createScrollableContainer();
    const onUserScroll = vi.fn();
    const ctrl = new SyncController({ onUserScroll });
    ctrl.initialize(viewer, container, annotations);

    // Rapid successive programmatic scrolls (e.g. repeated next-match presses).
    ctrl.notifyProgrammaticScroll();
    await vi.advanceTimersByTimeAsync(50);
    ctrl.notifyProgrammaticScroll();

    // Echoes from the ongoing animation stay suppressed under the newest
    // transaction; the earlier transaction's listener was removed, so nothing
    // closes the newer one prematurely.
    for (let elapsed = 0; elapsed < 400; elapsed += 100) {
      await vi.advanceTimersByTimeAsync(100);
      container.scrollTop += 25;
      container.dispatchEvent(new Event("scroll"));
    }
    expect(onUserScroll).not.toHaveBeenCalled();

    container.dispatchEvent(new Event("scrollend"));
    await vi.advanceTimersByTimeAsync(300);
    container.scrollTop += 25;
    container.dispatchEvent(new Event("scroll"));
    expect(onUserScroll).toHaveBeenCalledTimes(1);

    ctrl.destroy();
  });
});
