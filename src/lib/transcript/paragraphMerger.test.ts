import { describe, test, expect } from 'vitest';
import { mergeIntoParagraphs } from './paragraphMerger';
import type { Annotation } from '../sync/types';

// ── Helpers ────────────────────────────────────────────────────────

/** Create a contiguous sequence of annotations (no gaps). */
function makeSegments(texts: string[], startAt = 0, durationEach = 5): Annotation[] {
	return texts.map((text, i) => ({
		id: `seg-${i + 1}`,
		startTime: startAt + i * durationEach,
		endTime: startAt + (i + 1) * durationEach,
		text
	}));
}

// ── Empty / trivial inputs ─────────────────────────────────────────

describe('mergeIntoParagraphs', () => {
	describe('empty and trivial inputs', () => {
		test('returns empty array for empty annotations', () => {
			const result = mergeIntoParagraphs([]);
			expect(result).toEqual([]);
		});

		test('returns one paragraph for a single segment', () => {
			const segments = makeSegments(['Welcome to the Lakeland Digital Archive.']);
			const result = mergeIntoParagraphs(segments);

			expect(result).toHaveLength(1);
			expect(result[0]!.text).toBe('Welcome to the Lakeland Digital Archive.');
			expect(result[0]!.segments).toHaveLength(1);
			expect(result[0]!.startTime).toBe(0);
			expect(result[0]!.endTime).toBe(5);
		});
	});

	describe('basic merging — segments under word threshold', () => {
		test('keeps short contiguous segments in one paragraph', () => {
			const segments = makeSegments([
				'Welcome to the archive.',
				'This is a sample transcript.',
				'The community has a rich history.'
			]);
			const result = mergeIntoParagraphs(segments);

			expect(result).toHaveLength(1);
			expect(result[0]!.segments).toHaveLength(3);
			expect(result[0]!.text).toBe(
				'Welcome to the archive. This is a sample transcript. The community has a rich history.'
			);
			expect(result[0]!.startTime).toBe(0);
			expect(result[0]!.endTime).toBe(15);
		});

		test('paragraph id uses sequential index', () => {
			const segments = makeSegments(['Hello.', 'World.']);
			const result = mergeIntoParagraphs(segments);

			expect(result[0]!.id).toBe('para-0');
		});

		test('segmentIds set contains all child segment ids', () => {
			const segments = makeSegments(['One.', 'Two.', 'Three.']);
			const result = mergeIntoParagraphs(segments);

			expect(result[0]!.segmentIds).toBeInstanceOf(Set);
			expect(result[0]!.segmentIds.has('seg-1')).toBe(true);
			expect(result[0]!.segmentIds.has('seg-2')).toBe(true);
			expect(result[0]!.segmentIds.has('seg-3')).toBe(true);
		});
	});

	describe('word-count threshold triggers paragraph break', () => {
		test('breaks into multiple paragraphs when word count exceeds target', () => {
			const segments = makeSegments(
				Array.from(
					{ length: 25 },
					(_, i) => `This is segment number ${i + 1} with some extra words to fill.`
				)
			);
			const result = mergeIntoParagraphs(segments);

			expect(result.length).toBeGreaterThan(1);
		});

		test('each paragraph respects the target word count approximately', () => {
			const segments = makeSegments(
				Array.from(
					{ length: 40 },
					(_, i) => `This is test segment ${i + 1} with about ten words in it.`
				)
			);
			const result = mergeIntoParagraphs(segments);

			for (const para of result) {
				const wordCount = para.text.split(/\s+/).length;
				expect(wordCount).toBeLessThanOrEqual(350);
			}
		});

		test('custom targetWordCount is respected', () => {
			const segments = makeSegments(
				Array.from({ length: 20 }, (_, i) => `Segment ${i + 1} has about six words.`)
			);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 50 });

			expect(result.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('sentence boundary preference', () => {
		test('prefers breaking at sentence-ending punctuation over exact word count', () => {
			const segments = makeSegments([
				'One two three four five six seven eight nine ten.',
				'Eleven twelve thirteen fourteen fifteen sixteen'
			]);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 10, maxWordCount: 20 });

			expect(result).toHaveLength(2);
			expect(result[0]!.text).toContain('ten.');
			expect(result[1]!.text).toContain('Eleven');
		});

		test('recognizes question marks as sentence endings', () => {
			const segments = makeSegments([
				'Can you tell us about your childhood in Lakeland?',
				'I was born in nineteen forty two right here.'
			]);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 8, maxWordCount: 20 });

			expect(result).toHaveLength(2);
			expect(result[0]!.text).toContain('Lakeland?');
		});

		test('recognizes exclamation marks as sentence endings', () => {
			const segments = makeSegments([
				'The food was always amazing!',
				'Mrs Johnson made the best potato salad.'
			]);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 4, maxWordCount: 20 });

			expect(result).toHaveLength(2);
			expect(result[0]!.text).toContain('amazing!');
		});

		test('handles trailing quotes after punctuation', () => {
			const segments = makeSegments(['She said "welcome home."', 'Then everyone cheered.']);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 4, maxWordCount: 20 });

			expect(result).toHaveLength(2);
			expect(result[0]!.text).toContain('home."');
		});
	});

	describe('hard max word count cap', () => {
		test('breaks at max even without sentence boundary', () => {
			const segments = makeSegments(
				Array.from(
					{ length: 40 },
					(_, i) =>
						`word${i + 1} word${i + 2} word${i + 3} word${i + 4} word${i + 5} word${i + 6} word${i + 7} word${i + 8}`
				)
			);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 50, maxWordCount: 100 });

			expect(result.length).toBeGreaterThan(1);
			for (const para of result) {
				const wc = para.text.split(/\s+/).length;
				expect(wc).toBeLessThanOrEqual(120);
			}
		});

		test('custom maxWordCount is respected', () => {
			const segments = makeSegments(
				Array.from({ length: 20 }, () => 'One two three four five six seven eight nine ten')
			);
			const result = mergeIntoParagraphs(segments, {
				targetWordCount: 30,
				maxWordCount: 50
			});

			expect(result.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('speaker change triggers paragraph break', () => {
		test('breaks on speaker change when labels provided', () => {
			const segments: Annotation[] = [
				{
					id: 'seg-1',
					startTime: 0,
					endTime: 8,
					text: 'Can you tell us about your childhood?'
				},
				{
					id: 'seg-2',
					startTime: 8,
					endTime: 25,
					text: 'I was born in 1942, right here. My parents had a small house.'
				},
				{ id: 'seg-3', startTime: 25, endTime: 30, text: 'What are your earliest memories?' }
			];
			const speakers = new Map([
				['seg-1', 'Interviewer'],
				['seg-2', 'Narrator'],
				['seg-3', 'Interviewer']
			]);
			const result = mergeIntoParagraphs(segments, { speakers });

			expect(result).toHaveLength(3);
			expect(result[0]!.speaker).toBe('Interviewer');
			expect(result[1]!.speaker).toBe('Narrator');
			expect(result[2]!.speaker).toBe('Interviewer');
		});

		test('sets speaker field when all segments share same speaker', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 0, endTime: 5, text: 'First point.' },
				{ id: 'seg-2', startTime: 5, endTime: 10, text: 'Second point.' }
			];
			const speakers = new Map([
				['seg-1', 'Narrator'],
				['seg-2', 'Narrator']
			]);
			const result = mergeIntoParagraphs(segments, { speakers });

			expect(result).toHaveLength(1);
			expect(result[0]!.speaker).toBe('Narrator');
		});

		test('speaker is undefined when no speakers map provided', () => {
			const segments = makeSegments(['Hello.', 'World.']);
			const result = mergeIntoParagraphs(segments);

			expect(result[0]!.speaker).toBeUndefined();
		});
	});

	describe('time gap triggers paragraph break', () => {
		test('breaks when gap between segments exceeds threshold', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 0, endTime: 10, text: 'First thought about the community.' },
				{ id: 'seg-2', startTime: 15, endTime: 25, text: 'Different topic about the school.' }
			];
			const result = mergeIntoParagraphs(segments, { gapThreshold: 2.0 });

			expect(result).toHaveLength(2);
			expect(result[0]!.text).toContain('First thought');
			expect(result[1]!.text).toContain('Different topic');
		});

		test('does not break when gap is below threshold', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 0, endTime: 10, text: 'First part of the sentence.' },
				{ id: 'seg-2', startTime: 11, endTime: 20, text: 'Continuation of the same thought.' }
			];
			const result = mergeIntoParagraphs(segments, { gapThreshold: 2.0 });

			expect(result).toHaveLength(1);
		});
	});

	describe('MergedParagraph structure', () => {
		test('paragraph ids are sequential across multiple paragraphs', () => {
			const segments = makeSegments(
				Array.from({ length: 30 }, (_, i) => `Segment ${i + 1} words to fill.`)
			);
			const result = mergeIntoParagraphs(segments, { targetWordCount: 30, maxWordCount: 50 });

			result.forEach((para, i) => {
				expect(para.id).toBe(`para-${i}`);
			});
		});

		test('startTime and endTime span the contained segments', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 10.5, endTime: 15.3, text: 'First segment.' },
				{ id: 'seg-2', startTime: 15.3, endTime: 22.7, text: 'Second segment.' }
			];
			const result = mergeIntoParagraphs(segments);

			expect(result[0]!.startTime).toBe(10.5);
			expect(result[0]!.endTime).toBe(22.7);
		});

		test('text joins segment texts with spaces', () => {
			const segments = makeSegments(['Hello world.', 'Goodbye moon.']);
			const result = mergeIntoParagraphs(segments);

			expect(result[0]!.text).toBe('Hello world. Goodbye moon.');
		});

		test('segments array preserves original annotation references', () => {
			const segments = makeSegments(['Test.']);
			const result = mergeIntoParagraphs(segments);

			expect(result[0]!.segments[0]).toBe(segments[0]);
		});
	});

	describe('edge cases', () => {
		test('handles very long transcript (400+ segments)', () => {
			const segments = makeSegments(
				Array.from(
					{ length: 400 },
					(_, i) => `This is segment number ${i + 1} from a long oral history recording.`
				)
			);
			const result = mergeIntoParagraphs(segments);

			expect(result.length).toBeGreaterThan(10);
			const allSegmentIds = result.flatMap((p) => p.segments.map((s) => s.id));
			expect(allSegmentIds).toHaveLength(400);
			expect(new Set(allSegmentIds).size).toBe(400);
		});

		test('handles segments with empty text', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 0, endTime: 5, text: 'Real content here.' },
				{ id: 'seg-2', startTime: 5, endTime: 6, text: '' },
				{ id: 'seg-3', startTime: 6, endTime: 15, text: 'More real content here.' }
			];
			const result = mergeIntoParagraphs(segments);

			expect(result.length).toBeGreaterThanOrEqual(1);
			const allSegmentIds = result.flatMap((p) => p.segments.map((s) => s.id));
			expect(allSegmentIds).toContain('seg-2');
		});

		test('cascading priority: speaker change wins over word count', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 0, endTime: 5, text: 'Short question?' },
				{ id: 'seg-2', startTime: 5, endTime: 15, text: 'Short answer.' }
			];
			const speakers = new Map([
				['seg-1', 'Interviewer'],
				['seg-2', 'Subject']
			]);
			const result = mergeIntoParagraphs(segments, { speakers });

			expect(result).toHaveLength(2);
		});

		test('throws when maxWordCount < targetWordCount', () => {
			const segments = makeSegments(['Hello.']);
			expect(() =>
				mergeIntoParagraphs(segments, { targetWordCount: 500, maxWordCount: 100 })
			).toThrow('maxWordCount (100) must be >= targetWordCount (500)');
		});

		test('cascading priority: time gap wins over word count', () => {
			const segments: Annotation[] = [
				{ id: 'seg-1', startTime: 0, endTime: 5, text: 'Before the pause.' },
				{ id: 'seg-2', startTime: 15, endTime: 20, text: 'After the pause.' }
			];
			const result = mergeIntoParagraphs(segments, {
				gapThreshold: 2.0,
				targetWordCount: 1000,
				maxWordCount: 2000
			});

			expect(result).toHaveLength(2);
		});
	});
});
