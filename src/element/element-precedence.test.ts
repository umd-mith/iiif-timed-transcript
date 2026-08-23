import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { register, DEFAULT_TAG } from "./register";
import { waitForEvent, removeAllElements } from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index.js";
import type { PlayerRefAvailableDetail } from "./events";

type El = HTMLElement & { canvasIndex?: number; playerRef?: PlayerRef | null };

// A second tag lets us create an element *before* its definition (case 2):
// the default tag is already defined by the time any test runs.
const UPGRADE_TAG = "iiif-tp-precedence-upgrade";

describe("<iiif-transcript-player> attribute/property precedence", () => {
  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    removeAllElements();
    removeAllElements(UPGRADE_TAG);
    manifestCache.clear();
  });

  async function initialIndex(el: El): Promise<number> {
    const { detail } = await waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    // Root applies the prop on first load; wait for it to settle.
    await vi.waitFor(() => {
      expect(detail.playerRef.canvasCount).toBe(2);
    });
    await new Promise((r) => setTimeout(r, 20));
    return detail.playerRef.canvasIndex;
  }

  test("case 1 — defined class: a property set before append beats a markup attribute", async () => {
    const url = "https://example.com/prec-case1.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } } });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    el.canvasIndex = 1; // prototype setter → pending props
    document.body.appendChild(el);
    expect(await initialIndex(el)).toBe(1);
  });

  test("case 2 — upgrade in place: the attribute wins over a pre-upgrade property write, which then shadows the accessor for good; a fresh element behaves like case 1", async () => {
    const url = "https://example.com/prec-case2.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } } });

    // Element exists before the tag is defined (like markup parsed before the
    // IIFE <script> runs).
    expect(customElements.get(UPGRADE_TAG)).toBeUndefined();
    const el = document.createElement(UPGRADE_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    el.canvasIndex = 1; // plain own data property on an HTMLElement
    document.body.appendChild(el);

    register(UPGRADE_TAG); // define() upgrades existing elements synchronously
    expect(await initialIndex(el)).toBe(0); // attribute won

    // The dead own property still shadows the prototype accessor: a later
    // write to this key on this element goes nowhere.
    el.canvasIndex = 1;
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(0);
    expect(Object.prototype.hasOwnProperty.call(el, "canvasIndex")).toBe(true);

    // A fresh element of the now-defined tag: case-1 semantics.
    const fresh = document.createElement(UPGRADE_TAG) as El;
    fresh.setAttribute("manifest-url", url);
    fresh.setAttribute("canvas-index", "0");
    fresh.canvasIndex = 1;
    document.body.appendChild(fresh);
    expect(await initialIndex(fresh)).toBe(1);
  });

  test("case 3 — after creation, last write wins (attribute then property, property then attribute)", async () => {
    const url = "https://example.com/prec-case3.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_MULTI_CANVAS, id: url } } });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    document.body.appendChild(el);
    await initialIndex(el);

    el.setAttribute("canvas-index", "1");
    await Promise.resolve();
    el.canvasIndex = 0;
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(0);

    el.canvasIndex = 1;
    el.setAttribute("canvas-index", "0");
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(0);

    el.setAttribute("canvas-index", "0");
    el.canvasIndex = 1;
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(1);
  });
});
