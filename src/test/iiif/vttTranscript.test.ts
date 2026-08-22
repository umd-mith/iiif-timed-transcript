import { describe, it, expect } from "vitest";
import { selectTranscriptTrack } from "../../lib/iiif/vttTranscript";
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
