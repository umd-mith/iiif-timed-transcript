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
import { mountElement, removeAllElements, untilShadow } from "./test-helpers";
import {
  mockFetchRoutes,
  deferred,
  MANIFEST_WITHOUT_CHAPTERS,
  MANIFEST_WITH_VTT_CAPTIONS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerErrorDetail } from "./events";

type Seen = { type: string; detail: unknown };

function recordEvents(el: HTMLElement): Seen[] {
  const seen: Seen[] = [];
  for (const type of ["playerrefavailable", "playererror", "canvaschange"]) {
    el.addEventListener(type, (e) =>
      seen.push({ type, detail: (e as CustomEvent).detail }),
    );
  }
  return seen;
}

describe("<iiif-transcript-player> error contract", () => {
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

  test("a failing manifest fires playererror (fatal, manifest) and errorCallback; playerRef stays nullish; no playerrefavailable", async () => {
    const url = "https://example.com/el-404.json";
    mockFetchRoutes({ [url]: { status: 404 } });
    const errorCallback = vi.fn();
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      errorCallback?: unknown;
      playerRef?: unknown;
    };
    el.setAttribute("manifest-url", url);
    el.errorCallback = errorCallback;
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(seen.some((s) => s.type === "playererror")).toBe(true);
    });
    const detail = seen.find((s) => s.type === "playererror")!
      .detail as PlayerErrorDetail;
    expect(detail.fatal).toBe(true);
    expect(detail.source).toBe("manifest");
    expect(detail.error).toBeInstanceOf(Error);
    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect(errorCallback.mock.calls[0]![0]).toBe(detail.error);
    expect(errorCallback.mock.calls[0]![1]).toEqual({
      fatal: true,
      source: "manifest",
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(seen.filter((s) => s.type === "playerrefavailable")).toHaveLength(0);
    expect(el.playerRef == null).toBe(true);
    // Root's own error UI renders inside the shadow root
    await untilShadow(el, '[role="alert"]');
  });

  test("a string assigned to the annotations attribute is a non-fatal host error, fired before playerrefavailable, and not passed to Root", async () => {
    const url = "https://example.com/el-host-misuse.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement;
    el.setAttribute("manifest-url", url);
    el.setAttribute("annotations", "garbage");
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(seen.some((s) => s.type === "playerrefavailable")).toBe(true);
    });
    const types = seen.map((s) => s.type);
    expect(types.indexOf("playererror")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("playererror")).toBeLessThan(
      types.indexOf("playerrefavailable"),
    );
    const detail = seen.find((s) => s.type === "playererror")!
      .detail as PlayerErrorDetail;
    expect(detail).toMatchObject({ fatal: false, source: "host" });
    // The safe default ("auto") reached Root: no transcript, no crash.
    await untilShadow(el, "audio");
    expect(el.shadowRoot!.querySelector(".transcript-panel")).toBeNull();
  });

  test("a non-function errorCallback and preprocessManifest are each reported once as host errors", async () => {
    const url = "https://example.com/el-host-misuse-2.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      errorCallback?: unknown;
      preprocessManifest?: unknown;
    };
    el.setAttribute("manifest-url", url);
    el.errorCallback = "not a function";
    el.preprocessManifest = 42;
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(seen.some((s) => s.type === "playerrefavailable")).toBe(true);
    });
    const hostErrors = seen.filter(
      (s) =>
        s.type === "playererror" &&
        (s.detail as PlayerErrorDetail).source === "host",
    );
    expect(hostErrors).toHaveLength(2);
    expect(
      hostErrors
        .map((s) => (s.detail as PlayerErrorDetail).error.message)
        .sort(),
    ).toEqual([
      "`errorCallback` must be a function; ignoring it",
      "`preprocessManifest` must be a function; ignoring it",
    ]);
  });

  test("a 404 VTT is a non-fatal transcript playererror strictly after playerrefavailable; playback works", async () => {
    const url = "https://example.com/el-vtt-404.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_VTT_CAPTIONS, id: url } },
      "https://example.com/captions-fr.vtt": { status: 404 },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      playerRef?: { state: { error: Error | null } } | null;
    };
    el.setAttribute("manifest-url", url);
    const seen = recordEvents(el);

    // The fixture's <video src> ("https://example.com/video.mp4") is a
    // known-fake URL with nothing playable behind it, so the runner's
    // network posture decides *how* it fails: a real, reachable domain with
    // no video there yields MEDIA_ERR_SRC_NOT_SUPPORTED (code 4), while a
    // network-restricted or offline runner (DNS/connection failure) yields
    // MEDIA_ERR_NETWORK (code 2) instead. Either way it's unrelated to the
    // transcript-tier error this test pins, so swallow *any* error on this
    // known dummy URL in the capture phase, ahead of Viewer's own
    // bubble-phase `onerror` handler, so it can't be mistaken for a fatal
    // media error. The check is narrowed to the known dummy URL (not the
    // error code, which varies by network posture) so a genuine
    // implementation defect — e.g. a VTT/transcript failure incorrectly
    // propagating into media-tier error state via some other code path — is
    // not silently discarded here too; only confounds on this one known
    // sandbox URL are. Media `error` events aren't composed, so the listener
    // must live inside the shadow root (open shadow root exists
    // synchronously on creation).
    const swallowVideoError = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLVideoElement &&
        target.currentSrc === "https://example.com/video.mp4"
      ) {
        e.stopImmediatePropagation();
      }
    };
    el.shadowRoot!.addEventListener("error", swallowVideoError, true);
    try {
      document.body.appendChild(el);

      await vi.waitFor(() => {
        expect(seen.some((s) => s.type === "playererror")).toBe(true);
      });
      const types = seen.map((s) => s.type);
      expect(types.indexOf("playerrefavailable")).toBeGreaterThanOrEqual(0);
      expect(types.indexOf("playerrefavailable")).toBeLessThan(
        types.indexOf("playererror"),
      );
      const detail = seen.find((s) => s.type === "playererror")!
        .detail as PlayerErrorDetail;
      expect(detail).toMatchObject({ fatal: false, source: "transcript" });
      expect(el.playerRef).toBeTruthy();
      expect(el.playerRef!.state.error).toBeNull();
      await untilShadow(el, "video");
      // Native caption track is still attached
      expect(el.shadowRoot!.querySelectorAll("track")).toHaveLength(1);
    } finally {
      el.shadowRoot!.removeEventListener("error", swallowVideoError, true);
    }
  });

  test("disconnecting before the manifest settles fires neither event", async () => {
    const url = "https://example.com/el-disconnect.json";
    const pending = deferred<{ json: unknown }>();
    mockFetchRoutes({ [url]: { promise: pending.promise } });
    const el = await mountElement({ "manifest-url": url });
    const seen = recordEvents(el);
    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    el.remove();
    await Promise.resolve();
    pending.resolve({ json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } });
    await new Promise((r) => setTimeout(r, 50));

    expect(seen).toHaveLength(0);
  });
});
