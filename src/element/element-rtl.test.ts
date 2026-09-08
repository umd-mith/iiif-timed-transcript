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
import { mockFetchRoutes } from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

/**
 * Local fixture: a two-segment embedded-transcript manifest with Arabic
 * text, following the shape of test-fixtures.ts's
 * MANIFEST_WITH_EMBEDDED_TRANSCRIPT (see test-fixtures.ts:417-486) — kept
 * local rather than added to the shared fixtures file to avoid a merge
 * collision with other Lane B groups editing that file concurrently.
 */
const MANIFEST_RTL_ARABIC = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-rtl-arabic",
  type: "Manifest",
  label: { ar: ["مقابلة"] },
  items: [
    {
      id: "https://example.com/rtl/canvas/1",
      type: "Canvas",
      duration: 30,
      items: [
        {
          id: "https://example.com/rtl/canvas/1/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/rtl/canvas/1/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/rtl/audio.mp3",
                type: "Sound",
                format: "audio/mpeg",
              },
              target: "https://example.com/rtl/canvas/1",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/rtl/canvas/1/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/rtl/canvas/1/annotations/1/page1",
              type: "Annotation",
              motivation: "commenting",
              body: {
                type: "TextualBody",
                value: "مرحبا بكم في المقابلة.",
                format: "text/plain",
              },
              target: "https://example.com/rtl/canvas/1#t=0,5",
            },
            {
              id: "https://example.com/rtl/canvas/1/annotations/1/page1",
              type: "Annotation",
              motivation: "commenting",
              body: {
                type: "TextualBody",
                value: "أخبرنا أين نشأت.",
                format: "text/plain",
              },
              target: "https://example.com/rtl/canvas/1#t=5,12",
            },
          ],
        },
      ],
    },
  ],
};

const MANIFEST_RTL_ARABIC_STUB = withStubMedia(MANIFEST_RTL_ARABIC);

describe("<iiif-transcript-player> RTL", () => {
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

  test('dir="rtl" on the host is inherited into the shadow tree', async () => {
    const url = "https://example.com/rtl-dir-inherit.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_RTL_ARABIC_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, dir: "rtl" });
    const wrapper = await untilShadow<HTMLElement>(el, ".iiif-tp");
    expect(getComputedStyle(wrapper).direction).toBe("rtl");
  });

  test("without dir, the shadow tree stays ltr (default, no accidental inheritance bug)", async () => {
    const url = "https://example.com/rtl-dir-default.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_RTL_ARABIC_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    const wrapper = await untilShadow<HTMLElement>(el, ".iiif-tp");
    expect(getComputedStyle(wrapper).direction).toBe("ltr");
  });

  test("under RTL, a segment's non-color state indicator (A3) renders on the physical right, not the left", async () => {
    const url = "https://example.com/rtl-indicator-side.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_RTL_ARABIC_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, dir: "rtl" });
    const segment = await untilShadow<HTMLElement>(el, "[data-annotation-id]");
    segment.setAttribute("data-state", "active");
    const style = getComputedStyle(segment);
    // border-inline-start in dir=rtl maps to the physical right edge.
    expect(style.borderRightWidth).toBe("4px");
    expect(style.borderLeftWidth).toBe("0px");
  });

  test("Arabic segment text renders and is reachable via the same data hooks as any other manifest", async () => {
    const url = "https://example.com/rtl-content.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_RTL_ARABIC_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, dir: "rtl" });
    await untilShadow(el, "[data-annotation-id]");
    const segments = shadow(el).querySelectorAll("[data-annotation-id]");
    expect(segments).toHaveLength(2);
    expect(segments[0]?.textContent).toContain("مرحبا بكم في المقابلة.");
  });
});
