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

describe("<iiif-transcript-player> a11y tokens (1.4.11 / 1.4.1 / focus ring)", () => {
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

  test("default --iiif-player-border is not the old #e5e7eb", async () => {
    const url = "https://example.com/a11y-token-border.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");
    const panel = shadow(el).querySelector(".transcript-panel") as HTMLElement;
    expect(getComputedStyle(panel).borderTopColor).not.toBe(
      "rgb(229, 231, 235)",
    );
  });

  test("active segment carries a non-color border-inline-start indicator", async () => {
    const url = "https://example.com/a11y-token-active-border.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    const segment = await untilShadow<HTMLElement>(el, "[data-annotation-id]");
    segment.setAttribute("data-state", "active");
    expect(getComputedStyle(segment).borderInlineStartWidth).toBe("4px");
    expect(getComputedStyle(segment).borderInlineStartStyle).toBe("solid");
  });

  test("highlighted segment carries the same non-color indicator", async () => {
    const url = "https://example.com/a11y-token-highlight-border.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    const segment = await untilShadow<HTMLElement>(el, "[data-annotation-id]");
    segment.setAttribute("data-highlighted", "true");
    expect(getComputedStyle(segment).borderInlineStartWidth).toBe("4px");
  });

  test("inactive segment reserves the same border width (no layout shift on state change)", async () => {
    const url = "https://example.com/a11y-token-inactive-border.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");
    // The first segment (t=0,5) is active by default at playhead 0, so use
    // the second segment (t=5,12) to observe the genuinely-inactive state.
    const segment = shadow(el).querySelectorAll<HTMLElement>(
      "[data-annotation-id]",
    )[1] as HTMLElement;
    expect(getComputedStyle(segment).borderInlineStartWidth).toBe("4px");
    expect(getComputedStyle(segment).borderInlineStartColor).toBe(
      "rgba(0, 0, 0, 0)",
    );
  });

  test("focused segment outline is not white-on-white on the active canvas-nav button", async () => {
    const url = "https://example.com/a11y-token-focus.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    const button = await untilShadow<HTMLElement>(
      el,
      "nav.canvas-nav button[data-canvas-index]",
    );
    button.setAttribute("data-state", "active");
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    button.focus();
    await vi.waitFor(() => {
      expect(getComputedStyle(button).outlineColor).not.toBe(
        "rgb(255, 255, 255)",
      );
    });
  });

  // 1.4.1 Use of Color. The active canvas-nav button used to be marked by an
  // accent background and nothing else, so which canvas you were on was
  // conveyed by hue alone. `aria-current` is programmatic, not a visual
  // means, and the forced-colors rule below only fires under a contrast
  // theme. These two tests pin the same reserve-then-color pattern the
  // segments use, so the indicator's presence — not its hue — is the signal.
  test("active canvas-nav button carries a non-color border-inline-start indicator", async () => {
    const url = "https://example.com/a11y-token-canvas-active.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    const button = await untilShadow<HTMLElement>(
      el,
      'nav.canvas-nav button[data-state="active"]',
    );
    const style = getComputedStyle(button);

    expect(style.borderInlineStartWidth).toBe("4px");
    expect(style.borderInlineStartStyle).toBe("solid");
    expect(style.borderInlineStartColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(style.borderInlineStartColor).not.toBe(style.backgroundColor);
  });

  test("inactive canvas-nav button reserves the same border width (no layout shift on canvas change)", async () => {
    const url = "https://example.com/a11y-token-canvas-inactive.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "nav.canvas-nav button[data-canvas-index]");
    const inactive = shadow(el).querySelector<HTMLElement>(
      'nav.canvas-nav button[data-state="inactive"]',
    )!;
    const style = getComputedStyle(inactive);

    expect(style.borderInlineStartWidth).toBe("4px");
    expect(style.borderInlineStartColor).toBe("rgba(0, 0, 0, 0)");
  });
});
