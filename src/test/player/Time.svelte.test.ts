import { describe, test, expect, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import Time from "../../lib/player/Time.svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import { createMockPlayerContext } from "./test-utils";

describe("Time", () => {
  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("renders time display", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext();

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: (anchor: any) => {
          mount(Time, { target, anchor });
        },
      },
    });
    flushSync();

    const timeDiv = target.querySelector('[data-audio-control="time"]');
    expect(timeDiv).not.toBeNull();
  });

  test("formats current time and duration", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createMockPlayerContext({
      state: { currentTime: 65, duration: 120 },
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: (anchor: any) => {
          mount(Time, { target, anchor });
        },
      },
    });
    flushSync();

    const timeDiv = target.querySelector('[data-audio-control="time"]');
    // Should show "1:05 / 2:00"
    expect(timeDiv?.textContent).toContain("1:05");
    expect(timeDiv?.textContent).toContain("2:00");
  });
});
