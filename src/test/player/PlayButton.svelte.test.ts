import { describe, test, expect, vi, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import PlayButton from "../../lib/player/PlayButton.svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import { createMockPlayerContext, createChildSnippet } from "./test-utils";

describe("PlayButton", () => {
  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test('shows "Play" when paused', () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({ state: { isPlaying: false } });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("Play");
  });

  test('shows "Pause" when playing', () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({
      state: { isPlaying: true, isReady: true },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("Pause");
  });

  test("calls play action when clicked while paused", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const playFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { isPlaying: false, isReady: true },
      actions: { play: playFn },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton),
      },
    });
    flushSync();

    const button = target.querySelector("button")!;
    button.click();
    flushSync();

    expect(playFn).toHaveBeenCalled();
  });

  test("calls pause action when clicked while playing", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const pauseFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { isPlaying: true, isReady: true },
      actions: { pause: pauseFn },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton),
      },
    });
    flushSync();

    const button = target.querySelector("button")!;
    button.click();
    flushSync();

    expect(pauseFn).toHaveBeenCalled();
  });

  test("shows buffering state when isBuffering is true", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({
      state: { isBuffering: true, isReady: true, isPlaying: false },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("Loading");
  });

  test("shows custom string for play prop", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({ state: { isPlaying: false } });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton, { play: "Start!" }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("Start!");
  });

  test("shows custom string for pause prop", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({
      state: { isPlaying: true, isReady: true },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton, { pause: "Stop!" }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("Stop!");
  });

  test("shows custom string for loading prop", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({
      state: { isBuffering: true, isReady: true, isPlaying: false },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton, {
          loading: "Buffering...",
        }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("Buffering...");
  });

  test("is disabled when media not ready", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({ state: { isReady: false } });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, PlayButton),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.disabled).toBe(true);
  });
});
