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

	test('renders range input with data attribute', () => {
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

		const input = target.querySelector('input[data-audio-progress]');
		expect(input).not.toBeNull();
		expect(input?.getAttribute('type')).toBe('range');
	});

	test('reflects current time as input value', () => {
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

		const input = target.querySelector('input[data-audio-progress]') as HTMLInputElement;
		expect(input.value).toBe('30');
		expect(input.max).toBe('120');
	});

	test('calls seekTo on input event', () => {
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

		const input = target.querySelector('input[data-audio-progress]') as HTMLInputElement;

		// Simulate user dragging to 60s
		input.value = '60';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		expect(seekToFn).toHaveBeenCalledWith(60);
	});

	test('sets min and max from player state', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext({
			state: { currentTime: 0, duration: 240, isReady: true }
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

		const input = target.querySelector('input[data-audio-progress]') as HTMLInputElement;
		expect(input.min).toBe('0');
		expect(input.max).toBe('240');
	});

	test('has accessible label', () => {
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

		const input = target.querySelector('input[data-audio-progress]') as HTMLInputElement;
		expect(input.getAttribute('aria-label')).toBe('Playback progress');
	});
});
