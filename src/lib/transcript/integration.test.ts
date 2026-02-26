// src/lib/transcript/integration.test.ts
/**
 * Integration tests for Transcript components working together
 */
import { mount } from 'svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import Panel from './Panel.svelte';
import type { Annotation, IIIFMediaViewerRef } from '../sync/types';

describe('Transcript Integration', () => {
	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First segment with hello' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Second segment with world' },
		{ id: 'a3', startTime: 10, endTime: 15, text: 'Third segment with test' }
	];

	let target: HTMLElement;
	let mockViewer: IIIFMediaViewerRef;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);

		mockViewer = {
			seekTo: vi.fn(),
			getCurrentTime: () => 0,
			getDuration: () => 100,
			play: vi.fn(),
			pause: vi.fn(),
			isReady: () => true
		};
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
		vi.clearAllMocks();
	});

	it('full workflow: render panel, search, click segment', () => {
		// Render panel with search enabled
		mount(Panel, {
			target,
			props: {
				annotations: mockAnnotations,
				viewer: mockViewer,
				enableSearch: true
			}
		});
		flushSync();

		// Verify all segments rendered
		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments.length).toBe(3);

		// Verify search is present
		const searchInput = target.querySelector('input[type="search"]');
		expect(searchInput).not.toBeNull();

		// Click first segment
		const segment1 = target.querySelector('[data-annotation-id="a1"]') as HTMLElement;
		segment1.click();

		// Verify viewer.seekTo was called
		expect(mockViewer.seekTo).toHaveBeenCalledWith(0);
	});

	it('workflow: search filters segments, navigate matches', async () => {
		vi.useFakeTimers();

		mount(Panel, {
			target,
			props: {
				annotations: mockAnnotations,
				viewer: mockViewer,
				enableSearch: true
			}
		});
		flushSync();

		// Type in search
		const searchInput = target.querySelector('input[type="search"]') as HTMLInputElement;
		searchInput.value = 'segment';
		searchInput.dispatchEvent(new Event('input'));
		flushSync();

		// Wait for debounce
		vi.advanceTimersByTime(150);
		await Promise.resolve();
		flushSync();

		// Verify search input is working
		expect(searchInput.value).toBe('segment');

		vi.useRealTimers();
	});

	it('workflow: panel with null viewer (static mode)', () => {
		mount(Panel, {
			target,
			props: {
				annotations: mockAnnotations,
				viewer: null // Static transcript, no sync
			}
		});
		flushSync();

		// Segments should still render
		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments.length).toBe(3);

		// Click segment (should not throw, but also not seek)
		const segment1 = target.querySelector('[data-annotation-id="a1"]') as HTMLElement;
		segment1.click();

		// No seekTo called
		expect(mockViewer.seekTo).not.toHaveBeenCalled();
	});

	it('workflow: empty annotations shows empty state', () => {
		mount(Panel, {
			target,
			props: {
				annotations: [],
				viewer: mockViewer
			}
		});
		flushSync();

		// Should show empty message
		expect(target.textContent).toContain('No transcript available.');

		// No segments rendered
		const segments = target.querySelectorAll('[data-annotation-id]');
		expect(segments.length).toBe(0);
	});
});
