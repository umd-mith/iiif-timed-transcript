import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushSync } from "svelte";
import TestRootTranscriptSegments from "./TestRootTranscriptSegments.svelte";
import { mockFetchRoutes, deferred, type FetchRoute } from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";
import type { PlayerContext } from "../../lib/player/context";

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
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
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

    let ctx: PlayerContext | null = null;
    mount(TestRootTranscriptSegments, {
      target,
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
    expect(panelText(target)).toContain("BRAVO interview");
    expect(panelText(target)).not.toContain("ALPHA interview");

    // 7. Resolve A late — the canvas we already left.
    aVtt.resolve({ text: A_VTT_BODY });
    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    // 8. BRAVO still owns the panel; the stale A response was dropped.
    expect(panelText(target)).toContain("BRAVO interview");
    expect(panelText(target)).not.toContain("ALPHA interview");

    // 9-10. The selectable segment on screen carries BRAVO's timing (0:23),
    // not ALPHA's (0:07) — so selecting it seeks to B's time, by construction.
    const segment = target.querySelector<HTMLElement>(
      '[role="button"][data-annotation-id]',
    );
    expect(segment).not.toBeNull();
    expect(segment!.textContent).toContain("0:23");
    expect(segment!.textContent).not.toContain("0:07");
  });
});
