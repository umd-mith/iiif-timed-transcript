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

// Media stubs: the shared lib fixtures point <audio>/<video> at
// https://example.com/…, which the browser really requests — where that host
// resolves the media element errors and Root reports a fatal media-tier
// error mid-test. withStubMedia swaps in `data:` sources that fail locally
// and identically on every runner. (The lib fixtures themselves are shared
// with the lib tests and stay untouched.)
const MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB = withStubMedia(
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
);

describe("<iiif-transcript-player> theming", () => {
  let hostile: HTMLStyleElement;

  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    // Hostile page CSS: must not leak into the shadow root.
    hostile = document.createElement("style");
    hostile.textContent = `
      [data-annotation-id] { padding: 99px !important; }
      .iiif-tp { display: none !important; }
      button { font-size: 40px !important; }
    `;
    document.head.appendChild(hostile);
  });
  afterEach(() => {
    hostile.remove();
    removeAllElements();
    manifestCache.clear();
  });

  async function mountWithTranscript(url: string) {
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "[data-annotation-id]");
    return el;
  }

  test("host is display:block and page CSS does not reach the shadow tree", async () => {
    const el = await mountWithTranscript(
      "https://example.com/theme-isolation.json",
    );
    expect(getComputedStyle(el).display).toBe("block");
    const root = shadow(el).querySelector(".iiif-tp") as HTMLElement;
    expect(getComputedStyle(root).display).not.toBe("none");
    const segment = shadow(el).querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    expect(getComputedStyle(segment).paddingTop).not.toBe("99px");
  });

  test("the default rule beats Segment's `all: unset` (padding applied to a segment)", async () => {
    const el = await mountWithTranscript(
      "https://example.com/theme-specificity.json",
    );
    const segment = shadow(el).querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    // The wrapper's default: padding 0.375rem 0.5rem = 6px 8px at 16px root.
    expect(getComputedStyle(segment).paddingTop).toBe("6px");
    expect(getComputedStyle(segment).paddingLeft).toBe("8px");
  });

  test("custom properties theme the element from the light DOM", async () => {
    const el = await mountWithTranscript(
      "https://example.com/theme-props.json",
    );
    el.style.setProperty("--iiif-player-segment-active-bg", "rgb(1, 2, 3)");
    el.style.setProperty("--iiif-player-accent", "rgb(4, 5, 6)");
    const active = shadow(el).querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    active.setAttribute("data-state", "active");
    await vi.waitFor(() => {
      expect(getComputedStyle(active).backgroundColor).toBe("rgb(1, 2, 3)");
    });
    const play = shadow(el).querySelector(
      '[data-audio-button="play-pause"]',
    ) as HTMLElement;
    expect(getComputedStyle(play).backgroundColor).toBe("rgb(4, 5, 6)");
  });

  test("the nested focus outline survives (the wrapper does not restyle focus)", async () => {
    const el = await mountWithTranscript(
      "https://example.com/theme-focus.json",
    );
    const segment = shadow(el).querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    // Keyboard-style focus so :focus-visible matches.
    segment.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    segment.focus();
    await vi.waitFor(() => {
      expect(getComputedStyle(segment).outlineWidth).toBe("2px");
    });
    expect(getComputedStyle(segment).outlineStyle).toBe("solid");
  });
});
