import type { TrackDefinition } from "../player/context.js";
import type { VTTCue, VTTNode } from "media-captions";
import type {
  Annotation,
  SkippedAnnotation,
  TranscriptAnnotationResult,
} from "../sync/types.js";

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

/** `tokenizeVTTCue` from media-captions, passed in so this module stays free of a static import. */
export type VTTCueTokenizer = (cue: VTTCue) => VTTNode[];

/**
 * Plain text of a cue: the WebVTT cue-text parser's text leaves, concatenated.
 * Tags (`<v>`, `<b>`, `<c.x>`, timestamps) are dropped and entities decoded;
 * `cue.text` is the raw payload and would render tags literally through
 * Segment's escaped `{annotation.text}`.
 */
export function vttCueToPlainText(
  cue: VTTCue,
  tokenize: VTTCueTokenizer,
): string {
  const parts: string[] = [];
  const walk = (nodes: VTTNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        parts.push(node.data);
      } else {
        walk(node.children);
      }
    }
  };
  walk(tokenize(cue));
  return parts.join("").trim();
}

/**
 * Builds transcript annotations from parsed VTT cues. Same result shape and
 * id-dedup rule as buildTranscriptAnnotations (helpers.ts): VTT cue ids are
 * optional and routinely absent or repeated, and `cue-${startTime}` collides
 * whenever two cues share a start time; TranscriptSegments keys on id.
 */
export function buildAnnotationsFromVTTCues(
  cues: readonly VTTCue[],
  tokenize: VTTCueTokenizer,
): TranscriptAnnotationResult {
  const annotations: Annotation[] = [];
  const skipped: SkippedAnnotation[] = [];
  const seenIds = new Set<string>();

  for (const cue of cues) {
    // A cue whose payload tokenizes to nothing (whitespace-only, or tags with
    // no text leaves) would render as an empty, unclickable transcript
    // segment. Skip it — and do so before the id is reserved, so a blank cue
    // cannot push a later cue onto a suffixed id. `no-text-body` is the same
    // reason buildTranscriptAnnotations uses for an annotation with no text.
    const text = vttCueToPlainText(cue, tokenize);
    if (!text) {
      skipped.push({
        annotationId: cue.id || `cue-${cue.startTime}`,
        reason: "no-text-body",
      });
      continue;
    }

    let id = cue.id || `cue-${cue.startTime}`;
    if (seenIds.has(id)) {
      // Keep suffixing until we land on an id that is actually unique —
      // a single-shot suffix can itself collide with an id seen earlier
      // (e.g. cue ids "a", "a-2", "a": the third cue's naive suffix "a-2"
      // duplicates the second cue's real id).
      let n = 1;
      let candidate = `${id}-${n}`;
      while (seenIds.has(candidate)) {
        n += 1;
        candidate = `${id}-${n}`;
      }
      id = candidate;
    }
    seenIds.add(id);

    annotations.push({
      id,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text,
    });
  }

  return { annotations, skipped };
}

/**
 * Fetches a WebVTT file and builds transcript annotations from it.
 *
 * Throws (so Root can report `{ fatal: false, source: "transcript" }`) on a
 * non-OK response, a thrown parse, or a parse that produced zero cues with
 * errors. `errors: true` (not `strict`) keeps recovered cues from a partially
 * malformed file. No credentials / RequestInit by design.
 */
export async function loadVTTTranscript(
  url: string,
): Promise<TranscriptAnnotationResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch VTT transcript: ${response.status} ${response.statusText}`,
    );
  }
  const text = await response.text();

  const { parseText, tokenizeVTTCue } = await import("media-captions");
  const { cues, errors } = await parseText(text, {
    type: "vtt",
    errors: true,
  });

  if (cues.length === 0 && errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `Malformed VTT transcript: ${first ? first.message : "unknown parse error"}`,
    );
  }

  return buildAnnotationsFromVTTCues(cues, tokenizeVTTCue);
}
