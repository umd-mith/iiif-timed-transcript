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
  waitForEvent,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type {
  CanvasChangeDetail,
  PlayerErrorDetail,
  PlayerRefAvailableDetail,
} from "./events";

const OLD_NAMES = ["playerrefavailable", "playererror", "canvaschange"];

// File-local stubs: real https://example.com media would let a media-tier
// error race the host-tier assertions below (see test-helpers.ts).
const MANIFEST_MULTI_CANVAS_STUB = withStubMedia(MANIFEST_MULTI_CANVAS);
const MANIFEST_WITHOUT_CHAPTERS_STUB = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);

type El = HTMLElement & { canvasIndex?: number };

describe("<iiif-transcript-player> renamed events (iiif-player-*)", () => {
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

  function recordOldNames(el: HTMLElement): string[] {
    const seen: string[] = [];
    for (const type of OLD_NAMES) {
      el.addEventListener(type, () => seen.push(type));
    }
    return seen;
  }

  test("iiif-player-ready fires on manifest load; playerrefavailable never fires", async () => {
    const url = "https://example.com/el-rename-ready.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS_STUB, id: url } },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    const oldSeen = recordOldNames(el);
    const { detail } = await waitForEvent<PlayerRefAvailableDetail>(
      el,
      "iiif-player-ready",
    );
    expect(detail.playerRef.canvasCount).toBe(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(oldSeen).toEqual([]);
  });

  test("iiif-player-error fires on a failing manifest; playererror never fires", async () => {
    const url = "https://example.com/el-rename-error.json";
    mockFetchRoutes({ [url]: { status: 404 } });
    const el = (await mountElement({ "manifest-url": url })) as El;
    const oldSeen = recordOldNames(el);
    const { detail } = await waitForEvent<PlayerErrorDetail>(
      el,
      "iiif-player-error",
    );
    expect(detail.fatal).toBe(true);
    expect(detail.source).toBe("manifest");
    await new Promise((r) => setTimeout(r, 30));
    expect(oldSeen).toEqual([]);
  });

  test("iiif-player-canvas-change fires on a canvas-index write; canvaschange never fires", async () => {
    const url = "https://example.com/el-rename-canvaschange.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    const oldSeen = recordOldNames(el);
    await waitForEvent(el, "iiif-player-ready");
    const change = waitForEvent<CanvasChangeDetail>(
      el,
      "iiif-player-canvas-change",
    );
    el.setAttribute("canvas-index", "1");
    const { detail } = await change;
    expect(detail.index).toBe(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(oldSeen).toEqual([]);
  });
});
