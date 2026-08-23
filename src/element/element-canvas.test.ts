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
  waitForEvent,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  deferred,
  MANIFEST_MULTI_CANVAS,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
  MANIFEST_WITH_VTT_CAPTIONS,
  MANIFEST_WITH_HLS,
  VTT_FIXTURE_OK,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import {
  setDefaultHlsConstructor,
  resetDefaultHlsConstructor,
} from "./mediaDefaults";
import type { HlsConstructor } from "../lib/media/hlsUtils";
import type { PlayerRef } from "../lib/index.js";
import type { CanvasChangeDetail, PlayerRefAvailableDetail } from "./events";

// Media stubs: the shared lib fixtures point <audio>/<video> at
// https://example.com/…, which the browser really requests — where that host
// resolves the media element errors and Root reports a fatal media-tier
// error mid-test. withStubMedia swaps in `data:` sources that fail locally
// and identically on every runner. (The lib fixtures themselves are shared
// with the lib tests and stay untouched.)
const MANIFEST_WITHOUT_CHAPTERS_STUB = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);
const MANIFEST_MULTI_CANVAS_STUB = withStubMedia(MANIFEST_MULTI_CANVAS);
const MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB = withStubMedia(
  MANIFEST_WITH_EMBEDDED_TRANSCRIPT,
);
const MANIFEST_WITH_VTT_CAPTIONS_STUB = withStubMedia(
  MANIFEST_WITH_VTT_CAPTIONS,
);

type El = HTMLElement & { canvasIndex?: number; playerRef?: PlayerRef | null };

describe("<iiif-transcript-player> canvases, gating, transcript", () => {
  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
    resetDefaultHlsConstructor();
  });

  test("CanvasNav renders for a multi-canvas manifest and not for a single canvas", async () => {
    const multi = "https://example.com/el-nav-multi.json";
    const single = "https://example.com/el-nav-single.json";
    mockFetchRoutes({
      [multi]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: multi } },
      [single]: { json: { ...MANIFEST_WITHOUT_CHAPTERS_STUB, id: single } },
    });
    const a = await mountElement({ "manifest-url": multi });
    const b = await mountElement({ "manifest-url": single });
    await untilShadow(a, "nav.canvas-nav button[data-canvas-index]");
    expect(
      shadow(a).querySelectorAll("button[data-canvas-index]"),
    ).toHaveLength(2);
    await untilShadow(b, "audio");
    expect(shadow(b).querySelector("nav.canvas-nav")).toBeNull();
  });

  test("CanvasNav click fires canvaschange and reflects canvas-index; host write back round-trips", async () => {
    const url = "https://example.com/el-canvas-roundtrip.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = (await mountElement({
      "manifest-url": url,
      "canvas-index": "0",
    })) as El;
    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    const second = await untilShadow<HTMLButtonElement>(
      el,
      'button[data-canvas-index="1"]',
    );

    const change = waitForEvent<CanvasChangeDetail>(el, "canvaschange");
    second.click();
    const { detail } = await change;
    expect(detail.index).toBe(1);
    expect(detail.canvas.label).toBe("Interview Part 2");
    await vi.waitFor(() => {
      expect(el.getAttribute("canvas-index")).toBe("1");
    });
    expect(el.canvasIndex).toBe(1);
    expect(el.playerRef!.canvasIndex).toBe(1);

    // Round trip: the host goes back to the index it originally set.
    const back = waitForEvent<CanvasChangeDetail>(el, "canvaschange");
    el.canvasIndex = 0;
    const { detail: backDetail } = await back;
    expect(backDetail.index).toBe(0);
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(0);
      expect(el.getAttribute("canvas-index")).toBe("0");
    });
  });

  test("the attribute channel still works after in-player navigation (host writes back the index it started from)", async () => {
    const url = "https://example.com/el-canvas-attr-after-nav.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = (await mountElement({
      "manifest-url": url,
      "canvas-index": "0",
    })) as El;
    const changes: number[] = [];
    el.addEventListener("canvaschange", (e) =>
      changes.push((e as CustomEvent<CanvasChangeDetail>).detail.index),
    );
    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    const second = await untilShadow<HTMLButtonElement>(
      el,
      'button[data-canvas-index="1"]',
    );

    // In-player navigation: CanvasNav, not the host.
    const change = waitForEvent<CanvasChangeDetail>(el, "canvaschange");
    second.click();
    expect((await change).detail.index).toBe(1);
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
      expect(el.getAttribute("canvas-index")).toBe("1");
    });

    // A host that only ever uses attributes (the documented rule) writes
    // back the index it set in markup. Nothing about the in-player switch
    // may make that write a no-op.
    const back = waitForEvent<CanvasChangeDetail>(el, "canvaschange");
    el.setAttribute("canvas-index", "0");
    expect((await back).detail.index).toBe(0);
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(0);
      expect(el.getAttribute("canvas-index")).toBe("0");
    });

    // The element's own attribute write must not echo back into another
    // canvas switch: exactly one canvaschange per switch, and no third one
    // after everything settles.
    expect(changes).toEqual([1, 0]);
    await new Promise((r) => setTimeout(r, 50));
    expect(changes).toEqual([1, 0]);
  });

  test("setting the canvas-index attribute after mount switches the canvas and fires canvaschange", async () => {
    const url = "https://example.com/el-canvas-attr.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "playerrefavailable");

    const change = waitForEvent<CanvasChangeDetail>(el, "canvaschange");
    el.setAttribute("canvas-index", "1");
    const { detail } = await change;
    expect(detail.index).toBe(1);
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });
  });

  test("no transcript panel for a canvas with neither embedded text nor VTT", async () => {
    const url = "https://example.com/el-no-transcript.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "audio");
    await new Promise((r) => setTimeout(r, 30));
    expect(shadow(el).querySelector(".transcript-panel")).toBeNull();
    expect(shadow(el).textContent).not.toContain("No transcript available");
  });

  test("populates the transcript from embedded TextualBody annotations with duplicate ids (AVAnnotate shape)", async () => {
    const url = "https://example.com/el-embedded.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, ".transcript-panel");
    await vi.waitFor(() => {
      expect(shadow(el).querySelectorAll("[data-annotation-id]")).toHaveLength(
        2,
      );
    });
    expect(shadow(el).querySelector('input[type="search"]')).toBeTruthy();
    expect(shadow(el).textContent).toContain("Welcome to the interview.");
  });

  test("shows the loading affordance while the VTT is in flight, then populates; playerrefavailable does not wait", async () => {
    const url = "https://example.com/el-vtt.json";
    const vtt = deferred<{ text: string }>();
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_VTT_CAPTIONS_STUB, id: url } },
      "https://example.com/captions-fr.vtt": { promise: vtt.promise },
    });
    const el = await mountElement({ "manifest-url": url });
    await waitForEvent(el, "playerrefavailable");
    await untilShadow(el, '.transcript-panel[aria-busy="true"]');
    expect(shadow(el).querySelector(".loading-message")).toBeTruthy();
    expect(shadow(el).querySelectorAll("[data-annotation-id]")).toHaveLength(0);

    vtt.resolve({ text: VTT_FIXTURE_OK });
    await vi.waitFor(() => {
      expect(shadow(el).querySelectorAll("[data-annotation-id]")).toHaveLength(
        2,
      );
    });
    expect(shadow(el).querySelector('[aria-busy="true"]')).toBeNull();
    expect(shadow(el).textContent).toContain("First caption & more");
  });

  test("the transcript repopulates on canvas switch", async () => {
    // Canvas 0: audio, no text, no VTT → no panel. Canvas 1: video + VTT.
    const url = "https://example.com/el-repopulate.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
      "https://example.com/captions-en.vtt": { text: VTT_FIXTURE_OK },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "playerrefavailable");
    await untilShadow(el, "audio");
    expect(shadow(el).querySelector(".transcript-panel")).toBeNull();

    el.canvasIndex = 1;
    await vi.waitFor(() => {
      expect(shadow(el).querySelectorAll("[data-annotation-id]")).toHaveLength(
        2,
      );
    });

    el.canvasIndex = 0;
    await vi.waitFor(() => {
      expect(shadow(el).querySelector(".transcript-panel")).toBeNull();
    });
  });

  test("the module-level hls.js default reaches Root (no dynamic import)", async () => {
    const url = "https://example.com/el-hls-default.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_WITH_HLS, id: url } } });
    const constructed = vi.fn();
    const FakeHls = Object.assign(
      function () {
        constructed();
        return {
          loadSource: vi.fn(),
          attachMedia: vi.fn(),
          destroy: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
        };
      },
      {
        isSupported: () => true,
        Events: { MANIFEST_PARSED: "hlsManifestParsed", ERROR: "hlsError" },
      },
    ) as unknown as HlsConstructor;
    setDefaultHlsConstructor(FakeHls);

    const el = (await mountElement({ "manifest-url": url })) as El;
    await untilShadow(el, "video");
    // playerrefavailable fires in the same microtask batch as the video's
    // first render, so by the time `untilShadow` above resolves the event has
    // already come and gone — read the ref off the element instead of
    // listening for an event that cannot arrive.
    expect(el.playerRef).not.toBeNull();
    expect(el.playerRef!.mediaType).toBe("video");
    // In Chromium the strategy may resolve to "native" (canPlayType for HLS).
    // When it is hls-js, the default constructor must be the one used.
    const video = shadow(el).querySelector("video")!;
    if (!video.getAttribute("src")) {
      await vi.waitFor(() => {
        expect(constructed).toHaveBeenCalled();
      });
    } else {
      expect(constructed).not.toHaveBeenCalled();
    }
  });
});
