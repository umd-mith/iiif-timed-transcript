import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Transcript from './Transcript.svelte';
import TestContextProvider from './TestContextProvider.svelte';
import { createMockPlayerContext } from './test-utils';
import type { Annotation } from '../sync/types';

describe('Transcript', () => {
	let target: HTMLElement;

	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First annotation' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Second annotation' },
		{ id: 'a3', startTime: 10, endTime: 15, text: 'Third annotation' }
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

	test('renders transcript container', () => {
		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Transcript, { target, anchor, props: { annotations: mockAnnotations } });
				}
			}
		});
		flushSync();

		const container = target.querySelector('.transcript-panel');
		expect(container).not.toBeNull();
	});

	test('renders segments from annotations', () => {
		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Transcript, { target, anchor, props: { annotations: mockAnnotations } });
				}
			}
		});
		flushSync();

		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments).toHaveLength(3);
	});

	test('shows empty state when no annotations', () => {
		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Transcript, { target, anchor, props: { annotations: [] } });
				}
			}
		});
		flushSync();

		const emptyMessage = target.querySelector('.empty-message');
		expect(emptyMessage).not.toBeNull();
		expect(emptyMessage?.textContent).toContain('No transcript available');
	});
});
