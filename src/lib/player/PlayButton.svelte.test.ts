import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import PlayButton from './PlayButton.svelte';
import TestContextProvider from '../../test/player/TestContextProvider.svelte';
import { createMockPlayerContext } from '../../test/player/test-utils';

describe('PlayButton', () => {
	let target: HTMLElement;

	afterEach(() => {
		if (target && document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('shows "Play" when paused', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext({ state: { isPlaying: false } });

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(PlayButton, { target, anchor });
				}
			}
		});
		flushSync();

		const button = target.querySelector('button');
		expect(button?.textContent).toContain('Play');
	});

	test('shows "Pause" when playing', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const ctx = createMockPlayerContext({
			state: { isPlaying: true, isReady: true }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(PlayButton, { target, anchor });
				}
			}
		});
		flushSync();

		const button = target.querySelector('button');
		expect(button?.textContent).toContain('Pause');
	});

	test('calls play action when clicked while paused', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const playFn = vi.fn();
		const ctx = createMockPlayerContext({
			state: { isPlaying: false, isReady: true },
			actions: { play: playFn }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(PlayButton, { target, anchor });
				}
			}
		});
		flushSync();

		const button = target.querySelector('button')!;
		button.click();
		flushSync();

		expect(playFn).toHaveBeenCalled();
	});

	test('calls pause action when clicked while playing', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const pauseFn = vi.fn();
		const ctx = createMockPlayerContext({
			state: { isPlaying: true, isReady: true },
			actions: { pause: pauseFn }
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: ctx,
				children: (anchor: any) => {
					mount(PlayButton, { target, anchor });
				}
			}
		});
		flushSync();

		const button = target.querySelector('button')!;
		button.click();
		flushSync();

		expect(pauseFn).toHaveBeenCalled();
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
					mount(PlayButton, { target, anchor });
				}
			}
		});
		flushSync();

		const button = target.querySelector('button');
		expect(button?.disabled).toBe(true);
	});
});
