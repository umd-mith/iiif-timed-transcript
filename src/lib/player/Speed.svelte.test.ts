import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Speed from './Speed.svelte';
import TestContextProvider from '../../test/player/TestContextProvider.svelte';
import { createMockPlayerContext } from '../../test/player/test-utils';

describe('Speed', () => {
	let target: HTMLElement;

	afterEach(() => {
		if (target && document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('renders speed select', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Speed, { target, anchor });
				}
			}
		});
		flushSync();

		const select = target.querySelector('select');
		expect(select).not.toBeNull();
	});

	test('shows all rate options', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext();

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Speed, { target, anchor, props: { rates: [0.5, 1, 1.5, 2] } });
				}
			}
		});
		flushSync();

		const options = target.querySelectorAll('option');
		expect(options).toHaveLength(4);
	});

	test('calls setPlaybackRate when changed', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const setPlaybackRateFn = vi.fn();
		const ctx = createMockPlayerContext({
			state: { playbackRate: 1, isReady: true },
			actions: { setPlaybackRate: setPlaybackRateFn }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Speed, { target, anchor });
				}
			}
		});
		flushSync();

		const select = target.querySelector('select') as HTMLSelectElement;
		select.value = '1.5';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(setPlaybackRateFn).toHaveBeenCalledWith(1.5);
	});

	test('is disabled when media not ready', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext({ state: { isReady: false } });

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(Speed, { target, anchor });
				}
			}
		});
		flushSync();

		const select = target.querySelector('select');
		expect(select?.disabled).toBe(true);
	});
});
