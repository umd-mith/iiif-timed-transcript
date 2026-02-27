import { describe, test, expect, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Viewer from './Viewer.svelte';
import TestContextProvider from '../../test/player/TestContextProvider.svelte';
import { createMockPlayerContext } from '../../test/player/test-utils';

describe('Viewer', () => {
	let target: HTMLElement;

	afterEach(() => {
		if (target && document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	test('renders audio element when mediaType is audio', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio');
		expect(audioElement).not.toBeNull();
		expect(audioElement?.src).toBe('https://example.com/audio.mp3');
	});

	test('renders video element when mediaType is video', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/video.mp4',
			mediaType: 'video'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor });
				}
			}
		});
		flushSync();

		const videoElement = target.querySelector('video');
		expect(videoElement).not.toBeNull();
		expect(videoElement?.src).toBe('https://example.com/video.mp4');
	});

	test('applies custom class name', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor, props: { class: 'custom-viewer' } });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio');
		expect(audioElement?.className).toContain('custom-viewer');
	});

	test('sets crossOrigin attribute', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor, props: { crossOrigin: 'use-credentials' } });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio') as HTMLAudioElement;
		expect(audioElement?.crossOrigin).toBe('use-credentials');
	});

	test('disables native controls by default', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio') as HTMLAudioElement;
		expect(audioElement?.controls).toBe(false);
	});

	test('can enable native controls', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor, props: { controls: true } });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio') as HTMLAudioElement;
		expect(audioElement?.controls).toBe(true);
	});

	test('sets preload to "auto" by default', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio') as HTMLAudioElement;
		expect(audioElement?.preload).toBe('auto');
	});

	test('allows overriding preload attribute', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/audio.mp3',
			mediaType: 'audio'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor, props: { preload: 'metadata' } });
				}
			}
		});
		flushSync();

		const audioElement = target.querySelector('audio') as HTMLAudioElement;
		expect(audioElement?.preload).toBe('metadata');
	});

	test('sets preload on video elements too', () => {
		target = document.createElement('div');
		document.body.appendChild(target);

		const mockContext = createMockPlayerContext({
			mediaUrl: 'https://example.com/video.mp4',
			mediaType: 'video'
		});

		mount(TestContextProvider, {
			target,
			props: {
				context: mockContext,
				children: (anchor: any) => {
					mount(Viewer, { target, anchor });
				}
			}
		});
		flushSync();

		const videoElement = target.querySelector('video') as HTMLVideoElement;
		expect(videoElement?.preload).toBe('auto');
	});
});
