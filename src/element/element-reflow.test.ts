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
 * WCAG 1.4.10 Reflow is tested at a 320px-wide viewport. The element is a
 * component, not a page, so the equivalent here is a 320px-wide host: at
 * that width nothing inside the shadow tree may overflow its container and
 * force horizontal scrolling.
 *
 * These two assertions exist because both cases regressed and were caught
 * by the manual 320px pass in docs/a11y/zoom-reflow-checklist.md:
 *
 * - The control bar is a flex row that never wrapped, so below roughly
 *   484px it simply overflowed. Canvas nav had `flex-wrap: wrap`; the
 *   control bar had been left out.
 * - Segments carry padding plus the 4px inline-start indicator that backs
 *   the 1.4.1 non-color-state fix, on top of a `width: 100%` box whose
 *   `box-sizing` had been reset to `content-box` by Segment.svelte's
 *   `all: unset`. Each segment ended up 20px wider than the column holding
 *   it — the accessibility fix paying for itself in overflow.
 */
const MANIFEST_REFLOW = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-reflow",
  type: "Manifest",
  label: { en: ["Reflow fixture"] },
  items: [
    {
      id: "https://example.com/reflow/canvas/1",
      type: "Canvas",
      label: { en: ["First canvas with a deliberately long label"] },
      duration: 30,
      items: [
        {
          id: "https://example.com/reflow/canvas/1/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/reflow/canvas/1/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/reflow/video.mp4",
                type: "Video",
                format: "video/mp4",
                width: 1920,
                height: 1080,
                duration: 30,
              },
              target: "https://example.com/reflow/canvas/1",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/reflow/canvas/1/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/reflow/canvas/1/annotations/1/a1",
              type: "Annotation",
              motivation: "supplementing",
              body: {
                type: "TextualBody",
                value:
                  "A segment long enough to wrap onto several lines in a narrow column.",
                format: "text/plain",
                language: "en",
              },
              target: "https://example.com/reflow/canvas/1#t=0,10",
            },
            {
              id: "https://example.com/reflow/canvas/1/annotations/1/a2",
              type: "Annotation",
              motivation: "supplementing",
              body: {
                type: "TextualBody",
                value: "A second segment.",
                format: "text/plain",
                language: "en",
              },
              target: "https://example.com/reflow/canvas/1#t=10,30",
            },
          ],
        },
      ],
    },
    {
      id: "https://example.com/reflow/canvas/2",
      type: "Canvas",
      label: { en: ["Second canvas, also with a long label"] },
      duration: 30,
      items: [
        {
          id: "https://example.com/reflow/canvas/2/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/reflow/canvas/2/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/reflow/video2.mp4",
                type: "Video",
                format: "video/mp4",
                width: 1920,
                height: 1080,
                duration: 30,
              },
              target: "https://example.com/reflow/canvas/2",
            },
          ],
        },
      ],
    },
  ],
};

const MANIFEST_REFLOW_STUB = withStubMedia(MANIFEST_REFLOW);

const NARROW = "width: 320px; display: block;";

describe("<iiif-transcript-player> reflow at 320px", () => {
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

  test("the control bar wraps instead of overflowing a 320px host", async () => {
    const url = "https://example.com/reflow-controls.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_REFLOW_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, style: NARROW });
    const controls = await untilShadow<HTMLElement>(
      el,
      "[data-audio-controls]",
    );

    expect(controls.scrollWidth).toBeLessThanOrEqual(controls.clientWidth + 1);
  });

  test("a transcript segment stays inside its column at a 320px host", async () => {
    const url = "https://example.com/reflow-segments.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_REFLOW_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, style: NARROW });
    const segment = await untilShadow<HTMLElement>(el, "[data-annotation-id]");
    const container = shadow(el).querySelector<HTMLElement>(
      ".segments-container",
    )!;

    // getBoundingClientRect() is the border box, which is what has to fit —
    // padding and the inline-start indicator included.
    expect(segment.getBoundingClientRect().width).toBeLessThanOrEqual(
      container.clientWidth + 1,
    );
  });

  test("canvas navigation wraps instead of overflowing a 320px host", async () => {
    const url = "https://example.com/reflow-canvas-nav.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_REFLOW_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, style: NARROW });
    const nav = await untilShadow<HTMLElement>(el, "nav.canvas-nav");

    expect(getComputedStyle(nav).flexWrap).toBe("wrap");
    expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth + 1);
  });

  test("the search input stays inside its column at a 320px host", async () => {
    const url = "https://example.com/reflow-search.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_REFLOW_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url, style: NARROW });
    const input = await untilShadow<HTMLElement>(el, 'input[type="search"]');
    const container = input.parentElement!;

    // border-box sizing is what keeps the input's own padding and border from
    // pushing it past the column that holds it.
    expect(getComputedStyle(input).boxSizing).toBe("border-box");
    expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(
      container.clientWidth + 1,
    );
  });
});
