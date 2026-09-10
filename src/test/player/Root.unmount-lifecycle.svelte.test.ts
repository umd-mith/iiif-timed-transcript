import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestRootContextCapture from "./TestRootContextCapture.svelte";
import type { PlayerContext } from "../../lib/player/context";
import {
  MANIFEST_WITH_VTT_CAPTIONS,
  mockFetchRoutes,
  deferred,
  VTT_FIXTURE_OK,
  type FetchRoute,
} from "./test-fixtures";
import { manifestCache } from "../../lib/player/manifestCache";

// Wrap the REAL loadVTTTranscript to capture the exact promise Root awaits, so
// the test can await its whole chain (fetch → text → parse → Root's destroyed
// re-check) as an explicit completion signal rather than a microtask/wall-clock
// guess. Module namespaces aren't spy-able in browser-mode ESM, so intercept at
// import with vi.mock (same pattern as the transcript-ownership harness).
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

// Regression guard for Finding 3: once a component is unmounted, in-flight
// async work must not keep writing to player state. Root sets `destroyed` in
// onDestroy and re-checks it after every await; resolveVTTTranscript's
// continuation (Root.svelte) drops the result when destroyed. render() from
// vitest-browser-svelte unmounts the component, exercising that teardown.
//
// Calibrated: with the `destroyed` check removed from resolveVTTTranscript's
// post-await guard, this test fails at the final assertions — the late VTT
// response writes annotations and flips transcriptStatus to "ready" after
// unmount. So it detects the fault, not merely the current correct behavior.
describe("Root transcript lifecycle after unmount", () => {
  const VTT_URL = "https://example.com/captions-fr.vtt";

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    manifestCache.clear();
    vi.restoreAllMocks();
  });

  test("a VTT resolution that completes after unmount does not write transcript state", async () => {
    const manifestUrl = "https://example.com/manifest-unmount-lifecycle.json";
    // The VTT fetch hangs until the test resolves it by hand, so we can unmount
    // while the resolution is still in flight.
    const vtt = deferred<FetchRoute>();
    mockFetchRoutes({
      [manifestUrl]: { json: MANIFEST_WITH_VTT_CAPTIONS },
      [VTT_URL]: { promise: vtt.promise },
    });
    vttRegistry.clear();

    let ctx: PlayerContext | null = null;
    const { unmount } = render(TestRootContextCapture, {
      props: {
        manifestUrl,
        // "auto" opts into VTT transcript resolution (the async work we want
        // to catch mid-flight); without it Root never fetches the VTT.
        annotations: "auto",
        onResult: (c: PlayerContext) => {
          ctx = c;
        },
      },
    });

    // Canvas mounted; the VTT request is outstanding (issued, unresolved).
    await vi.waitFor(() => {
      expect(ctx).not.toBeNull();
      expect(ctx!.transcriptStatus).toBe("loading");
      expect(vttRegistry.has(VTT_URL)).toBe(true);
    });

    // Unmount before the VTT resolves → Root.onDestroy sets destroyed = true.
    unmount();

    // Resolve the VTT late, then await its OWN loadVTTTranscript promise (the
    // exact operation Root awaits) so fetch→text→parse and Root's post-await
    // destroyed re-check have all run before the assertions below. A stale
    // write would provably have landed by now — not a wall-clock guess.
    vtt.resolve({ text: VTT_FIXTURE_OK });
    await vttRegistry.get(VTT_URL);
    await Promise.resolve(); // let Root's post-await continuation run
    flushSync();

    // The late resolution was dropped by the destroyed guard: no annotations
    // written, status never advanced to "ready".
    expect(ctx!.transcriptStatus).not.toBe("ready");
    expect(ctx!.annotations).toEqual([]);
  });
});
