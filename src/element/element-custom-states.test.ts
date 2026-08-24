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
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";

const MANIFEST_STUB = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);

// Same technique as element-init.test.ts's simulateMediaReady: the
// fixture's <audio src> is a data: stub that never really reaches
// HAVE_METADATA, so isReady is driven by a synthetic durationchange.
function simulateMediaReady(audio: HTMLMediaElement, duration = 90): void {
  Object.defineProperty(audio, "duration", {
    value: duration,
    configurable: true,
  });
  audio.dispatchEvent(new Event("durationchange"));
}

describe("<iiif-transcript-player> ElementInternals custom states", () => {
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

  test(":state(loading) is set before the manifest resolves and clears once ready; :state(playing) tracks play/pause", async () => {
    const url = "https://example.com/el-states.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_STUB, id: url } } });
    const el = await mountElement({ "manifest-url": url });

    expect(el.matches(":state(loading)")).toBe(true);
    expect(el.matches(":state(playing)")).toBe(false);
    expect(el.matches(":state(error)")).toBe(false);

    const audio = await untilShadow<HTMLAudioElement>(el, "audio");
    const play = vi.fn().mockResolvedValue(undefined);
    audio.play = play;
    simulateMediaReady(audio, 90);

    await vi.waitFor(() => {
      expect(el.matches(":state(loading)")).toBe(false);
    });

    audio.dispatchEvent(new Event("play"));
    await vi.waitFor(() => {
      expect(el.matches(":state(playing)")).toBe(true);
    });

    audio.dispatchEvent(new Event("pause"));
    await vi.waitFor(() => {
      expect(el.matches(":state(playing)")).toBe(false);
    });
  });

  test(":state(error) is set on a fatal manifest failure", async () => {
    const url = "https://example.com/el-states-error.json";
    mockFetchRoutes({ [url]: { status: 404 } });
    const el = await mountElement({ "manifest-url": url });

    await vi.waitFor(() => {
      expect(el.matches(":state(error)")).toBe(true);
    });
  });
});
