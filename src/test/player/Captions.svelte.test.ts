import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Captions from "../../lib/player/Captions.svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createReactiveMockPlayerContext } from "./reactive-context.svelte";
import type { TrackDefinition } from "../../lib/player/context";

const oneTrack: TrackDefinition[] = [
  {
    src: "https://example.com/en.vtt",
    kind: "captions",
    srclang: "en",
    label: "English",
  },
];

describe("Captions", () => {
  test("absent on an audio canvas even with tracks", () => {
    const ctx = createReactiveMockPlayerContext({
      mediaType: "audio",
      tracks: oneTrack,
      captionsState: "browserDefault",
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Captions },
    });
    flushSync();

    expect(container.querySelector("button")).toBeNull();
  });

  test("absent on a video canvas with no tracks", () => {
    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: [],
      captionsState: "unavailable",
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Captions },
    });
    flushSync();

    expect(container.querySelector("button")).toBeNull();
  });

  test("present on a video canvas with tracks, with visible CC text", () => {
    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "browserDefault",
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Captions },
    });
    flushSync();

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("CC");
    // Shared control-bar part; the element wrapper's ::part(button) surface
    // depends on every conditional control carrying it (element-parts.test.ts
    // can't see this button — its fixture has no caption tracks).
    expect(button?.getAttribute("part")).toBe("button");
  });

  test("aria-pressed is truthful after a native change", () => {
    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "autoHidden",
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Captions },
    });
    flushSync();

    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");

    // Simulate the machine moving to userControlled.showing via a native
    // CC-menu read-back (A1b wires this; here we drive the mock directly).
    ctx.captionsState = "showing";
    flushSync();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  test("clicking calls ctx.toggleCaptions", () => {
    const toggleCaptions = vi.fn();
    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "browserDefault",
      toggleCaptions,
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Captions },
    });
    flushSync();

    container.querySelector("button")!.click();
    flushSync();

    expect(toggleCaptions).toHaveBeenCalledTimes(1);
  });

  test("preference survives a canvas switch: aria-pressed reflects the restored verdict", () => {
    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "hidden",
    });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Captions },
    });
    flushSync();

    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");

    // A1b's machine re-enters userControlled.hidden (not browserDefault) on
    // CANVAS_SWITCH when a preference exists — simulate the restored verdict.
    ctx.captionsState = "browserDefault"; // transient mid-switch
    flushSync();
    ctx.captionsState = "hidden"; // restored preference
    flushSync();
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
