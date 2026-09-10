import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import PlayButton from "../../lib/player/PlayButton.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";

// render() from vitest-browser-svelte auto-unmounts every mounted component
// in a beforeEach cleanup, so these tests need no manual target/afterEach
// teardown. TestContextHarness sets the player context and renders the
// component under test with the given props.
describe("PlayButton", () => {
  test('shows "Play" when paused', () => {
    const ctx = createMockPlayerContext({ state: { isPlaying: false } });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Play");
  });

  test('shows "Pause" when playing', () => {
    const ctx = createMockPlayerContext({
      state: { isPlaying: true, isReady: true },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Pause");
  });

  test("calls play action when clicked while paused", () => {
    const playFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { isPlaying: false, isReady: true },
      actions: { play: playFn },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton },
    });
    flushSync();

    const button = container.querySelector("button")!;
    button.click();
    flushSync();

    expect(playFn).toHaveBeenCalled();
  });

  test("calls pause action when clicked while playing", () => {
    const pauseFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { isPlaying: true, isReady: true },
      actions: { pause: pauseFn },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton },
    });
    flushSync();

    const button = container.querySelector("button")!;
    button.click();
    flushSync();

    expect(pauseFn).toHaveBeenCalled();
  });

  test("shows buffering state when isBuffering is true", () => {
    const ctx = createMockPlayerContext({
      state: { isBuffering: true, isReady: true, isPlaying: false },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Loading");
  });

  test("shows custom string for play prop", () => {
    const ctx = createMockPlayerContext({ state: { isPlaying: false } });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton, props: { play: "Start!" } },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Start!");
  });

  test("shows custom string for pause prop", () => {
    const ctx = createMockPlayerContext({
      state: { isPlaying: true, isReady: true },
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: PlayButton,
        props: { pause: "Stop!" },
      },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Stop!");
  });

  test("shows custom string for loading prop", () => {
    const ctx = createMockPlayerContext({
      state: { isBuffering: true, isReady: true, isPlaying: false },
    });

    const { container } = render(TestContextHarness, {
      props: {
        context: ctx,
        component: PlayButton,
        props: { loading: "Buffering..." },
      },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Buffering...");
  });

  test("is disabled when media not ready", () => {
    const ctx = createMockPlayerContext({ state: { isReady: false } });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: PlayButton },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button?.disabled).toBe(true);
  });
});
