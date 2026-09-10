import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";
import type { CanvasInfo } from "../../lib/player/context";

const twoCanvases: CanvasInfo[] = [
  {
    index: 0,
    id: "https://example.com/canvas/1",
    label: "Part 1",
    duration: 90,
    mediaType: "audio",
  },
  {
    index: 1,
    id: "https://example.com/canvas/2",
    label: "Part 2",
    duration: 120,
    mediaType: "video",
  },
];

describe("CanvasNav", () => {
  test("renders canvas buttons from context", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({
      canvasCount: 2,
      canvases: twoCanvases,
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const buttons = container.querySelectorAll("[data-canvas-index]");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.getAttribute("data-canvas-index")).toBe("0");
    expect(buttons[1]!.getAttribute("data-canvas-index")).toBe("1");
  });

  test("displays canvas label and duration", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({
      canvasCount: 2,
      canvases: twoCanvases,
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const firstButton = container.querySelector('[data-canvas-index="0"]')!;
    expect(firstButton.querySelector(".canvas-label")?.textContent).toBe(
      "Part 1",
    );
    expect(
      firstButton.querySelector(".canvas-duration")?.textContent,
    ).toContain("1:30");

    const secondButton = container.querySelector('[data-canvas-index="1"]')!;
    expect(secondButton.querySelector(".canvas-label")?.textContent).toBe(
      "Part 2",
    );
    expect(
      secondButton.querySelector(".canvas-duration")?.textContent,
    ).toContain("2:00");
  });

  test('marks active canvas with data-state="active"', async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({
      canvasIndex: 1,
      canvasCount: 2,
      canvases: twoCanvases,
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const cv0 = container.querySelector('[data-canvas-index="0"]');
    const cv1 = container.querySelector('[data-canvas-index="1"]');
    expect(cv0?.getAttribute("data-state")).toBe("inactive");
    expect(cv0?.hasAttribute("aria-current")).toBe(false);
    expect(cv1?.getAttribute("data-state")).toBe("active");
    expect(cv1?.getAttribute("aria-current")).toBe("true");
  });

  test("clicking canvas calls switchCanvas", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({
      canvasCount: 2,
      canvases: twoCanvases,
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const secondButton = container.querySelector(
      '[data-canvas-index="1"]',
    ) as HTMLElement;
    secondButton.click();

    expect(ctx.actions.switchCanvas).toHaveBeenCalledWith(1);
  });

  test("clicking canvas fires onCanvasChange callback", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({
      canvasCount: 2,
      canvases: twoCanvases,
    });
    const onCanvasChange = vi.fn();

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: CanvasNav,
        props: { onCanvasChange },
      },
    });
    flushSync();

    const secondButton = container.querySelector(
      '[data-canvas-index="1"]',
    ) as HTMLElement;
    secondButton.click();

    expect(onCanvasChange).toHaveBeenCalledWith(twoCanvases[1]);
  });

  test("renders nothing for single-canvas manifest (no empty snippet)", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({
      canvasCount: 1,
      canvases: [twoCanvases[0]!],
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const buttons = container.querySelectorAll("[data-canvas-index]");
    expect(buttons).toHaveLength(0);
    // Nav exists but is empty
    const nav = container.querySelector(".canvas-nav");
    expect(nav).not.toBeNull();
    expect(nav?.children).toHaveLength(0);
  });

  test("renders nothing for zero canvases", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const ctx = createMockPlayerContext({ canvasCount: 0, canvases: [] });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const buttons = container.querySelectorAll("[data-canvas-index]");
    expect(buttons).toHaveLength(0);
  });

  test("omits duration span when canvas has no duration", async () => {
    const { default: CanvasNav } =
      await import("../../lib/player/CanvasNav.svelte");
    const noDurationCanvases: CanvasInfo[] = [
      { index: 0, id: "c1", label: "A", mediaType: "audio" },
      { index: 1, id: "c2", label: "B", mediaType: "video" },
    ];
    const ctx = createMockPlayerContext({
      canvasCount: 2,
      canvases: noDurationCanvases,
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: CanvasNav },
    });
    flushSync();

    const durations = container.querySelectorAll(".canvas-duration");
    expect(durations).toHaveLength(0);
  });
});
