import { describe, test, expect } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Time from "../../lib/player/Time.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";

describe("Time", () => {
  test("renders time display", () => {
    const ctx = createMockPlayerContext();

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Time },
    });
    flushSync();

    const timeDiv = container.querySelector('[data-audio-control="time"]');
    expect(timeDiv).not.toBeNull();
  });

  test("formats current time and duration", () => {
    const ctx = createMockPlayerContext({
      state: { currentTime: 65, duration: 120 },
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Time },
    });
    flushSync();

    const timeDiv = container.querySelector('[data-audio-control="time"]');
    // Should show "1:05 / 2:00"
    expect(timeDiv?.textContent).toContain("1:05");
    expect(timeDiv?.textContent).toContain("2:00");
  });
});
