import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestRootTranscriptSegments from "./TestRootTranscriptSegments.svelte";
import { mockFetchRoutes, deferred, type FetchRoute } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";
import type { PlayerContext } from "../../lib/player/context";

// Wrap the REAL loadVTTTranscript to capture the exact promise Root awaits per
// URL, so step 7 can await A's whole chain (fetch → text → parse → Root's
// generation re-check) as an explicit completion signal, not a wall-clock
// guess. Module namespaces aren't spy-able in browser-mode ESM, so intercept at
// import with vi.mock (same pattern the hls.js tests use).
const { vttRegistry } = vi.hoisted(() => ({
  vttRegistry: new Map<string, Promise<unknown>>(),
}));
vi.mock("../../lib/iiif/vttTranscript", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/iiif/vttTranscript")>();
  return {
    ...actual,
    loadVTTTranscript: (url: string, language?: string) => {
      const p = actual.loadVTTTranscript(url, language);
      vttRegistry.set(url, p);
      return p;
    },
  };
});

// Transcript-ownership harness (canvas switch).
//
// Question: can a LATE external-VTT response for a previous canvas overwrite
// the transcript of the canvas the viewer has since switched to?
//
// The scenario is distinguishable by construction — two canvases with
// unmistakably different transcript text AND timestamps — so a stale response
// is unambiguous when it appears. Expected text/timestamps come from these
// fixtures, never from the library's own VTT parser.
//
// Preconditions that make the guard (transcriptGeneration, Root.svelte) the
// thing under test: annotations="auto" AND transcripts delivered as EXTERNAL
// VTT `supplementing` tracks (tier 2), which is the only path that issues a
// deferrable fetch. An embedded TextualBody transcript resolves synchronously
// with nothing to race.
//
// Calibrated ("test the test"): with the generation re-check in
// resolveVTTTranscript (Root.svelte) temporarily disabled, this test fails at
// step 8 — the late ALPHA response overwrites BRAVO. So it detects the fault,
// not merely the current (correct) behavior. The guard already exists, so this
// is a regression lock on a previously-untested path, not a bug report.

const MANIFEST_URL = "https://example.com/manifest-ownership.json";
const A_VTT = "https://example.com/alpha.vtt";
const B_VTT = "https://example.com/bravo.vtt";

const A_VTT_BODY = `WEBVTT

00:00:07.000 --> 00:00:12.000
ALPHA interview
`;
const B_VTT_BODY = `WEBVTT

00:00:23.000 --> 00:00:28.000
BRAVO interview
`;

// A video canvas whose only supplement is an external VTT track (no embedded
// TextualBody), so annotations="auto" takes the tier-2 fetch path.
function videoCanvasWithVtt(n: number, vttUrl: string) {
  return {
    id: `${MANIFEST_URL}/canvas/${n}`,
    type: "Canvas",
    duration: 300,
    items: [
      {
        id: `${MANIFEST_URL}/canvas/${n}/page/1`,
        type: "AnnotationPage",
        items: [
          {
            id: `${MANIFEST_URL}/canvas/${n}/page/1/annotation/1`,
            type: "Annotation",
            motivation: "painting",
            body: {
              id: `https://example.com/video-${n}.mp4`,
              type: "Video",
              format: "video/mp4",
            },
            target: `${MANIFEST_URL}/canvas/${n}`,
          },
        ],
      },
    ],
    annotations: [
      {
        id: `${MANIFEST_URL}/canvas/${n}/annotations/1`,
        type: "AnnotationPage",
        items: [
          {
            id: `${MANIFEST_URL}/canvas/${n}/annotations/1/annotation/1`,
            type: "Annotation",
            motivation: "supplementing",
            body: {
              id: vttUrl,
              type: "Text",
              format: "text/vtt",
              language: "en",
              label: { en: ["Captions"] },
            },
            target: `${MANIFEST_URL}/canvas/${n}`,
          },
        ],
      },
    ],
  };
}

const MANIFEST = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: MANIFEST_URL,
  type: "Manifest",
  label: { en: ["Ownership harness"] },
  items: [videoCanvasWithVtt(1, A_VTT), videoCanvasWithVtt(2, B_VTT)],
};

function panelText(target: HTMLElement): string {
  return target.textContent ?? "";
}

describe("transcript ownership across a canvas switch", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    manifestCache.clear();
    vi.restoreAllMocks();
  });

  test("a late VTT response for canvas A cannot replace canvas B's transcript", async () => {
    const aVtt = deferred<FetchRoute>();
    const bVtt = deferred<FetchRoute>();
    mockFetchRoutes({
      [MANIFEST_URL]: { json: MANIFEST },
      [A_VTT]: { promise: aVtt.promise },
      [B_VTT]: { promise: bVtt.promise },
    });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const requested = (url: string) =>
      fetchMock.mock.calls.some((c) => String(c[0]) === url);
    vttRegistry.clear();

    let ctx: PlayerContext | null = null;
    const { container } = render(TestRootTranscriptSegments, {
      props: {
        manifestUrl: MANIFEST_URL,
        annotations: "auto",
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    // 1-2. Canvas A mounted; A's VTT request is outstanding (issued, unresolved).
    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.canvasIndex).toBe(0);
      expect(requested(A_VTT)).toBe(true);
    });
    expect(ctx!.transcriptStatus).toBe("loading");

    // 3-4. Switch to B while A is still pending; B's VTT request goes out too.
    ctx!.actions.switchCanvas(1);
    await vi.waitFor(() => {
      expect(ctx!.canvasIndex).toBe(1);
      expect(requested(B_VTT)).toBe(true);
    });

    // Prove the harness actually reproduces the race: BOTH requests outstanding.
    expect(requested(A_VTT)).toBe(true);
    expect(requested(B_VTT)).toBe(true);

    // 5. Resolve B (the current canvas).
    bVtt.resolve({ text: B_VTT_BODY });
    await vi.waitFor(() => expect(ctx!.transcriptStatus).toBe("ready"));
    flushSync();

    // 6. BRAVO shows; ALPHA never did.
    expect(panelText(container)).toContain("BRAVO interview");
    expect(panelText(container)).not.toContain("ALPHA interview");

    // 7. Resolve A late — the canvas we already left. Await A's OWN
    // loadVTTTranscript promise (the exact operation Root awaits), so its
    // fetch→text→parse and Root's generation re-check have all run before the
    // assertions below — a stale overwrite would provably have landed by now.
    // Not a wall-clock guess.
    aVtt.resolve({ text: A_VTT_BODY });
    await vi.waitFor(() => expect(vttRegistry.has(A_VTT)).toBe(true));
    await vttRegistry.get(A_VTT);
    await Promise.resolve(); // let Root's post-await continuation run
    flushSync();

    // 8. BRAVO still owns the panel; the stale A response was dropped.
    expect(panelText(container)).toContain("BRAVO interview");
    expect(panelText(container)).not.toContain("ALPHA interview");

    // 9-10. Actually SELECT the rendered segment (a broken click handler must
    // not pass). Drive the media element to ready with a duration so seekTo
    // doesn't early-return or clamp, then click and assert the seek target is
    // BRAVO's 23s — not ALPHA's 7s.
    const segment = container.querySelector<HTMLElement>(
      '[role="button"][data-annotation-id]',
    );
    expect(segment).not.toBeNull();
    expect(segment!.textContent).toContain("0:23");

    const media = ctx!.mediaElement as HTMLMediaElement;
    Object.defineProperty(media, "duration", {
      configurable: true,
      value: 300,
    });
    media.dispatchEvent(new Event("durationchange"));
    flushSync();
    expect(ctx!.state.isReady).toBe(true);
    expect(ctx!.state.duration).toBeGreaterThanOrEqual(23);

    segment!.click();
    flushSync();
    expect(media.currentTime).toBeCloseTo(23, 3);
  });
});
