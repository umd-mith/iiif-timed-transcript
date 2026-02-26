import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Progress from './Progress.svelte';
import TestContextProvider from './TestContextProvider.svelte';
import { createMockPlayerContext } from './test-utils';

describe('Progress', () => {
	let target: HTMLElement;

	afterEach(() => {
		if (target && document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('renders progress track', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Progress, { target, anchor });
				}
			}
		});
		flushSync();

		const track = target.querySelector('[data-audio-progress]');
		expect(track).not.toBeNull();
	});

	test('calculates progress percentage correctly', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext({
			state: { currentTime: 30, duration: 120, isReady: true }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Progress, { target, anchor });
				}
			}
		});
		flushSync();

		// Progress should be 30/120 = 25%
		const thumb = target.querySelector('[data-progress-thumb]') as HTMLElement;
		expect(thumb?.style.left).toBe('25%');
	});

	test('calls seekTo when track is clicked', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const seekToFn = vi.fn();
		const ctx = createMockPlayerContext({
			state: { currentTime: 0, duration: 120, isReady: true },
			actions: { seekTo: seekToFn }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Progress, { target, anchor });
				}
			}
		});
		flushSync();

		const track = target.querySelector('[data-audio-progress]') as HTMLElement;

		// Mock getBoundingClientRect
		track.getBoundingClientRect = vi.fn(() => ({
			left: 0,
			width: 200,
			top: 0,
			right: 200,
			bottom: 0,
			height: 0,
			x: 0,
			y: 0,
			toJSON: () => ({})
		}));

		// Simulate click at 50% (100px of 200px width)
		const clickEvent = new MouseEvent('click', {
			clientX: 100,
			bubbles: true
		});
		track.dispatchEvent(clickEvent);
		flushSync();

		// Should seek to 50% of 120s = 60s
		expect(seekToFn).toHaveBeenCalledWith(60);
	});

	test('handles keyboard navigation - ArrowRight', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const seekToFn = vi.fn();
		const ctx = createMockPlayerContext({
			state: { currentTime: 30, duration: 120, isReady: true },
			actions: { seekTo: seekToFn }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Progress, { target, anchor });
				}
			}
		});
		flushSync();

		const track = target.querySelector('[data-audio-progress]') as HTMLElement;

		const keyEvent = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			bubbles: true
		});
		track.dispatchEvent(keyEvent);
		flushSync();

		// Should seek forward by 5 seconds: 30 + 5 = 35
		expect(seekToFn).toHaveBeenCalledWith(35);
	});

	test('handles keyboard navigation - ArrowLeft', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const seekToFn = vi.fn();
		const ctx = createMockPlayerContext({
			state: { currentTime: 30, duration: 120, isReady: true },
			actions: { seekTo: seekToFn }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Progress, { target, anchor });
				}
			}
		});
		flushSync();

		const track = target.querySelector('[data-audio-progress]') as HTMLElement;

		const keyEvent = new KeyboardEvent('keydown', {
			key: 'ArrowLeft',
			bubbles: true
		});
		track.dispatchEvent(keyEvent);
		flushSync();

		// Should seek backward by 5 seconds: 30 - 5 = 25
		expect(seekToFn).toHaveBeenCalledWith(25);
	});
});
