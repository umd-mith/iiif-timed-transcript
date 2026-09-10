import { describe, it, expect, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import { syncMachine } from "../../lib/sync/syncMachine";
import type { IIIFMediaViewerRef, Annotation } from "../../lib/sync/types";

// Test fixtures
const annotations: Annotation[] = [
  { id: "a1", startTime: 0, endTime: 5, text: "First" },
  { id: "a2", startTime: 5, endTime: 10, text: "Second" },
  { id: "a3", startTime: 10, endTime: 15, text: "Third" },
];

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

function createMockScrollContainer(): HTMLElement {
  const el = document.createElement("div");
  // Mock scroll dimensions
  Object.defineProperty(el, "scrollHeight", {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", { value: 200, configurable: true });
  Object.defineProperty(el, "scrollTop", { value: 0, writable: true });
  // Mock querySelector for scrollController actor
  el.querySelector = vi.fn(() => {
    const segment = document.createElement("div");
    segment.scrollIntoView = vi.fn();
    return segment;
  });
  return el;
}

describe("syncMachine", () => {
  describe("initial state", () => {
    it("starts in idle", () => {
      const actor = createActor(syncMachine);
      actor.start();
      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });

    it("has correct initial context", () => {
      const actor = createActor(syncMachine);
      actor.start();
      const ctx = actor.getSnapshot().context;
      expect(ctx.currentTime).toBe(0);
      expect(ctx.annotationIndex).toBe(-1);
      expect(ctx.viewer).toBeNull();
      expect(ctx.scrollContainer).toBeNull();
      expect(ctx.annotations).toEqual([]);
      expect(ctx.priorityLockDuration).toBe(1000);
      actor.stop();
    });
  });

  describe("INITIALIZE transition", () => {
    it("transitions from idle to ready", () => {
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      expect(actor.getSnapshot().value).toBe("ready");
      actor.stop();
    });

    it("stores viewer, scrollContainer, and annotations in context", () => {
      const viewer = createMockViewer();
      const scrollContainer = createMockScrollContainer();
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({
        type: "INITIALIZE",
        viewer,
        scrollContainer,
        annotations,
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.viewer).toBe(viewer);
      expect(ctx.scrollContainer).toBe(scrollContainer);
      expect(ctx.annotations).toBe(annotations);
      actor.stop();
    });

    it("accepts custom priorityLockDuration", () => {
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
        priorityLockDuration: 2000,
      });

      expect(actor.getSnapshot().context.priorityLockDuration).toBe(2000);
      actor.stop();
    });

    it("uses default priorityLockDuration when not provided", () => {
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      expect(actor.getSnapshot().context.priorityLockDuration).toBe(1000);
      actor.stop();
    });
  });

  describe("RESET transition", () => {
    it("transitions from ready to idle", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });

    it("clears context on reset", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({ type: "RESET" });

      const ctx = actor.getSnapshot().context;
      expect(ctx.viewer).toBeNull();
      expect(ctx.scrollContainer).toBeNull();
      expect(ctx.annotations).toEqual([]);
      expect(ctx.currentTime).toBe(0);
      expect(ctx.annotationIndex).toBe(-1);
      actor.stop();
    });
  });

  describe("annotationChanged guard", () => {
    it("transitions to mediaDriven when annotation changes", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      // Send time update within first annotation range
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });

      expect(actor.getSnapshot().value).toBe("mediaDriven");
      actor.stop();
    });

    it("does not transition when time is in a gap (no active annotation)", () => {
      const gappedAnnotations: Annotation[] = [
        { id: "a1", startTime: 0, endTime: 5, text: "First" },
        { id: "a2", startTime: 20, endTime: 25, text: "Second" },
      ];

      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations: gappedAnnotations,
      });

      // Send time update in gap — should stay in ready
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 10 });

      expect(actor.getSnapshot().value).toBe("ready");
      actor.stop();
    });

    it("does not re-enter mediaDriven when a later time stays in the same annotation", async () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      // First update at t=2 enters annotation 0 (a1: 0–5) → mediaDriven.
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });
      // scrollController is a promise actor; await the return to ready.
      await waitFor(actor, (s) => s.value === "ready");
      expect(actor.getSnapshot().context.annotationIndex).toBe(0);

      // Second update at t=3 is still inside annotation 0 — index unchanged,
      // so annotationChanged must block the transition and the machine stays
      // in ready rather than re-triggering a scroll.
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 3 });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.annotationIndex).toBe(0);
      actor.stop();
    });
  });

  describe("canSyncToVideo guard", () => {
    it("allows scroll when no priority lock is held", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      // Send scroll event — should transition to scrollDriven
      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      expect(actor.getSnapshot().value).toBe("scrollDriven");
      actor.stop();
    });

    it("blocks a scroll that arrives while the media priority lock is still held", async () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
        // Long lock so it is unambiguously still held when the scroll arrives.
        priorityLockDuration: 10000,
      });

      // Acquire the media priority lock, then wait for scrollController to
      // complete so the machine is back in ready and able to receive a scroll.
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });
      await waitFor(actor, (s) => s.value === "ready");
      expect(actor.getSnapshot().context.syncPriority.direction).toBe("media");

      // A competing scroll arrives while the media lock is still active.
      // canSyncToVideo must reject it: the machine stays in ready and does
      // NOT switch to scrollDriven.
      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      expect(actor.getSnapshot().value).toBe("ready");
      expect(actor.getSnapshot().context.syncPriority.direction).toBe("media");
      actor.stop();
    });

    it("allows scroll once the media priority lock has expired", async () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
        priorityLockDuration: 0, // Expire immediately
      });

      // Acquire media priority, then return to ready.
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });
      await waitFor(actor, (s) => s.value === "ready");

      // With a 0ms lock duration the lock is already expired, so the next
      // scroll passes canSyncToVideo and drives the machine to scrollDriven.
      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      expect(actor.getSnapshot().value).toBe("scrollDriven");
      expect(actor.getSnapshot().context.syncPriority.direction).toBe("scroll");
      actor.stop();
    });
  });

  describe("scrollDriven state", () => {
    it("updates scroll progress and target time in context", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.scrollPosition).toBe(0.5);
      // targetTime is computed via scrollProgressToTime, not mappedTime
      expect(ctx.targetTime).toBeGreaterThan(0);
      actor.stop();
    });

    it("acquires scroll priority on scroll", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.syncPriority.direction).toBe("scroll");
      expect(ctx.syncPriority.timestamp).toBeGreaterThan(0);
      actor.stop();
    });

    it("handles RESET from scrollDriven state", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });
      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  describe("mediaDriven state", () => {
    it("acquires media priority on video time update", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });

      const ctx = actor.getSnapshot().context;
      expect(ctx.syncPriority.direction).toBe("media");
      actor.stop();
    });

    it("updates annotation index when entering mediaDriven", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 7 });

      const ctx = actor.getSnapshot().context;
      // currentTime 7 falls in annotation a2 (5-10), which is index 1
      expect(ctx.annotationIndex).toBe(1);
      actor.stop();
    });

    it("handles RESET from mediaDriven state", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });
      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  describe("error recovery", () => {
    it("has onError handlers configured for actor invocations", () => {
      const states = syncMachine.config.states!;
      const mediaDriven = states.mediaDriven as {
        invoke?: { onError?: unknown };
      };
      const scrollDriven = states.scrollDriven as {
        invoke?: { onError?: unknown };
      };
      expect(mediaDriven.invoke?.onError).toBeDefined();
      expect(scrollDriven.invoke?.onError).toBeDefined();
    });
  });

  describe("idle ignores non-INITIALIZE events", () => {
    it("ignores VIDEO_TIME_UPDATE in idle", () => {
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 5 });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });

    it("ignores TRANSCRIPT_SCROLL in idle", () => {
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({
        type: "TRANSCRIPT_SCROLL",
        scrollProgress: 0.5,
        mappedTime: 7.5,
      });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });

    it("ignores RESET in idle", () => {
      const actor = createActor(syncMachine);
      actor.start();

      actor.send({ type: "RESET" });

      expect(actor.getSnapshot().value).toBe("idle");
      actor.stop();
    });
  });

  describe("autoScrollEnabled gate", () => {
    function createMockScrollContainerWithSpy(
      scrollIntoView: ReturnType<typeof vi.fn>,
    ): HTMLElement {
      const el = document.createElement("div");
      const segment = document.createElement("div");
      segment.scrollIntoView =
        scrollIntoView as unknown as typeof segment.scrollIntoView;
      el.querySelector = vi.fn(() => segment);
      return el;
    }

    it("defaults autoScrollEnabled to true", () => {
      const actor = createActor(syncMachine);
      actor.start();
      expect(actor.getSnapshot().context.autoScrollEnabled).toBe(true);
      actor.stop();
    });

    it("SET_AUTO_SCROLL_ENABLED updates context from any state", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });

      actor.send({ type: "SET_AUTO_SCROLL_ENABLED", enabled: false });

      expect(actor.getSnapshot().context.autoScrollEnabled).toBe(false);
      actor.stop();
    });

    it("scrollController does not scroll when autoScrollEnabled is false", async () => {
      const scrollIntoView = vi.fn();
      const scrollContainer = createMockScrollContainerWithSpy(scrollIntoView);
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer,
        annotations,
      });
      actor.send({ type: "SET_AUTO_SCROLL_ENABLED", enabled: false });

      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });

      await vi.waitFor(() => {
        expect(actor.getSnapshot().value).toBe("ready");
      });
      expect(scrollIntoView).not.toHaveBeenCalled();
      actor.stop();
    });

    it("scrollController still scrolls when autoScrollEnabled is true (default)", async () => {
      const scrollIntoView = vi.fn();
      const scrollContainer = createMockScrollContainerWithSpy(scrollIntoView);
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer,
        annotations,
      });

      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 2 });

      await vi.waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
      });
      actor.stop();
    });

    it("acquires media priority and tracks annotationIndex even when disabled (only the scroll itself is gated)", () => {
      const actor = createActor(syncMachine);
      actor.start();
      actor.send({
        type: "INITIALIZE",
        viewer: createMockViewer(),
        scrollContainer: createMockScrollContainer(),
        annotations,
      });
      actor.send({ type: "SET_AUTO_SCROLL_ENABLED", enabled: false });

      actor.send({ type: "VIDEO_TIME_UPDATE", currentTime: 7 });

      const ctx = actor.getSnapshot().context;
      expect(ctx.syncPriority.direction).toBe("media");
      expect(ctx.annotationIndex).toBe(1);
      actor.stop();
    });
  });
});
