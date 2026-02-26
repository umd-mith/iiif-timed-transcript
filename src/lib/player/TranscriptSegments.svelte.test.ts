import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import TranscriptSegments from './TranscriptSegments.svelte';
import TestTranscriptContextProvider from './TestTranscriptContextProvider.svelte';
import { createMockTranscriptContext } from './transcript-test-utils';
import type { Annotation } from '../sync/types';

describe('TranscriptSegments', () => {
	let target: HTMLElement;

	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First segment' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Second segment' },
		{ id: 'a3', startTime: 10, endTime: 15, text: 'Third segment' }
	];

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	// Existing behavior: works with props
	test('renders segments container with props', () => {
		mount(TranscriptSegments, { target, props: { annotations: mockAnnotations } });
		flushSync();

		const container = target.querySelector('.segments-container');
		expect(container).not.toBeNull();
	});

	test('renders all segments with props', () => {
		mount(TranscriptSegments, { target, props: { annotations: mockAnnotations } });
		flushSync();

		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments).toHaveLength(3);
	});

	test('shows empty state when no annotations', () => {
		mount(TranscriptSegments, { target, props: { annotations: [] } });
		flushSync();

		const emptyMessage = target.querySelector('.empty-message');
		expect(emptyMessage).not.toBeNull();
	});

	// New: context-aware behavior
	test('reads annotations from TranscriptContext when no prop given', () => {
		const transcriptCtx = createMockTranscriptContext({
			state: { annotations: mockAnnotations }
		});

		mount(TestTranscriptContextProvider, {
			target,
			props: {
				context: transcriptCtx,
				children: () => {
					// No annotations prop — should come from context
					mount(TranscriptSegments, { target });
				}
			}
		});
		flushSync();

		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments).toHaveLength(3);
	});

	test('reads activeAnnotationId from context', () => {
		const transcriptCtx = createMockTranscriptContext({
			state: {
				annotations: mockAnnotations,
				activeAnnotationId: 'a2'
			}
		});

		mount(TestTranscriptContextProvider, {
			target,
			props: {
				context: transcriptCtx,
				children: () => {
					mount(TranscriptSegments, { target });
				}
			}
		});
		flushSync();

		const activeSegment = target.querySelector('[data-annotation-id="a2"][data-state="active"]');
		expect(activeSegment).not.toBeNull();
	});

	test('calls context handleAnnotationClick on segment click', () => {
		const handleAnnotationClick = vi.fn();
		const transcriptCtx = createMockTranscriptContext({
			state: { annotations: mockAnnotations },
			actions: { handleAnnotationClick }
		});

		mount(TestTranscriptContextProvider, {
			target,
			props: {
				context: transcriptCtx,
				children: () => {
					mount(TranscriptSegments, { target });
				}
			}
		});
		flushSync();

		const firstSegment = target.querySelector('[data-annotation-id="a1"]') as HTMLElement;
		firstSegment.click();

		expect(handleAnnotationClick).toHaveBeenCalledWith(mockAnnotations[0]);
	});

	test('reads search highlight state from context', () => {
		const transcriptCtx = createMockTranscriptContext({
			state: {
				annotations: mockAnnotations,
				highlightedIds: new Set(['a1', 'a3']),
				currentMatchId: 'a3'
			}
		});

		mount(TestTranscriptContextProvider, {
			target,
			props: {
				context: transcriptCtx,
				children: () => {
					mount(TranscriptSegments, { target });
				}
			}
		});
		flushSync();

		// a1 should be highlighted (search match but not current)
		const a1 = target.querySelector('[data-annotation-id="a1"]');
		expect(a1?.getAttribute('data-highlighted')).toBe('true');

		// a3 should be current match
		const a3 = target.querySelector('[data-annotation-id="a3"]');
		expect(a3?.getAttribute('data-current-match')).toBe('true');
	});
});
