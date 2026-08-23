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
import {
  mountElement,
  shadow,
  untilShadow,
  waitForEvent,
  removeAllElements,
  withStubMedia,
  silentWavDataUrl,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index.js";
import type { PlayerErrorDetail, PlayerRefAvailableDetail } from "./events";

const MANIFEST_MULTI_CANVAS_STUB = withStubMedia(MANIFEST_MULTI_CANVAS);

type El = HTMLElement & {
  canvasIndex?: number;
  playerRef?: PlayerRef | null;
};

/** Collects the host-tier playererror details fired on `el`. */
function recordHostErrors(el: HTMLElement): PlayerErrorDetail[] {
  const seen: PlayerErrorDetail[] = [];
  el.addEventListener("playererror", (e) => {
    const detail = (e as CustomEvent<PlayerErrorDetail>).detail;
    if (detail.source === "host") seen.push(detail);
  });
  return seen;
}

describe("<iiif-transcript-player> host-input validation", () => {
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

  test("a non-numeric canvas-index is a one-time host error and the player stays on a valid canvas", async () => {
    const url = "https://example.com/el-canvas-nan.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    // Svelte coerces the attribute with `+value`, so this arrives as NaN.
    el.setAttribute("canvas-index", "abc");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    await untilShadow(el, "audio");
    expect(el.playerRef!.canvasIndex).toBe(0);
    expect(hostErrors).toHaveLength(1);
    expect(hostErrors[0]!.fatal).toBe(false);
    expect(hostErrors[0]!.error.message).toContain(
      "`canvas-index` must be a non-negative integer",
    );

    // The channel is not poisoned: a good value afterwards still lands, and
    // attribute, property and player agree.
    el.setAttribute("canvas-index", "1");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });
    expect(el.getAttribute("canvas-index")).toBe("1");
    expect(el.canvasIndex).toBe(1);
    expect(hostErrors).toHaveLength(1);
  });

  test("removing canvas-index after a switch is a host error and returns the player to canvas 0", async () => {
    const url = "https://example.com/el-canvas-removed.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    el.setAttribute("canvas-index", "1");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });
    expect(hostErrors).toHaveLength(0);

    // What a framework binding does when its bound value becomes undefined.
    // Svelte hands the removal to the component as `null`.
    el.removeAttribute("canvas-index");
    await vi.waitFor(() => {
      expect(hostErrors).toHaveLength(1);
    });
    expect(hostErrors[0]!.error.message).toContain(
      "`canvas-index` must be a non-negative integer",
    );
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(0);
      expect(el.getAttribute("canvas-index")).toBe("0");
    });
  });

  test("an out-of-range canvas-index is a one-time host error and leaves the player on canvas 0", async () => {
    const url = "https://example.com/el-canvas-oor.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "99");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    await vi.waitFor(() => {
      expect(hostErrors).toHaveLength(1);
    });
    expect(hostErrors[0]!.fatal).toBe(false);
    expect(hostErrors[0]!.error.message).toContain(
      "`canvas-index` 99 is out of range for 2 canvases",
    );
    await untilShadow(el, "audio");
    expect(el.playerRef!.canvasIndex).toBe(0);

    // Reported once, not once per effect run.
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(1);
  });

  test("connecting without manifest-url is a one-time host error", async () => {
    const el = document.createElement(DEFAULT_TAG) as El;
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(hostErrors).toHaveLength(1);
    });
    expect(hostErrors[0]!.fatal).toBe(false);
    expect(hostErrors[0]!.error.message).toContain(
      "`manifest-url` is required",
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(1);
  });

  test("setting manifest-url in the same task as append reports nothing", async () => {
    const url = "https://example.com/el-late-manifest-url.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);
    el.setAttribute("manifest-url", url);

    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(0);
  });
});

describe("<iiif-transcript-player> reconnection", () => {
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

  test("a re-appended element rebuilds, fires playerrefavailable again and honours canvas-index", async () => {
    const url = "https://example.com/el-reconnect.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = (await mountElement({
      "manifest-url": url,
      "canvas-index": "1",
    })) as El;
    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });

    // Svelte destroys the inner component a microtask after disconnect and
    // rebuilds it on the next connectedCallback, so a remove/re-append that
    // crosses a task boundary is a full re-create.
    el.remove();
    await new Promise((r) => setTimeout(r, 0));
    expect(el.playerRef == null).toBe(true);

    const again = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    document.body.appendChild(el);
    await again;
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });
    expect(el.getAttribute("canvas-index")).toBe("1");
  });

  test("initial-time is applied only on the first connection", async () => {
    const url = "https://example.com/el-reconnect-initial-time.json";
    // Real (silent) WAV media: this test needs state.isReady, which the
    // unplayable `data:` stubs never reach.
    const playable = withStubMedia(MANIFEST_MULTI_CANVAS, {
      audio: silentWavDataUrl(3),
    });
    mockFetchRoutes({ [url]: { json: { ...playable, id: url } } });
    const el = (await mountElement({
      "manifest-url": url,
      "initial-time": "1",
    })) as El;
    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    // seekTo writes mediaElement.currentTime; player.state.currentTime only
    // catches up on the next timeupdate, so read the element itself.
    await vi.waitFor(() => {
      const audio = shadow(el).querySelector("audio");
      expect(audio?.currentTime ?? 0).toBeGreaterThan(0.9);
    });

    el.remove();
    await new Promise((r) => setTimeout(r, 0));
    const again = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    document.body.appendChild(el);
    await again;
    const second = el.playerRef!;
    await vi.waitFor(() => {
      expect(second.state.isReady).toBe(true);
    });
    // The rebuild must NOT re-apply initial-time: `initial-time` is
    // documented as applying once, and a tab/accordion host that re-parents
    // the element would otherwise rewind playback behind the user's back.
    await new Promise((r) => setTimeout(r, 100));
    expect(shadow(el).querySelector("audio")!.currentTime).toBeLessThan(0.5);
  });
});
