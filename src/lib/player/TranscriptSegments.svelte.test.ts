import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import TranscriptSegments from './TranscriptSegments.svelte';
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

	test('renders segments container', () => {
		mount(TranscriptSegments, { target, props: { annotations: mockAnnotations } });
		flushSync();

		const container = target.querySelector('.segments-container');
		expect(container).not.toBeNull();
	});

	test('renders all segments', () => {
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
});
