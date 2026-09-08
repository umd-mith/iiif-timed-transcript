// NOTE: this suite asserts against the CURRENT event name
// "playerrefavailable" (pre-3.1 rename). Hardening spec 3.1 renames it to
// "iiif-player-ready" — when that lands, flip every occurrence below.
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
  waitForEvent,
  untilShadow,
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
import type { PlayerRefAvailableDetail } from "./events";

type El = HTMLElement & {
  playerRef?: PlayerRef | null;
  connectedMoveCallback?: () => void;
};

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

  test("remove + re-append rebuilds the player: a fresh playerRef, a second playerrefavailable, and initial-time is not re-applied", async () => {
    const url = "https://example.com/el-reattach.json";
    const playable = withStubMedia(MANIFEST_MULTI_CANVAS, {
      audio: silentWavDataUrl(3),
    });
    mockFetchRoutes({ [url]: { json: { ...playable, id: url } } });

    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("initial-time", "1");
    document.body.appendChild(el);

    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    const audio1 = await untilShadow<HTMLAudioElement>(el, "audio");
    await vi.waitFor(() => {
      expect(el.playerRef!.state.isReady).toBe(true);
    });
    // The valid initial-time actually applied on this first connection.
    await vi.waitFor(() => {
      expect(audio1.currentTime).toBeGreaterThan(0.9);
    });
    const firstPlayerRef = el.playerRef;

    // Remove and re-append a task apart — a real disconnect/reconnect, not
    // the synchronous same-task move the README calls a no-op.
    el.remove();
    await new Promise((r) => setTimeout(r, 0));
    const secondEvent = waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    document.body.appendChild(el);
    const { detail: secondDetail } = await secondEvent;

    // A fresh player: a new playerRef, distinct from the first.
    expect(secondDetail.playerRef).not.toBe(firstPlayerRef);

    const audio2 = await untilShadow<HTMLAudioElement>(el, "audio");
    await vi.waitFor(() => {
      expect(el.playerRef!.state.isReady).toBe(true);
    });
    // `initial-time` applies only on the element's first connection (README,
    // "Reconnection") — the WeakSet latch (initialTimeAppliedHosts, keyed on
    // the host element so it survives the inner-component rebuild) must have
    // suppressed the seek on this second connection.
    await new Promise((r) => setTimeout(r, 50));
    expect(audio2.currentTime).toBe(0);
  });

  test("connectedMoveCallback is defined and a no-op", async () => {
    const url = "https://example.com/el-move-noop.json";
    mockFetchRoutes({
      [url]: { json: { ...withStubMedia(MANIFEST_MULTI_CANVAS), id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    document.body.appendChild(el);
    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    const playerRefBefore = el.playerRef;

    expect(typeof el.connectedMoveCallback).toBe("function");
    expect(() => el.connectedMoveCallback!()).not.toThrow();

    // A true no-op: calling it directly does not run Svelte's
    // disconnect/reconnect teardown (custom-element.js:201-211), so the same
    // playerRef instance survives.
    await new Promise((r) => setTimeout(r, 20));
    expect(el.playerRef).toBe(playerRefBefore);
  });
});
