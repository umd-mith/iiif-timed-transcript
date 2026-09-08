import { describe, test, expect, vi, afterEach } from "vitest";
import { mount, flushSync } from "svelte";
import Captions from "../../lib/player/Captions.svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import { createChildSnippet } from "./test-utils";
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
  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("absent on an audio canvas even with tracks", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createReactiveMockPlayerContext({
      mediaType: "audio",
      tracks: oneTrack,
      captionsState: "browserDefault",
    });

    mount(TestContextProvider, {
      target,
      props: { context: ctx, children: createChildSnippet(target, Captions) },
    });
    flushSync();

    expect(target.querySelector("button")).toBeNull();
  });

  test("absent on a video canvas with no tracks", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: [],
      captionsState: "unavailable",
    });

    mount(TestContextProvider, {
      target,
      props: { context: ctx, children: createChildSnippet(target, Captions) },
    });
    flushSync();

    expect(target.querySelector("button")).toBeNull();
  });

  test("present on a video canvas with tracks, with visible CC text", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "browserDefault",
    });

    mount(TestContextProvider, {
      target,
      props: { context: ctx, children: createChildSnippet(target, Captions) },
    });
    flushSync();

    const button = target.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("CC");
    // Shared control-bar part; the element wrapper's ::part(button) surface
    // depends on every conditional control carrying it (element-parts.test.ts
    // can't see this button — its fixture has no caption tracks).
    expect(button?.getAttribute("part")).toBe("button");
  });

  test("aria-pressed is truthful after a native change", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "autoHidden",
    });

    mount(TestContextProvider, {
      target,
      props: { context: ctx, children: createChildSnippet(target, Captions) },
    });
    flushSync();

    const button = target.querySelector("button")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");

    // Simulate the machine moving to userControlled.showing via a native
    // CC-menu read-back (A1b wires this; here we drive the mock directly).
    ctx.captionsState = "showing";
    flushSync();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  test("clicking calls ctx.toggleCaptions", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const toggleCaptions = vi.fn();
    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "browserDefault",
      toggleCaptions,
    });

    mount(TestContextProvider, {
      target,
      props: { context: ctx, children: createChildSnippet(target, Captions) },
    });
    flushSync();

    target.querySelector("button")!.click();
    flushSync();

    expect(toggleCaptions).toHaveBeenCalledTimes(1);
  });

  test("preference survives a canvas switch: aria-pressed reflects the restored verdict", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const ctx = createReactiveMockPlayerContext({
      mediaType: "video",
      tracks: oneTrack,
      captionsState: "hidden",
    });

    mount(TestContextProvider, {
      target,
      props: { context: ctx, children: createChildSnippet(target, Captions) },
    });
    flushSync();

    const button = target.querySelector("button")!;
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
