// src/lib/transcript/Panel.svelte.test.ts
import { mount } from 'svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import Panel from './Panel.svelte';
import type { Annotation, IIIFMediaViewerRef } from '../sync/types';

describe('Transcript.Panel - Structure & Props', () => {
	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First segment' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Second segment' }
	];

	const mockViewer: IIIFMediaViewerRef = {
		seekTo: vi.fn(),
		getCurrentTime: () => 0,
		getDuration: () => 100,
		play: vi.fn(),
		pause: vi.fn(),
		isReady: () => true
	};

	let target: HTMLElement;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	it('renders all annotations', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: mockViewer } });
		flushSync();

		expect(target.textContent).toContain('First segment');
		expect(target.textContent).toContain('Second segment');
	});

	it('renders with null viewer (no sync)', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: null } });
		flushSync();

		expect(target.textContent).toContain('First segment');
	});

	it('renders empty state when no annotations', () => {
		mount(Panel, { target, props: { annotations: [], viewer: null } });
		flushSync();

		expect(target.textContent).toContain('No transcript available.');
	});

	it('applies aria-label to container', () => {
		mount(Panel, {
			target,
			props: {
				annotations: mockAnnotations,
				viewer: null,
				ariaLabel: 'Custom transcript label'
			}
		});
		flushSync();

		const container = target.querySelector('[role="region"]');
		expect(container?.getAttribute('aria-label')).toBe('Custom transcript label');
	});

	it('uses default aria-label when not provided', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: null } });
		flushSync();

		const container = target.querySelector('[role="region"]');
		expect(container?.getAttribute('aria-label')).toBe('Media transcript');
	});

	it('includes data-annotation-id on segments', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: null } });
		flushSync();

		const segment1 = target.querySelector('[data-annotation-id="a1"]');
		const segment2 = target.querySelector('[data-annotation-id="a2"]');
		expect(segment1).not.toBeNull();
		expect(segment2).not.toBeNull();
	});
});

describe('Transcript.Panel - SyncController Integration', () => {
	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First segment' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Second segment' }
	];

	const mockViewer: IIIFMediaViewerRef = {
		seekTo: vi.fn(),
		getCurrentTime: () => 0,
		getDuration: () => 100,
		play: vi.fn(),
		pause: vi.fn(),
		isReady: () => true
	};

	let target: HTMLElement;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	it('calls viewer.seekTo when segment clicked', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: mockViewer } });
		flushSync();

		const segment1 = target.querySelector('[data-annotation-id="a1"]') as HTMLElement;
		segment1.click();

		expect(mockViewer.seekTo).toHaveBeenCalledWith(0);
	});

	it('does not call seekTo when viewer is null', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: null } });
		flushSync();

		const segment1 = target.querySelector('[data-annotation-id="a1"]') as HTMLElement;
		segment1.click();

		// No error thrown, just no-op
		expect(mockViewer.seekTo).not.toHaveBeenCalled();
	});

	it('respects sync configuration props', () => {
		// This test verifies props are accepted; actual sync behavior tested via SyncController unit tests
		mount(Panel, {
			target,
			props: {
				annotations: mockAnnotations,
				viewer: mockViewer,
				syncDebounceMs: 200,
				syncSettleMs: 150,
				syncPriorityLockDuration: 2000
			}
		});
		flushSync();

		expect(target.querySelector('.transcript-panel')).not.toBeNull();
	});
});

describe('Transcript.Panel - Search Integration', () => {
	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'Hello world' },
		{ id: 'a2', startTime: 5, endTime: 10, text: 'Goodbye world' },
		{ id: 'a3', startTime: 10, endTime: 15, text: 'Testing search' }
	];

	let target: HTMLElement;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	it('does not show search by default', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: null } });
		flushSync();

		const searchInput = target.querySelector('input[type="search"]');
		expect(searchInput).toBeNull();
	});

	it('shows search when enableSearch is true', () => {
		mount(Panel, {
			target,
			props: { annotations: mockAnnotations, viewer: null, enableSearch: true }
		});
		flushSync();

		const searchInput = target.querySelector('input[type="search"]');
		expect(searchInput).not.toBeNull();
	});

	it('uses custom search placeholder', () => {
		mount(Panel, {
			target,
			props: {
				annotations: mockAnnotations,
				viewer: null,
				enableSearch: true,
				searchPlaceholder: 'Find in transcript...'
			}
		});
		flushSync();

		const searchInput = target.querySelector('input[type="search"]') as HTMLInputElement;
		expect(searchInput?.placeholder).toBe('Find in transcript...');
	});
});

describe('Transcript.Panel - Fullscreen Mode', () => {
	const mockAnnotations: Annotation[] = [
		{ id: 'a1', startTime: 0, endTime: 5, text: 'First segment' }
	];

	let target: HTMLElement;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	it('does not show fullscreen toggle by default', () => {
		mount(Panel, { target, props: { annotations: mockAnnotations, viewer: null } });
		flushSync();

		const fullscreenButton = target.querySelector('[aria-label*="fullscreen" i]');
		expect(fullscreenButton).toBeNull();
	});

	it('shows fullscreen toggle when enableFullscreen is true', () => {
		mount(Panel, {
			target,
			props: { annotations: mockAnnotations, viewer: null, enableFullscreen: true }
		});
		flushSync();

		// Should have toolbar with fullscreen placeholder
		const toolbar = target.querySelector('.toolbar');
		expect(toolbar).not.toBeNull();
	});
});
