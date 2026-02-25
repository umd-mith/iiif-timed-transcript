import type { Annotation } from '../sync/types';

export interface MergedParagraph {
	/** Stable identifier for this paragraph (e.g., "para-0") */
	id: string;
	/** Original segments that compose this paragraph, in order */
	segments: Annotation[];
	/** Pre-computed segment IDs for O(1) active/highlight checks */
	segmentIds: Set<string>;
	/** Start time of the first segment (seconds) */
	startTime: number;
	/** End time of the last segment (seconds) */
	endTime: number;
	/** Joined text from all segments */
	text: string;
	/** Speaker label if all segments share the same speaker. Undefined when no speakers map is provided, when segments have no labels, or when a paragraph contains segments from multiple speakers. */
	speaker?: string;
}

export interface MergeConfig {
	/** Soft word-count target — start looking for sentence-boundary breaks (default: 200) */
	targetWordCount?: number;
	/** Hard word-count cap — break even mid-sentence (default: 300) */
	maxWordCount?: number;
	/** Gap threshold in seconds — break on pauses longer than this (default: 2.0) */
	gapThreshold?: number;
	/** Speaker labels by annotation ID — triggers break on speaker change */
	speakers?: Map<string, string>;
}

const DEFAULTS = {
	targetWordCount: 200,
	maxWordCount: 300,
	gapThreshold: 2.0
} as const;

function countWords(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

function isSentenceEnd(text: string): boolean {
	return /[.!?]["']?\s*$/.test(text.trimEnd());
}

/**
 * Merge a flat array of transcript annotations into readable paragraphs.
 *
 * Uses a cascading priority system:
 * 1. Speaker change (when labels provided)
 * 2. Time gap exceeding threshold
 * 3. Word count exceeding target at sentence boundary
 * 4. Hard word count cap
 */
export function mergeIntoParagraphs(
	annotations: Annotation[],
	config?: MergeConfig
): MergedParagraph[] {
	if (annotations.length === 0) return [];

	const opts = resolveConfig(config);
	const paragraphs: MergedParagraph[] = [];
	let current: Annotation[] = [];
	let wordCount = 0;

	function flush() {
		if (current.length > 0) {
			paragraphs.push(buildParagraph(paragraphs.length, current, opts.speakers));
			current = [];
			wordCount = 0;
		}
	}

	for (let i = 0; i < annotations.length; i++) {
		const segment = annotations[i];
		if (!segment) continue;

		const nextSegment = annotations[i + 1];

		current.push(segment);
		wordCount += countWords(segment.text);

		if (shouldBreak(segment, nextSegment, wordCount, opts)) {
			flush();
		}
	}

	// Flush remaining segments
	flush();

	return paragraphs;
}

interface ResolvedConfig {
	target: number;
	max: number;
	gapThreshold: number;
	speakers: Map<string, string> | undefined;
}

function resolveConfig(config: MergeConfig = {}): ResolvedConfig {
	return {
		target: config.targetWordCount ?? DEFAULTS.targetWordCount,
		max: config.maxWordCount ?? DEFAULTS.maxWordCount,
		gapThreshold: config.gapThreshold ?? DEFAULTS.gapThreshold,
		speakers: config.speakers
	};
}

/** Check if a speaker change occurs between current and next segment. */
function hasSpeakerChange(
	speakers: Map<string, string>,
	currentId: string,
	nextId: string
): boolean {
	const currentSpeaker = speakers.get(currentId);
	const nextSpeaker = speakers.get(nextId);
	return (
		currentSpeaker !== undefined && nextSpeaker !== undefined && currentSpeaker !== nextSpeaker
	);
}

/** Check if the time gap between two segments exceeds the threshold. */
function hasTimeGap(current: Annotation, next: Annotation, threshold: number): boolean {
	return next.startTime - current.endTime > threshold;
}

/** Determine whether the current segment should end the current paragraph. */
function shouldBreak(
	segment: Annotation,
	nextSegment: Annotation | undefined,
	wordCount: number,
	opts: ResolvedConfig
): boolean {
	if (nextSegment) {
		// Priority 1: Speaker change — always break on speaker change
		if (opts.speakers && hasSpeakerChange(opts.speakers, segment.id, nextSegment.id)) {
			return true;
		}
		// Priority 2: Time gap — always break on significant pauses
		if (hasTimeGap(segment, nextSegment, opts.gapThreshold)) {
			return true;
		}
	}

	// Priority 3: Word count at sentence boundary
	// Priority 4: Hard word count cap
	return (wordCount >= opts.target && isSentenceEnd(segment.text)) || wordCount >= opts.max;
}

function buildParagraph(
	index: number,
	segments: Annotation[],
	speakers?: Map<string, string>
): MergedParagraph {
	const speaker = resolveSpeaker(segments, speakers);
	const first = segments[0]!;
	const last = segments.at(-1)!;

	const paragraph: MergedParagraph = {
		id: `para-${index}`,
		segments,
		segmentIds: new Set(segments.map((s) => s.id)),
		startTime: first.startTime,
		endTime: last.endTime,
		text: segments.map((s) => s.text.trim()).join(' ')
	};
	if (speaker !== undefined) {
		paragraph.speaker = speaker;
	}
	return paragraph;
}

function resolveSpeaker(
	segments: Annotation[],
	speakers?: Map<string, string>
): string | undefined {
	if (!speakers || speakers.size === 0) return undefined;

	const labels = segments.map((s) => speakers.get(s.id)).filter(Boolean);
	if (labels.length === 0) return undefined;

	// All segments share the same speaker?
	const unique = new Set(labels);
	return unique.size === 1 ? labels[0] : undefined;
}
