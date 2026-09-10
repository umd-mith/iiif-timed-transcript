import { describe, test, expect, vi } from "vitest";
import { flushSync, type Component } from "svelte";
import { render } from "vitest-browser-svelte";
import Skip from "../../lib/player/Skip.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";

describe("Skip", () => {
  test("renders skip button", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: Skip as Component,
        props: { seconds: 10 },
      },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
  });

  test("shows forward label for positive seconds", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: Skip as Component,
        props: { seconds: 30 },
      },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("+30s");
  });

  test("shows backward label for negative seconds", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: Skip as Component,
        props: { seconds: -10 },
      },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("-10s");
  });

  test("calls seekTo with currentTime + seconds when clicked", () => {
    const seekToFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { currentTime: 30, isReady: true },
      actions: { seekTo: seekToFn },
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: Skip as Component,
        props: { seconds: 10 },
      },
    });
    flushSync();

    const button = container.querySelector("button")!;
    button.click();
    flushSync();

    // Should seek to 30 + 10 = 40
    expect(seekToFn).toHaveBeenCalledWith(40);
  });

  test("is disabled when media not ready", () => {
    const ctx = createMockPlayerContext({ state: { isReady: false } });

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: Skip as Component,
        props: { seconds: 10 },
      },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.disabled).toBe(true);
  });
});
