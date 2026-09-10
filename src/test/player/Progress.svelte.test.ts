import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Progress from "../../lib/player/Progress.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";

describe("Progress", () => {
  test("renders range input with data attribute", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Progress },
    });
    flushSync();

    const input = container.querySelector("input[data-audio-progress]");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("type")).toBe("range");
  });

  test("reflects current time as input value", () => {
    const ctx = createMockPlayerContext({
      state: { currentTime: 30, duration: 120, isReady: true },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Progress },
    });
    flushSync();

    const input = container.querySelector(
      "input[data-audio-progress]",
    ) as HTMLInputElement;
    expect(input.value).toBe("30");
    expect(input.max).toBe("120");
  });

  test("calls seekTo on input event", () => {
    const seekToFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { currentTime: 0, duration: 120, isReady: true },
      actions: { seekTo: seekToFn },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Progress },
    });
    flushSync();

    const input = container.querySelector(
      "input[data-audio-progress]",
    ) as HTMLInputElement;

    // Simulate user dragging to 60s
    input.value = "60";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(seekToFn).toHaveBeenCalledWith(60);
  });

  test("sets min and max from player state", () => {
    const ctx = createMockPlayerContext({
      state: { currentTime: 0, duration: 240, isReady: true },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Progress },
    });
    flushSync();

    const input = container.querySelector(
      "input[data-audio-progress]",
    ) as HTMLInputElement;
    expect(input.min).toBe("0");
    expect(input.max).toBe("240");
  });

  test("has accessible label", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Progress },
    });
    flushSync();

    const input = container.querySelector(
      "input[data-audio-progress]",
    ) as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Playback progress");
  });
});
