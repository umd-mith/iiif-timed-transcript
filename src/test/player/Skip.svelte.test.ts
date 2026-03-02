import { describe, test, expect, vi, afterEach } from "vitest";
import { mount, type Component } from "svelte";
import { flushSync } from "svelte";
import Skip from "../../lib/player/Skip.svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import { createMockPlayerContext, createChildSnippet } from "./test-utils";

describe("Skip", () => {
  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("renders skip button", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext();

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Skip as Component, {
          seconds: 10,
        }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button).not.toBeNull();
  });

  test("shows forward label for positive seconds", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext();

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Skip as Component, {
          seconds: 30,
        }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("+30s");
  });

  test("shows backward label for negative seconds", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext();

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Skip as Component, {
          seconds: -10,
        }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.textContent).toContain("-10s");
  });

  test("calls seekTo with currentTime + seconds when clicked", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const seekToFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { currentTime: 30, isReady: true },
      actions: { seekTo: seekToFn },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Skip as Component, {
          seconds: 10,
        }),
      },
    });
    flushSync();

    const button = target.querySelector("button")!;
    button.click();
    flushSync();

    // Should seek to 30 + 10 = 40
    expect(seekToFn).toHaveBeenCalledWith(40);
  });

  test("is disabled when media not ready", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({ state: { isReady: false } });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Skip as Component, {
          seconds: 10,
        }),
      },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button?.disabled).toBe(true);
  });
});
