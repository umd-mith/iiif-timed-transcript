import { mount, unmount as svelteUnmount } from 'svelte';
import { test, describe, expect, vi } from 'vitest';
import MediaPlayer from './MediaPlayer.svelte';
import { flushSync } from 'svelte';

/** Helper: mount MediaPlayer and wait for the audio element to be bound */
function mountMediaPlayer(target: HTMLElement, extraProps = {}) {
	const component = mount(MediaPlayer, {
		target,
		props: {
			mediaUrl: 'http://example.com/audio.mp3',
			mediaType: 'audio' as const,
			...extraProps
		}
	});
	// flushSync ensures bind:this has run
	flushSync();
	return component;
}

describe('MediaPlayer - seekTo() Guards', () => {
	test('returns early if element not initialized', () => {
		const consoleSpy = vi.spyOn(console, 'warn');
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		// Unmount component to clear the mediaElement reference
		svelteUnmount(component);

		// Try to seek after unmount (element is now null)
		component.seekTo(10);

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/element not initialized/i));
		document.body.removeChild(target);
	});

	test('rejects NaN as invalid time', () => {
		const consoleSpy = vi.spyOn(console, 'warn');
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		component.seekTo(NaN);

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid seek time/i));
		svelteUnmount(component);
		document.body.removeChild(target);
	});

	test('rejects Infinity as invalid time', () => {
		const consoleSpy = vi.spyOn(console, 'warn');
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		component.seekTo(Infinity);

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid seek time/i));
		svelteUnmount(component);
		document.body.removeChild(target);
	});

	test('rejects negative time as invalid', () => {
		const consoleSpy = vi.spyOn(console, 'warn');
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		component.seekTo(-5);

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid seek time/i));
		svelteUnmount(component);
		document.body.removeChild(target);
	});

	test('waits for media ready before seeking', () => {
		const consoleSpy = vi.spyOn(console, 'warn');
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		const audioElement = target.querySelector('audio') as HTMLAudioElement;

		// Force readyState to 0 (HAVE_NOTHING) to simulate media not ready
		Object.defineProperty(audioElement, 'readyState', {
			value: 0,
			configurable: true
		});

		// Try to seek when media not ready
		component.seekTo(10);

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/media not ready/i));
		svelteUnmount(component);
		document.body.removeChild(target);
	});

	test('clamps seek time to duration', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		const audioElement = target.querySelector('audio') as HTMLAudioElement;

		// Set media to ready state with 60s duration
		Object.defineProperty(audioElement, 'readyState', {
			value: 2, // HAVE_CURRENT_DATA
			configurable: true
		});
		Object.defineProperty(audioElement, 'duration', {
			value: 60,
			configurable: true
		});

		// Try to seek past duration
		component.seekTo(999);

		// Should clamp to duration (60s), not set to 999
		expect(audioElement.currentTime).toBe(60);
		svelteUnmount(component);
		document.body.removeChild(target);
	});
});

describe('MediaPlayer - Lifecycle Events', () => {
	test('emits onLoadStart when media begins loading', () => {
		const onLoadStart = vi.fn();
		const target = document.createElement('div');
		document.body.appendChild(target);

		mountMediaPlayer(target, { onLoadStart });

		const audioElement = target.querySelector('audio') as HTMLAudioElement;

		// Trigger loadstart event
		audioElement.dispatchEvent(new Event('loadstart'));

		expect(onLoadStart).toHaveBeenCalled();
		document.body.removeChild(target);
	});

	test('emits onCanPlay when media is ready', () => {
		const onCanPlay = vi.fn();
		const target = document.createElement('div');
		document.body.appendChild(target);

		mountMediaPlayer(target, { onCanPlay });

		const audioElement = target.querySelector('audio') as HTMLAudioElement;

		// Trigger canplay event
		audioElement.dispatchEvent(new Event('canplay'));

		expect(onCanPlay).toHaveBeenCalled();
		document.body.removeChild(target);
	});

	test('emits onTimeUpdate with current time', () => {
		const onTimeUpdate = vi.fn();
		const target = document.createElement('div');
		document.body.appendChild(target);

		mountMediaPlayer(target, { onTimeUpdate });

		const audioElement = target.querySelector('audio') as HTMLAudioElement;

		// Set current time and trigger event
		Object.defineProperty(audioElement, 'currentTime', {
			value: 5.5,
			configurable: true
		});
		audioElement.dispatchEvent(new Event('timeupdate'));

		expect(onTimeUpdate).toHaveBeenCalledWith(5.5);
		document.body.removeChild(target);
	});
});

describe('MediaPlayer - Cleanup', () => {
	test('pauses media on unmount', async () => {
		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mountMediaPlayer(target);

		const audioElement = target.querySelector('audio') as HTMLAudioElement;
		const pauseSpy = vi.spyOn(audioElement, 'pause');
		const srcSetter = vi.spyOn(audioElement, 'src', 'set');

		svelteUnmount(component);

		// Should attempt to pause and clear src
		expect(pauseSpy).toHaveBeenCalled();
		expect(srcSetter).toHaveBeenCalledWith('');
		document.body.removeChild(target);
	});
});
