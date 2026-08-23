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

/**
 * A `data:` stub for this file's media: the element test only needs a canvas
 * whose <video> exists and never plays, and pointing it at a real host makes
 * the outcome depend on the runner's network posture. Not changed in
 * src/test/player/test-fixtures.ts — the lib tests share that fixture.
 */
const UNPLAYABLE_MEDIA = "data:video/mp4;base64,AAAAAA==";

const MANIFEST_VTT_UNPLAYABLE_MEDIA = {
  ...MANIFEST_WITH_VTT_CAPTIONS,
  items: MANIFEST_WITH_VTT_CAPTIONS.items.map((canvas) => ({
    ...canvas,
    items: canvas.items.map((page) => ({
      ...page,
      items: page.items.map((annotation) => ({
        ...annotation,
        body: { ...annotation.body, id: UNPLAYABLE_MEDIA },
      })),
    })),
  })),
};

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

  test("assigning errorCallback after a reported host error does not re-fire it", async () => {
    const url = "https://example.com/el-host-misuse-3.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITHOUT_CHAPTERS, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      errorCallback?: unknown;
    };
    // `annotations` misuse is reported once, in the wrapper's first flush —
    // this is the documented <script src> host pattern (attributes in
    // markup, properties assigned after the element is defined).
    el.setAttribute("manifest-url", url);
    el.setAttribute("annotations", "garbage");
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(
        seen.filter(
          (s) =>
            s.type === "playererror" &&
            (s.detail as PlayerErrorDetail).source === "host",
        ),
      ).toHaveLength(1);
    });

    // report() must read errorCallback untracked so this later assignment
    // does not re-run the (still-failing) annotations validator effect.
    const errorCallback = vi.fn();
    el.errorCallback = errorCallback;
    await new Promise((r) => setTimeout(r, 50));

    const hostErrors = seen.filter(
      (s) =>
        s.type === "playererror" &&
        (s.detail as PlayerErrorDetail).source === "host",
    );
    expect(hostErrors).toHaveLength(1);
    // The callback assigned after the fact never receives the stale error.
    expect(errorCallback).not.toHaveBeenCalled();
  });

  test("a 404 VTT is a non-fatal transcript playererror strictly after playerrefavailable; playback works", async () => {
    const url = "https://example.com/el-vtt-404.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_VTT_UNPLAYABLE_MEDIA, id: url } },
      "https://example.com/captions-fr.vtt": { status: 404 },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      playerRef?: { state: { error: Error | null } } | null;
    };
    el.setAttribute("manifest-url", url);
    const seen = recordEvents(el);

    // This canvas's media is a `data:` stub (see UNPLAYABLE_MEDIA): the
    // <video> can never play it, but it fails locally and immediately —
    // measured in this runner as MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) on
    // every run, with no request leaving the browser. The swallow is still
    // needed, because any unplayable source fires `error` and Viewer's own
    // bubble-phase `onerror` would turn it into a media-tier playererror
    // that this transcript-tier test would then trip over. It is narrowed to
    // that one src so a genuine defect — e.g. a transcript failure leaking
    // into media-tier error state by another path — is not swallowed too.
    // Media `error` events aren't composed, so the listener must live inside
    // the shadow root (the open shadow root exists synchronously on
    // creation).
    const swallowVideoError = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLVideoElement &&
        target.currentSrc === UNPLAYABLE_MEDIA
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
