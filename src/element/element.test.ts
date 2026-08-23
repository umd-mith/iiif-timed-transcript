import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { register, DEFAULT_TAG, IIIFTranscriptPlayerElement } from "./register";
import {
  mountElement,
  shadow,
  untilShadow,
  waitForEvent,
  removeAllElements,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index.js";
import type { PlayerRefAvailableDetail } from "./events";

describe("<iiif-transcript-player> basics", () => {
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

  test("register() defines the tag and a second call warns instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(customElements.get(DEFAULT_TAG)).toBeDefined();
    expect(() => register()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("already defined"),
    );
    warn.mockRestore();
  });

  test("renders the fixed composition inside an open shadow root", async () => {
    const url = "https://example.com/el-basic.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });

    const el = await mountElement({ "manifest-url": url });
    expect(el).toBeInstanceOf(IIIFTranscriptPlayerElement);
    expect(el.shadowRoot?.mode).toBe("open");

    await untilShadow(el, "audio");
    const root = shadow(el);
    expect(root.querySelector(".iiif-tp")).toBeTruthy();
    expect(root.querySelector("[data-audio-controls]")).toBeTruthy();
    expect(root.querySelector('[data-audio-button="play-pause"]')).toBeTruthy();
    expect(root.querySelectorAll('[data-audio-button="skip"]')).toHaveLength(2);
    expect(root.querySelector('input[type="range"]')).toBeTruthy();
    expect(root.querySelector('[data-audio-control="speed"]')).toBeTruthy();
    expect(root.querySelector('[data-audio-control="time"]')).toBeTruthy();
    // Single canvas, no transcript: neither CanvasNav nor the panel renders.
    expect(root.querySelector("nav.canvas-nav")).toBeNull();
    expect(root.querySelector(".transcript-panel")).toBeNull();
    // And the light DOM holds nothing.
    expect(el.childNodes.length).toBe(0);
  });

  test("playerRef is nullish before init and fires playerrefavailable with a usable ref", async () => {
    const url = "https://example.com/el-ref.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });

    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      playerRef?: PlayerRef | null;
    };
    el.setAttribute("manifest-url", url);
    const ready = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    document.body.appendChild(el);
    // Synchronously after append: inner component not created yet.
    expect(el.playerRef == null).toBe(true);

    const event = await ready;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.detail.playerRef.canvasCount).toBe(1);
    expect(el.playerRef).toBe(event.detail.playerRef);
    expect(typeof el.playerRef!.actions.play).toBe("function");
  });

  test("canvas-index arrives as a number (attribute coercion)", async () => {
    const url = "https://example.com/el-coerce.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } } });

    const el = await mountElement({ "manifest-url": url, "canvas-index": "1" });
    const { detail } = await waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    expect(el.canvasIndex).toBe(1);
    expect(typeof el.canvasIndex).toBe("number");
    await vi.waitFor(() => {
      expect(detail.playerRef.canvasIndex).toBe(1);
    });
  });

  test("renders nothing until manifest-url is set", async () => {
    const el = await mountElement({});
    expect(shadow(el).querySelector(".iiif-player-root")).toBeNull();
  });
});
