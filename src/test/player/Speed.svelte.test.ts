import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Speed from "../../lib/player/Speed.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";

describe("Speed", () => {
  test("renders speed select", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Speed },
    });
    flushSync();

    const select = container.querySelector("select");
    expect(select).not.toBeNull();
  });

  test("shows all rate options", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: Speed,
        props: { rates: [0.5, 1, 1.5, 2] },
      },
    });
    flushSync();

    const options = container.querySelectorAll("option");
    expect(options).toHaveLength(4);
  });

  test("calls setPlaybackRate when changed", () => {
    const setPlaybackRateFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { playbackRate: 1, isReady: true },
      actions: { setPlaybackRate: setPlaybackRateFn },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Speed },
    });
    flushSync();

    const select = container.querySelector("select") as HTMLSelectElement;
    select.value = "1.5";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();

    expect(setPlaybackRateFn).toHaveBeenCalledWith(1.5);
  });

  test("is disabled when media not ready", () => {
    const ctx = createMockPlayerContext({ state: { isReady: false } });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Speed },
    });
    flushSync();

    const select = container.querySelector("select");
    expect(select?.disabled).toBe(true);
  });
});
