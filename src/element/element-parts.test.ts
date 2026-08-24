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
});
