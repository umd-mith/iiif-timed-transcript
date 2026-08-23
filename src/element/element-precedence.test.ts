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
import { waitForEvent, removeAllElements, withStubMedia } from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index.js";
import type { PlayerRefAvailableDetail } from "./events";

// Media stubs: the shared lib fixtures point <audio>/<video> at
// https://example.com/…, which the browser really requests — where that host
// resolves the media element errors and Root reports a fatal media-tier
// error mid-test. withStubMedia swaps in `data:` sources that fail locally
// and identically on every runner. (The lib fixtures themselves are shared
// with the lib tests and stay untouched.)
const MANIFEST_MULTI_CANVAS_STUB = withStubMedia(MANIFEST_MULTI_CANVAS);

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
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    el.canvasIndex = 1; // prototype setter → pending props
    document.body.appendChild(el);
    expect(await initialIndex(el)).toBe(1);
  });

  test("case 2 — upgrade in place: the attribute wins over a pre-upgrade property write, which then shadows the accessor for good; a fresh element behaves like case 1", async () => {
    const url = "https://example.com/prec-case2.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });

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

  test("case 3 — after upgrade, each channel works on its own, but mixing them for one key is not reliable: a property write leaves the attribute channel holding a stale value", async () => {
    const url = "https://example.com/prec-case3.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    document.body.appendChild(el);
    await initialIndex(el);

    // Why mixing is unreliable (measured, then traced in Svelte 5.53.3 —
    // it is NOT that one of the writes defers; neither does):
    //
    //   attribute write -> attributeChangedCallback -> `$$c.$set(...)`
    //     (svelte/src/internal/client/dom/elements/custom-element.js:194-199
    //     -> svelte/src/legacy/legacy-client.js:109-113), i.e. a write to
    //     the *props source* the component reads from;
    //   property write  -> the generated accessor
    //     (custom-element.js:313-327 -> legacy-client.js:136-145 -> the
    //     compiled component's own `set canvasIndex`), i.e. `set(d, value)`
    //     on the prop's derived
    //     (svelte/src/internal/client/reactivity/props.js:403-416) — a
    //     *local override* that leaves the props source untouched.
    //
    // Two consequences, both exercised below. (1) After a property write the
    // props source is stale, so a later attribute write repeating that stale
    // value is an equality no-op (sources.js:174-175) and is silently
    // ignored; `reflect` does not help — it writes the attribute back with
    // `$$r` set, which attributeChangedCallback ignores (custom-element.js
    // :154-174, :195). (2) In the same task the local override is discarded
    // whenever the derived recomputes (props.js:389-392), so which write
    // wins depends on hidden flush state — measured over 20 same-task pairs,
    // identical sequences from the same observable index resolved both ways.
    // Hence the README's rule: one channel per key.

    // The attribute channel on its own.
    el.setAttribute("canvas-index", "1");
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(1);

    // The property channel on its own.
    el.canvasIndex = 0;
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(0);

    // Mixed: the props source still holds 1 from the attribute write above,
    // so this attribute write — a whole task later, and visibly a change —
    // does nothing.
    el.setAttribute("canvas-index", "1");
    await new Promise((r) => setTimeout(r, 50));
    expect(el.playerRef!.canvasIndex).toBe(0);
  });
});
