import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import type { PlayerContext, PlayerState } from './context';
import type { Chapter } from '@umd-mith/iiif-media-parsers';
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
			chapters: [],
			activeChapterId: null,
			actions: {
				play: vi.fn(),
				pause: vi.fn(),
				seekTo: vi.fn(),
				setPlaybackRate: vi.fn(),
				retry: vi.fn(),
				seekToChapter: vi.fn()
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

describe('PlayerContext chapter types', () => {
	test('PlayerContext includes chapters and activeChapterId', () => {
		const mockState: PlayerState = {
			isPlaying: false,
			currentTime: 15,
			duration: 90,
			playbackRate: 1,
			isReady: true,
			error: null
		};

		const chapters: Chapter[] = [
			{ id: 'ch1', label: 'Intro', startTime: 0, endTime: 30 },
			{ id: 'ch2', label: 'Main', startTime: 30, endTime: 90 }
		];

		const mockContext: PlayerContext = {
			state: mockState,
			mediaElement: null,
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio',
			chapters,
			activeChapterId: 'ch1',
			actions: {
				play: async () => {},
				pause: () => {},
				seekTo: () => {},
				setPlaybackRate: () => {},
				retry: async () => {},
				seekToChapter: () => {}
			}
		};

		expect(mockContext.chapters).toHaveLength(2);
		expect(mockContext.activeChapterId).toBe('ch1');
		expect(mockContext.actions.seekToChapter).toBeDefined();
	});
});
