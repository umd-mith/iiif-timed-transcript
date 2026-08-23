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
  untilShadow,
  waitForEvent,
  removeAllElements,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index.js";
import type { PlayerRefAvailableDetail } from "./events";

// Root's own initialTime/autoplay/preprocessManifest behavior is pinned
// exhaustively in src/test/player/Root.svelte.test.ts. These tests only pin
// the *wiring* through the wrapper: that the `initial-time`/`autoplay`
// attributes and the `preprocessManifest` property actually reach Root as
// the props of the same name (a typo in the conditional spread building
// `optionalRootProps` would otherwise be silent).
type El = HTMLElement & { playerRef?: PlayerRef | null };

// The fixture's <audio src> is a fake domain, so it never really reaches
// HAVE_METADATA. Real media elements report a spec-defined "default
// playback start position" from `currentTime` while readyState is
// HAVE_NOTHING, so overriding `duration` (an own-property shadow of the
// native getter) and dispatching a real `durationchange` event reproduces
// Root's isReady wiring (see Root.svelte's `handleDurationChange`) without
// needing a fetchable media file.
function simulateMediaReady(audio: HTMLMediaElement, duration = 90): void {
  Object.defineProperty(audio, "duration", {
    value: duration,
    configurable: true,
  });
  audio.dispatchEvent(new Event("durationchange"));
}

describe("<iiif-transcript-player> initial-time, autoplay, preprocessManifest wiring", () => {
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

  test("initial-time reaches Root and seeks once media is ready", async () => {
    const url = "https://example.com/el-initial-time.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });
    const el = (await mountElement({
      "manifest-url": url,
      "initial-time": "30",
    })) as El;
    const { detail } = await waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    const audio = await untilShadow<HTMLAudioElement>(el, "audio");

    simulateMediaReady(audio, 90);

    await vi.waitFor(() => {
      expect(detail.playerRef.state.currentTime).toBe(30);
    });
    expect(audio.currentTime).toBe(30);
  });

  test("autoplay set → play() runs once media is ready", async () => {
    const url = "https://example.com/el-autoplay.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });
    const el = (await mountElement({
      "manifest-url": url,
      autoplay: "",
    })) as El;
    await waitForEvent<PlayerRefAvailableDetail>(el, "playerrefavailable");
    const audio = await untilShadow<HTMLAudioElement>(el, "audio");
    const play = vi.fn().mockResolvedValue(undefined);
    audio.play = play;

    simulateMediaReady(audio, 90);

    await vi.waitFor(() => {
      expect(play).toHaveBeenCalled();
    });
  });

  test("a valid preprocessManifest function is applied before validation", async () => {
    const url = "https://example.com/el-preprocess.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as El & {
      preprocessManifest?: (raw: unknown) => unknown;
    };
    el.setAttribute("manifest-url", url);
    el.preprocessManifest = (raw) => {
      const manifest = raw as { items: Record<string, unknown>[] };
      return {
        ...manifest,
        items: manifest.items.map((canvas, index) =>
          index === 0
            ? { ...canvas, label: { en: ["Rewritten Label"] } }
            : canvas,
        ),
      };
    };
    document.body.appendChild(el);

    const { detail } = await waitForEvent<PlayerRefAvailableDetail>(
      el,
      "playerrefavailable",
    );
    expect(detail.playerRef.canvases[0]!.label).toBe("Rewritten Label");
  });
});
