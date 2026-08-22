import { describe, it, expect, vi, afterEach } from "vitest";
import { VTTCue, tokenizeVTTCue } from "media-captions";
import {
  selectTranscriptTrack,
  vttCueToPlainText,
  buildAnnotationsFromVTTCues,
  loadVTTTranscript,
} from "../../lib/iiif/vttTranscript";
import type { TrackDefinition } from "../../lib/player/context";

const en: TrackDefinition = {
  src: "https://example.org/en.vtt",
  kind: "captions",
  srclang: "en",
  label: "English",
};
const fr: TrackDefinition = {
  src: "https://example.org/fr.vtt",
  kind: "captions",
  srclang: "fr-CA",
  label: "Français",
};

describe("selectTranscriptTrack", () => {
  it("returns undefined for no tracks", () => {
    expect(selectTranscriptTrack([], "en-US")).toBeUndefined();
  });

  it("prefers the track whose primary language subtag matches", () => {
    expect(selectTranscriptTrack([en, fr], "fr")).toBe(fr);
    expect(selectTranscriptTrack([en, fr], "FR-fr")).toBe(fr);
  });

  it("falls back to the first track when nothing matches", () => {
    expect(selectTranscriptTrack([en, fr], "de-DE")).toBe(en);
  });

  it("falls back to the first track when no preference is given", () => {
    expect(selectTranscriptTrack([fr, en])).toBe(fr);
  });
});

function cue(start: number, end: number, text: string, id = ""): VTTCue {
  const c = new VTTCue(start, end, text);
  c.id = id;
  return c;
}

describe("vttCueToPlainText", () => {
  it("strips voice, class, bold/italic and timestamp tags", () => {
    const c = cue(
      0,
      1,
      "<v Alice><b>Hello</b> <i>there</i> <c.yellow>friend</c><00:00:00.500> again",
    );
    expect(vttCueToPlainText(c, tokenizeVTTCue)).toBe(
      "Hello there friend again",
    );
  });

  it("decodes HTML entities", () => {
    const c = cue(0, 1, "Fish &amp; chips &lt;cheap&gt;");
    expect(vttCueToPlainText(c, tokenizeVTTCue)).toBe("Fish & chips <cheap>");
  });
});

describe("buildAnnotationsFromVTTCues", () => {
  it("maps cues to annotations with plain text", () => {
    const result = buildAnnotationsFromVTTCues(
      [cue(0, 1.5, "<v Bob>One", "c1"), cue(1.5, 3, "Two", "c2")],
      tokenizeVTTCue,
    );
    expect(result.skipped).toEqual([]);
    expect(result.annotations).toEqual([
      { id: "c1", startTime: 0, endTime: 1.5, text: "One" },
      { id: "c2", startTime: 1.5, endTime: 3, text: "Two" },
    ]);
  });

  it("produces unique ids for cues without ids, repeated ids, and shared start times", () => {
    const result = buildAnnotationsFromVTTCues(
      [
        cue(0, 1, "a"), // no id → cue-0
        cue(0, 2, "b"), // no id, same start → collides with cue-0
        cue(2, 3, "c", "x"),
        cue(3, 4, "d", "x"), // repeated id
        cue(4, 5, "e", "x-3"), // collides with a generated suffix
      ],
      tokenizeVTTCue,
    );
    const ids = result.annotations.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("cue-0");
    expect(ids[2]).toBe("x");
  });

  it("keeps suffixing when a single-shot suffix would itself collide", () => {
    // "a", "a-2", "a": cue 2 -> "a-2" (added to seenIds); cue 3 collides on
    // "a" and a naive `${id}-${annotations.length}` suffix also lands on
    // "a-2", which is already taken. It must keep trying until unique.
    const result = buildAnnotationsFromVTTCues(
      [cue(0, 1, "one", "a"), cue(1, 2, "two", "a-2"), cue(2, 3, "three", "a")],
      tokenizeVTTCue,
    );
    const ids = result.annotations.map((a) => a.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(["a", "a-2", "a-1"]);
  });

  it("skips cues whose tokenized text is empty", () => {
    const result = buildAnnotationsFromVTTCues(
      [
        cue(0, 1, "Real text", "c1"),
        cue(1, 2, "   ", "blank"),
        cue(2, 3, "<v Alice></v>", "tags-only"),
      ],
      tokenizeVTTCue,
    );
    expect(result.annotations).toEqual([
      { id: "c1", startTime: 0, endTime: 1, text: "Real text" },
    ]);
    expect(result.skipped).toEqual([
      { annotationId: "blank", reason: "no-text-body" },
      { annotationId: "tags-only", reason: "no-text-body" },
    ]);
  });
});

const VTT_OK = `WEBVTT

1
00:00:00.000 --> 00:00:01.000
<v Alice>Hello &amp; welcome

2
00:00:01.000 --> 00:00:02.000
Second line
`;

const VTT_PARTIAL = `WEBVTT

00:00:00.000 --> 00:00:01.000
Good cue

not-a-timestamp --> 00:00:02.000
Bad cue
`;

const VTT_MALFORMED = `not a webvtt file at all`;

function mockFetchText(status: number, body: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    text: async () => body,
  } as Response) as unknown as typeof fetch;
}

describe("loadVTTTranscript", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("fetches, parses and builds annotations", async () => {
    mockFetchText(200, VTT_OK);
    const result = await loadVTTTranscript("https://example.org/ok.vtt");
    expect(result.annotations).toEqual([
      { id: "1", startTime: 0, endTime: 1, text: "Hello & welcome" },
      { id: "2", startTime: 1, endTime: 2, text: "Second line" },
    ]);
  });

  it("throws on a non-OK response", async () => {
    mockFetchText(404, "");
    await expect(
      loadVTTTranscript("https://example.org/missing.vtt"),
    ).rejects.toThrow(/404/);
  });

  it("throws when nothing parses and errors were reported", async () => {
    mockFetchText(200, VTT_MALFORMED);
    await expect(
      loadVTTTranscript("https://example.org/bad.vtt"),
    ).rejects.toThrow(/Malformed VTT/);
  });

  it("returns recovered cues for a partially malformed file", async () => {
    mockFetchText(200, VTT_PARTIAL);
    const result = await loadVTTTranscript("https://example.org/partial.vtt");
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]!.text).toBe("Good cue");
  });
});
