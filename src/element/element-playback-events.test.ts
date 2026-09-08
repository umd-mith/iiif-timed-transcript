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
  shadow,
  silentWavDataUrl,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_MULTI_CANVAS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index.js";

type El = HTMLElement & { canvasIndex?: number; playerRef?: PlayerRef | null };

// Real (silent) WAV audio: playback-transition events need a media element
// that actually reaches a playable state, unlike the inert `data:` stub
// used by the host-validation tests.
const MANIFEST_PLAYABLE = withStubMedia(MANIFEST_WITHOUT_CHAPTERS, {
  audio: silentWavDataUrl(3),
});

describe("<iiif-transcript-player> playback events", () => {
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

  test("iiif-player-play fires when actions.play() actually starts playback", async () => {
    const url = "https://example.com/el-play-event.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_PLAYABLE, id: url } },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");
    await vi.waitFor(() => {
      expect(el.playerRef!.state.isReady).toBe(true);
    });

    const played = waitForEvent(el, "iiif-player-play");
    await el.playerRef!.actions.play();
    await played;
  });

  test("iiif-player-pause fires when playback stops without ending", async () => {
    const url = "https://example.com/el-pause-event.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_PLAYABLE, id: url } } });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");
    await vi.waitFor(() => expect(el.playerRef!.state.isReady).toBe(true));
    const played = waitForEvent(el, "iiif-player-play");
    await el.playerRef!.actions.play();
    await played;

    const paused = waitForEvent(el, "iiif-player-pause");
    el.playerRef!.actions.pause();
    await paused;
  });

  test("iiif-player-ended fires and suppresses iiif-player-pause in the same flush", async () => {
    const url = "https://example.com/el-ended-event.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_PLAYABLE, id: url } } });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");
    await vi.waitFor(() => expect(el.playerRef!.state.isReady).toBe(true));

    const pauseSeen: string[] = [];
    el.addEventListener("iiif-player-pause", () => pauseSeen.push("pause"));
    const ended = waitForEvent(el, "iiif-player-ended");

    // Simulate the browser's own ordering: `pause` then `ended` fire in
    // one queued task when playback reaches the end.
    const audio = shadow(el).querySelector("audio")!;
    audio.dispatchEvent(new Event("pause"));
    audio.dispatchEvent(new Event("ended"));

    await ended;
    await new Promise((r) => setTimeout(r, 30));
    expect(pauseSeen).toEqual([]);
  });

  test("iiif-player-seeked fires on seeked, not on seeking", async () => {
    const url = "https://example.com/el-seeked-event.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_PLAYABLE, id: url } } });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");
    await vi.waitFor(() => expect(el.playerRef!.state.isReady).toBe(true));

    const seekedSeen: string[] = [];
    el.addEventListener("iiif-player-seeked", () => seekedSeen.push("seeked"));
    const audio = shadow(el).querySelector("audio")!;

    audio.dispatchEvent(new Event("seeking"));
    await new Promise((r) => setTimeout(r, 10));
    expect(seekedSeen).toEqual([]);

    const seeked = waitForEvent(el, "iiif-player-seeked");
    audio.dispatchEvent(new Event("seeked"));
    await seeked;
  });

  test("iiif-player-rate-change fires with the new rate", async () => {
    const url = "https://example.com/el-rate-event.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_PLAYABLE, id: url } } });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");
    await vi.waitFor(() => expect(el.playerRef!.state.isReady).toBe(true));

    const rateChange = waitForEvent<{ rate: number }>(
      el,
      "iiif-player-rate-change",
    );
    el.playerRef!.actions.setPlaybackRate(2);
    const { detail } = await rateChange;
    expect(detail.rate).toBe(2);
  });

  test("a programmatic canvas switch never fires iiif-player-play", async () => {
    const url = "https://example.com/el-no-play-on-switch.json";
    mockFetchRoutes({
      [url]: { json: { ...withStubMedia(MANIFEST_MULTI_CANVAS), id: url } },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");

    const playSeen: string[] = [];
    el.addEventListener("iiif-player-play", () => playSeen.push("play"));
    const changed = waitForEvent(el, "iiif-player-canvas-change");
    el.canvasIndex = 1;
    await changed;
    await new Promise((r) => setTimeout(r, 30));
    expect(playSeen).toEqual([]);
  });

  test("hasEnded resets on canvas switch", async () => {
    const url = "https://example.com/el-hasended-reset.json";
    mockFetchRoutes({
      [url]: {
        json: {
          ...withStubMedia(MANIFEST_MULTI_CANVAS, {
            audio: silentWavDataUrl(3),
          }),
          id: url,
        },
      },
    });
    const el = (await mountElement({ "manifest-url": url })) as El;
    await waitForEvent(el, "iiif-player-ready");
    await vi.waitFor(() => expect(el.playerRef!.state.isReady).toBe(true));

    const audio = shadow(el).querySelector("audio")!;
    const ended = waitForEvent(el, "iiif-player-ended");
    audio.dispatchEvent(new Event("pause"));
    audio.dispatchEvent(new Event("ended"));
    await ended;
    expect(el.playerRef!.state.hasEnded).toBe(true);

    const changed = waitForEvent(el, "iiif-player-canvas-change");
    el.canvasIndex = 1;
    await changed;
    await vi.waitFor(() => {
      expect(el.playerRef!.state.hasEnded).toBe(false);
    });
  });
});
