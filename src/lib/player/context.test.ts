import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import type { PlayerContext } from './context';
import TestContextProvider from '../../test/player/TestContextProvider.svelte';
import TestContextConsumer from '../../test/player/TestContextConsumer.svelte';

describe('getPlayerContext', () => {
	let target: HTMLElement;

	afterEach(() => {
		if (target && document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('throws error when no context available', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		// Consumer without provider should throw
		expect(() => {
			mount(TestContextConsumer, { target, props: { onResult: () => {} } });
			flushSync();
		}).toThrow('Player context not found');
	});

	test('returns context when available', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext: PlayerContext = {
			state: {
				isPlaying: false,
				isBuffering: false,
				currentTime: 0,
				duration: 0,
				playbackRate: 1,
				isReady: false,
				error: null
			},
			mediaElement: null,
			mediaUrl: 'https://example.com/test.mp3',
			mediaType: 'audio',
			actions: {
				play: vi.fn(),
				pause: vi.fn(),
				seekTo: vi.fn(),
				setPlaybackRate: vi.fn(),
				retry: vi.fn()
			}
		};

		let capturedResult: PlayerContext | null = null;

		// Mount provider with consumer as child
		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: () => {
					mount(TestContextConsumer, {
						target,
						props: {
							onResult: (ctx: PlayerContext) => {
								capturedResult = ctx;
							}
						}
					});
				}
			}
		});
		flushSync();

		expect(capturedResult).toBe(mockContext);
		expect(target.querySelector('[data-testid="consumer"]')).toBeTruthy();
	});
});
