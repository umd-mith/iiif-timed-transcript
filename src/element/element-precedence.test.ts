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
// A third tag for the attribute-less pin (case 2b): its own tag keeps the
// "not yet defined" precondition true independently of UPGRADE_TAG, which
// case 2 already defines during this same test run.
const UPGRADE_TAG_NO_ATTR = "iiif-tp-precedence-upgrade-no-attr";

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
    removeAllElements(UPGRADE_TAG_NO_ATTR);
    manifestCache.clear();
  });

  /**
   * Waits for the first canvas to settle and asserts which index won. The
   * trailing sleep is a stability check ("and it stays there"), not the
   * synchronisation: the positive assertion is the `vi.waitFor` above it.
   */
  async function expectInitialIndex(el: El, expected: number): Promise<void> {
    const { detail } = await waitForEvent<PlayerRefAvailableDetail>(
      el,
      "iiif-player-ready",
    );
    // Root applies the prop on first load; wait for it to settle.
    await vi.waitFor(() => {
      expect(detail.playerRef.canvasCount).toBe(2);
      expect(detail.playerRef.canvasIndex).toBe(expected);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(detail.playerRef.canvasIndex).toBe(expected);
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
    await expectInitialIndex(el, 1);
  });

  test("case 2 — upgrade in place: a pre-upgrade property write wins over a same-name attribute (the standard custom-element upgrade dance), and does not shadow the accessor afterward", async () => {
    const url = "https://example.com/prec-case2.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });

    // Element exists before the tag is defined (like markup parsed before the
    // IIFE <script> runs) — the case that actually triggers the shadowing
    // bug (design 1.1): Svelte's generated connectedCallback attribute loop
    // (custom-element.js:126-132) runs before the property-port loop
    // (custom-element.js:133-142), so the SAME key being present as an
    // attribute is what made the port loop skip the pre-upgrade property.
    expect(customElements.get(UPGRADE_TAG)).toBeUndefined();
    const el = document.createElement(UPGRADE_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    el.canvasIndex = 1; // plain own data property on an HTMLElement
    document.body.appendChild(el);

    register(UPGRADE_TAG); // define() upgrades existing elements synchronously
    await expectInitialIndex(el, 1); // the property won, not the attribute

    // No own property is left shadowing the prototype accessor.
    expect(Object.prototype.hasOwnProperty.call(el, "canvasIndex")).toBe(false);

    // A later write on the same key still reaches the player.
    el.canvasIndex = 0;
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(0);
    });

    // A fresh element of the now-defined tag: identical (case-1) semantics.
    const fresh = document.createElement(UPGRADE_TAG) as El;
    fresh.setAttribute("manifest-url", url);
    fresh.setAttribute("canvas-index", "0");
    fresh.canvasIndex = 1;
    document.body.appendChild(fresh);
    await expectInitialIndex(fresh, 1);
  });

  test("case 2b — upgrade in place, no attribute: a pre-upgrade property write with nothing to shadow upgrades cleanly (already-correct Svelte behavior; a regression pin, not a fix)", async () => {
    const url = "https://example.com/prec-case2b.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });

    // Same create-before-define shape as case 2, but no `canvas-index`
    // attribute at all — nothing for the attribute loop to win with, so this
    // path was already correct before 1.1 (design 1.1: "the attribute-less
    // paths already work today"). No such regression test existed before.
    expect(customElements.get(UPGRADE_TAG_NO_ATTR)).toBeUndefined();
    const el = document.createElement(UPGRADE_TAG_NO_ATTR) as El;
    el.setAttribute("manifest-url", url);
    el.canvasIndex = 1;
    document.body.appendChild(el);

    register(UPGRADE_TAG_NO_ATTR);
    await expectInitialIndex(el, 1);
    expect(Object.prototype.hasOwnProperty.call(el, "canvasIndex")).toBe(false);
  });

  test("case 3 — after upgrade each channel works on its own, and an attribute write still lands after a property write, because every canvas switch refreshes the props source", async () => {
    const url = "https://example.com/prec-case3.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    document.body.appendChild(el);
    await expectInitialIndex(el, 0);

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
    // Left to itself that would leave the props source stale after every
    // property write, so a later attribute write repeating that stale value
    // would be an equality no-op (sources.js:174-175) and be silently
    // ignored; `reflect` does not help — it writes the attribute back with
    // `$$r` set, which attributeChangedCallback ignores (custom-element.js
    // :154-174, :195).
    //
    // The element closes that hole: onCanvasChange writes the attribute
    // explicitly (IIIFTranscriptPlayerElement.svelte, handleCanvasChange),
    // and that unguarded write refreshes the props source. So after ANY
    // canvas switch — host attribute, host property, or CanvasNav — the
    // attribute, the props source and the prop all hold the live index, and
    // both channels keep working. The one residue of the Svelte behaviour is
    // ordering: the local override is discarded whenever the derived
    // recomputes (props.js:389-392), so two writes issued in the SAME task
    // can still resolve either way — measured over 20 same-task pairs,
    // identical sequences resolved both ways. Hence the README's rule: one
    // channel per key.

    // The attribute channel on its own.
    el.setAttribute("canvas-index", "1");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });

    // The property channel on its own.
    el.canvasIndex = 0;
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(0);
    });

    // Mixed, a task apart: the property write above switched the canvas, so
    // the props source was refreshed to 0 and this attribute write is a real
    // change again.
    el.setAttribute("canvas-index", "1");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });
    expect(el.getAttribute("canvas-index")).toBe("1");
    expect(el.canvasIndex).toBe(1);
  });
});
