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
      [multi]: { json: { ...MANIFEST_MULTI_CANVAS, id: multi } },
      [single]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: single } },
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
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } } });
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

  test("setting the canvas-index attribute after mount switches the canvas and fires canvaschange", async () => {
    const url = "https://example.com/el-canvas-attr.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } } });
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
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
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
      [url]: { json: { ...MANIFEST_WITH_EMBEDDED_TRANSCRIPT, id: url } },
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
      [url]: { json: { ...MANIFEST_WITH_VTT_CAPTIONS, id: url } },
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
      [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } },
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

    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, "video");
    // In Chromium the strategy may resolve to "native" (canPlayType for HLS).
    // When it is hls-js, the default constructor must be the one used.
    // playerrefavailable fires in the same microtask batch as the video's
    // first render, so by the time `untilShadow` above resolves (real-timer
    // polling) the event has already fired; bound the wait instead of
    // hanging on an event that has already come and gone.
    const ref = await Promise.race<PlayerRefAvailableDetail | null>([
      waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable").then(
        (e) => e.detail,
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 200)),
    ]);
    void ref;
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
