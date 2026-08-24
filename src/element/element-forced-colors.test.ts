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
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

const MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB = withStubMedia(
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
);
const MANIFEST_MULTI_CANVAS_STUB = withStubMedia(MANIFEST_MULTI_CANVAS);

// This project's browser context has forced-colors emulation active
// (vitest.config.ts, the "element-forced-colors" project) — the whole
// point of this file is to run under that palette, not the default one.
describe("<iiif-transcript-player> under forced-colors: active", () => {
  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
  });

  test("active segment's border-inline-start-color differs from an inactive segment's", async () => {
    const url = "https://example.com/forced-colors-segment.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");
    const segments = shadow(el).querySelectorAll<HTMLElement>(
      "[data-annotation-id]",
    );
    // The first segment (t=0,5) is active by default at playhead 0, so use
    // the second segment (t=5,12) to observe a genuine inactive→active
    // transition (see A3's element-a11y-tokens.test.ts for the same fixture
    // behavior).
    const inactive = segments[1]!;
    const inactiveColor = getComputedStyle(inactive).borderInlineStartColor;
    inactive.setAttribute("data-state", "active");
    const activeColor = getComputedStyle(inactive).borderInlineStartColor;
    expect(activeColor).not.toBe(inactiveColor);
  });

  test("active canvas-nav button's border-color differs from an inactive button's", async () => {
    const url = "https://example.com/forced-colors-canvas-nav.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "nav.canvas-nav button[data-canvas-index]");
    const buttons = shadow(el).querySelectorAll<HTMLElement>(
      "nav.canvas-nav button[data-canvas-index]",
    );
    const inactiveColor = getComputedStyle(buttons[1]!).borderTopColor;
    buttons[0]!.setAttribute("data-state", "active");
    const activeColor = getComputedStyle(buttons[0]!).borderTopColor;
    expect(activeColor).not.toBe(inactiveColor);
  });
});
