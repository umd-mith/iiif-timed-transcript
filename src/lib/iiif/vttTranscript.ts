import type { TrackDefinition } from "../player/context.js";

// ============================================================================
// VTT → transcript annotations (annotations="auto" tier 2)
// Modeled on buildTranscriptAnnotations in ./helpers.ts — same result shape,
// same id-dedup rule. media-captions is imported dynamically, only on the
// tier-2 path (see loadVTTTranscript).
// ============================================================================

function primarySubtag(lang: string): string {
  return (lang.split("-")[0] ?? lang).toLowerCase();
}

/**
 * Picks the VTT track that feeds the transcript panel: the first track whose
 * `srclang` primary subtag matches `preferredLanguage` (e.g. the viewer's
 * `navigator.language`), else the first track, else `undefined`.
 */
export function selectTranscriptTrack(
  tracks: readonly TrackDefinition[],
  preferredLanguage?: string,
): TrackDefinition | undefined {
  if (tracks.length === 0) return undefined;
  if (preferredLanguage) {
    const wanted = primarySubtag(preferredLanguage);
    const match = tracks.find((t) => primarySubtag(t.srclang) === wanted);
    if (match) return match;
  }
  return tracks[0];
}
