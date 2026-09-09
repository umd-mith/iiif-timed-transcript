import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { register } from "./register";
import {
  mountElement,
  shadow,
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

const MANIFEST_STUB = withStubMedia(MANIFEST_WITH_EMBEDDED_TRANSCRIPT);

describe("<iiif-transcript-player> ::part() surface", () => {
  let pageStyle: HTMLStyleElement;

  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    pageStyle = document.createElement("style");
    pageStyle.textContent = `
      iiif-transcript-player::part(controls) { background-color: rgb(1, 2, 3); }
      iiif-transcript-player::part(transcript) { border-top-color: rgb(4, 5, 6); }
      iiif-transcript-player::part(segment) { color: rgb(7, 8, 9); }
      iiif-transcript-player::part(button) { background-color: rgb(10, 11, 12); }
      iiif-transcript-player::part(speed) { background-color: rgb(13, 14, 15); }
      iiif-transcript-player::part(progress) { background-color: rgb(16, 17, 18); }
      iiif-transcript-player::part(error) { background-color: rgb(19, 20, 21); }
    `;
    document.head.appendChild(pageStyle);
  });
  afterEach(() => {
    pageStyle.remove();
    removeAllElements();
    manifestCache.clear();
  });

  test("::part(controls), ::part(transcript), and ::part(segment) are reachable from page CSS", async () => {
    const url = "https://example.com/parts.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");

    const controls = shadow(el).querySelector(
      "[data-audio-controls]",
    ) as HTMLElement;
    expect(controls.getAttribute("part")).toBe("controls");
    expect(getComputedStyle(controls).backgroundColor).toBe("rgb(1, 2, 3)");

    const transcript = shadow(el).querySelector(
      ".transcript-panel",
    ) as HTMLElement;
    expect(transcript.getAttribute("part")).toBe("transcript");
    expect(getComputedStyle(transcript).borderTopColor).toBe("rgb(4, 5, 6)");

    // The first segment (0-5s) is active at mount (playback starts at t=0),
    // so it already carries "segment segment-active" — pick the second
    // segment (5-12s) for the plain, non-active "segment" assertion.
    const segment = shadow(el).querySelectorAll(
      "[data-annotation-id]",
    )[1] as HTMLElement;
    expect(segment.getAttribute("part")).toBe("segment");
    expect(getComputedStyle(segment).color).toBe("rgb(7, 8, 9)");
  });

  test("every control-bar button carries part='button' and is reachable from page CSS", async () => {
    const url = "https://example.com/parts-buttons.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");

    const controls = shadow(el).querySelector(
      "[data-audio-controls]",
    ) as HTMLElement;
    // Play and the two skips; the captions toggle only renders when the
    // canvas has caption tracks (this fixture has none) — its part="button"
    // is asserted in Captions.svelte.test.ts.
    const buttons = controls.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) {
      expect(button.getAttribute("part")).toBe("button");
      expect(getComputedStyle(button).backgroundColor).toBe("rgb(10, 11, 12)");
    }
  });

  test("::part(speed) and ::part(progress) reach the select and the slider", async () => {
    const url = "https://example.com/parts-speed-progress.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");

    const speed = shadow(el).querySelector("select") as HTMLElement;
    expect(speed.getAttribute("part")).toBe("speed");
    expect(getComputedStyle(speed).backgroundColor).toBe("rgb(13, 14, 15)");

    const progress = shadow(el).querySelector(
      'input[type="range"]',
    ) as HTMLElement;
    expect(progress.getAttribute("part")).toBe("progress");
    expect(getComputedStyle(progress).backgroundColor).toBe("rgb(16, 17, 18)");
  });

  test("::part(error) reaches the error banner when the manifest fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );
    const el = await mountElement({
      "manifest-url": "https://example.com/parts-error.json",
    });
    const banner = await untilShadow<HTMLElement>(el, '[part="error"]');

    expect(banner.getAttribute("role")).toBe("status");
    expect(getComputedStyle(banner).backgroundColor).toBe("rgb(19, 20, 21)");
  });
});
