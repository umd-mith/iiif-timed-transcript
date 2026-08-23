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
  removeAllElements,
  untilShadow,
  withStubMedia,
} from "./test-helpers";
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

// File-local copies whose media are the `data:` stubs (see withStubMedia):
// no request leaves the browser, so no media-tier error can race the
// host-tier assertions below on a runner where example.com resolves.
const MANIFEST_VTT_UNPLAYABLE_MEDIA = withStubMedia(MANIFEST_WITH_VTT_CAPTIONS);
const MANIFEST_STUB_MEDIA = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);

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
      [url]: { json: { ...MANIFEST_STUB_MEDIA, id: url } },
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
      [url]: { json: { ...MANIFEST_STUB_MEDIA, id: url } },
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
      [url]: { json: { ...MANIFEST_STUB_MEDIA, id: url } },
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
    // Scoped to the host tier, like the count above: this test says nothing
    // about media/transcript-tier reports, and asserting on the unscoped
    // call list would make it fail on any unrelated report.
    expect(
      errorCallback.mock.calls.filter(
        ([, info]) => (info as { source?: string }).source === "host",
      ),
    ).toHaveLength(0);
  });

  test("a 404 VTT is a non-fatal transcript playererror strictly after playerrefavailable; the player and its native caption track survive", async () => {
    const url = "https://example.com/el-vtt-404.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_VTT_UNPLAYABLE_MEDIA, id: url } },
      "https://example.com/captions-fr.vtt": { status: 404 },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      playerRef?: unknown;
    };
    el.setAttribute("manifest-url", url);
    const seen = recordEvents(el);
    document.body.appendChild(el);

    // This canvas's media is a `data:` stub (see withStubMedia): the <video>
    // can never play it, so a media-tier playererror may also arrive. That is
    // not what this test is about, so every assertion below is scoped to the
    // transcript tier rather than swallowing the media `error` event.
    //
    // The rendered <track src="https://example.com/captions-fr.vtt"> comes
    // from the shared lib fixture and is the one URL in the element tests the
    // browser still requests for real: <track> fetches natively, outside the
    // mocked `fetch`. Harmless either way — no assertion here depends on its
    // outcome (only that the element exists), and the transcript tier reads
    // the same URL through the mocked fetch, which 404s deterministically.
    await vi.waitFor(() => {
      expect(
        seen.some(
          (s) =>
            s.type === "playererror" &&
            (s.detail as PlayerErrorDetail).source === "transcript",
        ),
      ).toBe(true);
    });
    const types = seen.map((s) => s.type);
    const transcriptAt = seen.findIndex(
      (s) =>
        s.type === "playererror" &&
        (s.detail as PlayerErrorDetail).source === "transcript",
    );
    expect(types.indexOf("playerrefavailable")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("playerrefavailable")).toBeLessThan(transcriptAt);
    expect(seen[transcriptAt]!.detail).toMatchObject({
      fatal: false,
      source: "transcript",
    });
    expect(el.playerRef).toBeTruthy();
    await untilShadow(el, "video");
    // Native caption track is still attached
    expect(el.shadowRoot!.querySelectorAll("track")).toHaveLength(1);
  });

  test("a fatal media error arrives after playerrefavailable and leaves playerRef set", async () => {
    // The readiness contract is scoped: `playerRef` stays nullish only for a
    // fatal manifest / first-canvas failure. Media failures are detected by
    // the <video>/<audio> element, which exists only after onPlayerInit has
    // already handed the ref over — so a fatal media error is a fatal error
    // that arrives with `playerRef` set, and it stays set.
    const url = "https://example.com/el-fatal-media.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_STUB_MEDIA, id: url } },
    });
    const el = document.createElement(DEFAULT_TAG) as HTMLElement & {
      playerRef?: unknown;
    };
    el.setAttribute("manifest-url", url);
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(
        seen.some(
          (s) =>
            s.type === "playererror" &&
            (s.detail as PlayerErrorDetail).source === "media",
        ),
      ).toBe(true);
    });
    const mediaAt = seen.findIndex(
      (s) =>
        s.type === "playererror" &&
        (s.detail as PlayerErrorDetail).source === "media",
    );
    expect(seen[mediaAt]!.detail).toMatchObject({
      fatal: true,
      source: "media",
    });
    const refAt = seen.findIndex((s) => s.type === "playerrefavailable");
    expect(refAt).toBeGreaterThanOrEqual(0);
    expect(refAt).toBeLessThan(mediaAt);
    expect(el.playerRef).toBeTruthy();
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
    pending.resolve({ json: { ...MANIFEST_STUB_MEDIA, id: url } });
    await new Promise((r) => setTimeout(r, 50));

    expect(seen).toHaveLength(0);
  });
});
