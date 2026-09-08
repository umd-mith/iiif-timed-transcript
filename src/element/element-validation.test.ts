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

/** Collects the host-tier iiif-player-error details fired on `el`. */
function recordHostErrors(el: HTMLElement): PlayerErrorDetail[] {
  const seen: PlayerErrorDetail[] = [];
  el.addEventListener("iiif-player-error", (e) => {
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

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    await untilShadow(el, "audio");
    expect(el.playerRef!.canvasIndex).toBe(0);
    expect(hostErrors).toHaveLength(1);
    expect(hostErrors[0]!.fatal).toBe(false);
    expect(hostErrors[0]!.error.message).toContain(
      "`canvas-index` must be a non-negative integer",
    );
    // The reflected attribute is repaired to the value actually in use.
    // Reflection writes `+value`, so without the repair the attribute is
    // left reading the literal "NaN".
    await vi.waitFor(() => {
      expect(el.getAttribute("canvas-index")).toBe("0");
    });

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

  test("removing canvas-index after a switch returns the player to canvas 0 with no host error", async () => {
    const url = "https://example.com/el-canvas-removed.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    el.setAttribute("canvas-index", "1");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(1);
    });
    expect(hostErrors).toHaveLength(0);

    // Removal is HTML for "back to the default", and it is what a framework
    // binding does when its bound value becomes undefined — not misuse.
    // Svelte hands the removal to the component as `null`.
    el.removeAttribute("canvas-index");
    await vi.waitFor(() => {
      expect(el.playerRef!.canvasIndex).toBe(0);
    });
    // The switch back to 0 reflects the live index, so the attribute
    // reappears as "0"; what must not happen is a host error.
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(0);
  });

  test("removing canvas-index while already on canvas 0 changes nothing and does not re-add the attribute", async () => {
    const url = "https://example.com/el-canvas-removed-at-zero.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("canvas-index", "0");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    await untilShadow(el, "audio");
    el.removeAttribute("canvas-index");

    // No error, no canvas switch, and — because there is no switch to
    // reflect — nothing re-adds the attribute. A host that removes it in a
    // loop therefore has nothing to loop against.
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(0);
    expect(el.playerRef!.canvasIndex).toBe(0);
    expect(el.hasAttribute("canvas-index")).toBe(false);
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

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
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

  test("a non-numeric initial-time is a one-time host error, never seeks, and does not burn the once-per-host latch", async () => {
    const url = "https://example.com/el-initial-time-nan.json";
    // Real (silent) WAV media: a seek needs a media element that decodes.
    const playable = withStubMedia(MANIFEST_MULTI_CANVAS, {
      audio: silentWavDataUrl(3),
    });
    mockFetchRoutes({ [url]: { json: { ...playable, id: url } } });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    // Coerced with `+value`, so this arrives as NaN.
    el.setAttribute("initial-time", "abc");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    await vi.waitFor(() => {
      expect(hostErrors).toHaveLength(1);
    });
    expect(hostErrors[0]!.fatal).toBe(false);
    expect(hostErrors[0]!.error.message).toContain("`initial-time`");
    const audio = await untilShadow<HTMLAudioElement>(el, "audio");
    await vi.waitFor(() => {
      expect(el.playerRef!.state.isReady).toBe(true);
    });
    // Reported once, and nothing ever seeked.
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(1);
    expect(audio.currentTime).toBe(0);

    // The latch is per host and must not have been burned by a value that
    // never applied: a valid initial-time on the next connection still works.
    el.remove();
    await new Promise((r) => setTimeout(r, 0));
    el.setAttribute("initial-time", "1");
    const again = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "iiif-player-ready",
    );
    document.body.appendChild(el);
    await again;
    await vi.waitFor(() => {
      expect(shadow(el).querySelector("audio")!.currentTime).toBeGreaterThan(
        0.9,
      );
    });
  });

  test("a negative initial-time is a one-time host error and never seeks", async () => {
    const url = "https://example.com/el-initial-time-negative.json";
    const playable = withStubMedia(MANIFEST_MULTI_CANVAS, {
      audio: silentWavDataUrl(3),
    });
    mockFetchRoutes({ [url]: { json: { ...playable, id: url } } });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("initial-time", "-5");
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    await vi.waitFor(() => {
      expect(hostErrors).toHaveLength(1);
    });
    expect(hostErrors[0]!.error.message).toContain("`initial-time`");
    const audio = await untilShadow<HTMLAudioElement>(el, "audio");
    await vi.waitFor(() => {
      expect(el.playerRef!.state.isReady).toBe(true);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(1);
    expect(audio.currentTime).toBe(0);
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

    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    await new Promise((r) => setTimeout(r, 50));
    expect(hostErrors).toHaveLength(0);
  });

  test("clearing manifest-url clears playerRef, and setting it again fires iiif-player-ready", async () => {
    const url = "https://example.com/el-manifest-url-cleared.json";
    const other = "https://example.com/el-manifest-url-cleared-2.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
      [other]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: other } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    document.body.appendChild(el);
    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
    expect(el.playerRef).toBeTruthy();

    // Removing the URL unmounts the player. A `playerRef` left pointing at
    // the destroyed component would hand the host live-looking `actions`
    // that do nothing.
    el.removeAttribute("manifest-url");
    await vi.waitFor(() => {
      expect(el.playerRef == null).toBe(true);
    });
    expect(shadow(el).querySelector("audio")).toBeNull();

    const again = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "iiif-player-ready",
    );
    el.setAttribute("manifest-url", other);
    await again;
    expect(el.playerRef).toBeTruthy();
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

  test("a re-appended element rebuilds, fires iiif-player-ready again and honours canvas-index", async () => {
    const url = "https://example.com/el-reconnect.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_MULTI_CANVAS_STUB, id: url } },
    });
    const el = (await mountElement({
      "manifest-url": url,
      "canvas-index": "1",
    })) as El;
    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
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
      "iiif-player-ready",
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
    await waitForEvent<PlayerRefAvailableDetail>(el, "iiif-player-ready");
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
      "iiif-player-ready",
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

  test("a failed first load does not burn the initial-time latch", async () => {
    const url = "https://example.com/el-reconnect-after-404.json";
    mockFetchRoutes({ [url]: { status: 404, text: "not found" } });
    const el = (await mountElement({
      "manifest-url": url,
      "initial-time": "1",
    })) as El;
    // The fetch 404s, so no player ever exists on this connection.
    await waitForEvent<PlayerErrorDetail>(el, "iiif-player-error");
    expect(el.playerRef == null).toBe(true);

    el.remove();
    await new Promise((r) => setTimeout(r, 0));

    // The server works now; the same node is re-appended (tab/accordion
    // hosts re-parent rather than re-create). initial-time was never
    // applied, so this connection must still apply it.
    const playable = withStubMedia(MANIFEST_MULTI_CANVAS, {
      audio: silentWavDataUrl(3),
    });
    mockFetchRoutes({ [url]: { json: { ...playable, id: url } } });
    const again = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "iiif-player-ready",
    );
    document.body.appendChild(el);
    await again;
    await vi.waitFor(() => {
      const audio = shadow(el).querySelector("audio");
      expect(audio?.currentTime ?? 0).toBeGreaterThan(0.9);
    });
  });
});
