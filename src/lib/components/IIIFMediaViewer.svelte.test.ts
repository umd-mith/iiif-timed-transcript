import { mount, unmount as svelteUnmount } from 'svelte';
import { test, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import IIIFMediaViewer from './IIIFMediaViewer.svelte';
import { flushSync, tick } from 'svelte';
import type { ManifestData } from '../iiif/validators';

/** Helper: Create a valid audio IIIF manifest */
function createAudioManifest(mediaUrl = 'https://example.com/audio.mp3'): ManifestData {
	return {
		'@context': 'http://iiif.io/api/presentation/3/context.json',
		id: 'https://example.com/manifest.json',
		type: 'Manifest',
		label: { en: ['Test Audio'] },
		items: [
			{
				id: 'https://example.com/canvas/1',
				type: 'Canvas',
				duration: 120,
				items: [
					{
						id: 'https://example.com/page/1',
						type: 'AnnotationPage',
						items: [
							{
								id: 'https://example.com/annotation/1',
								type: 'Annotation',
								motivation: 'painting',
								body: {
									id: mediaUrl,
									type: 'Sound',
									format: 'audio/mpeg',
									duration: 120
								},
								target: 'https://example.com/canvas/1'
							}
						]
					}
				]
			}
		]
	};
}

/** Helper: Create a valid video IIIF manifest */
function createVideoManifest(mediaUrl = 'https://example.com/video.mp4'): ManifestData {
	return {
		'@context': 'http://iiif.io/api/presentation/3/context.json',
		id: 'https://example.com/manifest.json',
		type: 'Manifest',
		label: { en: ['Test Video'] },
		items: [
			{
				id: 'https://example.com/canvas/1',
				type: 'Canvas',
				width: 1920,
				height: 1080,
				duration: 180,
				items: [
					{
						id: 'https://example.com/page/1',
						type: 'AnnotationPage',
						items: [
							{
								id: 'https://example.com/annotation/1',
								type: 'Annotation',
								motivation: 'painting',
								body: {
									id: mediaUrl,
									type: 'Video',
									format: 'video/mp4',
									width: 1920,
									height: 1080,
									duration: 180
								},
								target: 'https://example.com/canvas/1'
							}
						]
					}
				]
			}
		]
	};
}

/** Helper: Mock fetch to return a manifest */
function mockFetchSuccess(manifest: ManifestData) {
	window.fetch = vi.fn(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve(manifest)
		} as Response)
	);
}

/** Helper: Mock fetch to return an error */
function mockFetchError(status = 404, statusText = 'Not Found') {
	window.fetch = vi.fn(() =>
		Promise.resolve({
			ok: false,
			status,
			statusText,
			text: () => Promise.resolve('Manifest not found')
		} as Response)
	);
}

describe('IIIFMediaViewer - Manifest Loading', () => {
	beforeEach(() => {
		// Clear any previous mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore original fetch
		vi.restoreAllMocks();
	});

	test('loads audio manifest and renders MediaPlayer', async () => {
		const manifest = createAudioManifest();
		mockFetchSuccess(manifest);

		const target = document.createElement('div');
		document.body.appendChild(target);

		const onLoad = vi.fn();
		mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/manifest.json',
				onLoad
			}
		});
		flushSync();

		// Wait for async manifest loading
		await tick();
		await tick();

		// Should call onLoad after successful manifest fetch
		expect(onLoad).toHaveBeenCalled();

		// Should render audio element
		const audioElement = target.querySelector('audio');
		expect(audioElement).toBeTruthy();
		expect(audioElement?.src).toBe('https://example.com/audio.mp3');

		document.body.removeChild(target);
	});

	test('loads video manifest and passes dimensions to MediaPlayer', async () => {
		const manifest = createVideoManifest();
		mockFetchSuccess(manifest);

		const target = document.createElement('div');
		document.body.appendChild(target);

		mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/manifest.json'
			}
		});
		flushSync();

		await tick();
		await tick();

		// Should render video element with dimensions
		const videoElement = target.querySelector('video') as HTMLVideoElement;
		expect(videoElement).toBeTruthy();
		expect(videoElement?.src).toBe('https://example.com/video.mp4');
		expect(videoElement?.width).toBe(1920);
		expect(videoElement?.height).toBe(1080);

		document.body.removeChild(target);
	});

	test('handles fetch errors gracefully', async () => {
		mockFetchError(404, 'Not Found');

		const target = document.createElement('div');
		document.body.appendChild(target);

		const onError = vi.fn();
		mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/nonexistent.json',
				onError
			}
		});
		flushSync();

		await tick();
		await tick();

		// Should call onError
		expect(onError).toHaveBeenCalled();

		// Should show error message
		const errorDiv = target.querySelector('.iiif-media-viewer__error');
		expect(errorDiv).toBeTruthy();
		expect(errorDiv?.textContent).toContain('Failed to load IIIF media');

		document.body.removeChild(target);
	});

	test('shows loading state initially', () => {
		const manifest = createAudioManifest();
		mockFetchSuccess(manifest);

		const target = document.createElement('div');
		document.body.appendChild(target);

		mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/manifest.json'
			}
		});
		flushSync();

		// Should show loading indicator immediately
		const loadingDiv = target.querySelector('.iiif-media-viewer__loading');
		expect(loadingDiv).toBeTruthy();
		expect(loadingDiv?.textContent).toContain('Loading IIIF media');

		document.body.removeChild(target);
	});
});

describe('IIIFMediaViewer - Canvas Selection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('loads first canvas by default', async () => {
		const manifest: ManifestData = {
			'@context': 'http://iiif.io/api/presentation/3/context.json',
			id: 'https://example.com/manifest.json',
			type: 'Manifest',
			label: { en: ['Multi-canvas'] },
			items: [
				{
					id: 'https://example.com/canvas/1',
					type: 'Canvas',
					duration: 60,
					items: [
						{
							id: 'https://example.com/page/1',
							type: 'AnnotationPage',
							items: [
								{
									id: 'https://example.com/annotation/1',
									type: 'Annotation',
									motivation: 'painting',
									body: {
										id: 'https://example.com/audio1.mp3',
										type: 'Sound'
									},
									target: 'https://example.com/canvas/1'
								}
							]
						}
					]
				},
				{
					id: 'https://example.com/canvas/2',
					type: 'Canvas',
					duration: 90,
					items: [
						{
							id: 'https://example.com/page/2',
							type: 'AnnotationPage',
							items: [
								{
									id: 'https://example.com/annotation/2',
									type: 'Annotation',
									motivation: 'painting',
									body: {
										id: 'https://example.com/audio2.mp3',
										type: 'Sound'
									},
									target: 'https://example.com/canvas/2'
								}
							]
						}
					]
				}
			]
		};
		mockFetchSuccess(manifest);

		const target = document.createElement('div');
		document.body.appendChild(target);

		mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/manifest.json'
			}
		});
		flushSync();

		await tick();
		await tick();

		const audioElement = target.querySelector('audio');
		expect(audioElement?.src).toBe('https://example.com/audio1.mp3');

		document.body.removeChild(target);
	});

	test('loads canvas at specified index', async () => {
		const manifest: ManifestData = {
			'@context': 'http://iiif.io/api/presentation/3/context.json',
			id: 'https://example.com/manifest.json',
			type: 'Manifest',
			label: { en: ['Multi-canvas'] },
			items: [
				{
					id: 'https://example.com/canvas/1',
					type: 'Canvas',
					duration: 60,
					items: [
						{
							id: 'https://example.com/page/1',
							type: 'AnnotationPage',
							items: [
								{
									id: 'https://example.com/annotation/1',
									type: 'Annotation',
									motivation: 'painting',
									body: {
										id: 'https://example.com/audio1.mp3',
										type: 'Sound'
									},
									target: 'https://example.com/canvas/1'
								}
							]
						}
					]
				},
				{
					id: 'https://example.com/canvas/2',
					type: 'Canvas',
					duration: 90,
					items: [
						{
							id: 'https://example.com/page/2',
							type: 'AnnotationPage',
							items: [
								{
									id: 'https://example.com/annotation/2',
									type: 'Annotation',
									motivation: 'painting',
									body: {
										id: 'https://example.com/audio2.mp3',
										type: 'Sound'
									},
									target: 'https://example.com/canvas/2'
								}
							]
						}
					]
				}
			]
		};
		mockFetchSuccess(manifest);

		const target = document.createElement('div');
		document.body.appendChild(target);

		mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/manifest.json',
				canvasIndex: 1 // Load second canvas
			}
		});
		flushSync();

		await tick();
		await tick();

		const audioElement = target.querySelector('audio');
		expect(audioElement?.src).toBe('https://example.com/audio2.mp3');

		document.body.removeChild(target);
	});
});

describe('IIIFMediaViewer - Public API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('exposes MediaPlayer public API methods', async () => {
		const manifest = createAudioManifest();
		mockFetchSuccess(manifest);

		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mount(IIIFMediaViewer, {
			target,
			props: {
				iiifManifestUrl: 'https://example.com/manifest.json'
			}
		});
		flushSync();

		await tick();
		await tick();

		// Public API methods should be available
		expect(typeof component.seekTo).toBe('function');
		expect(typeof component.getCurrentTime).toBe('function');
		expect(typeof component.getDuration).toBe('function');
		expect(typeof component.play).toBe('function');
		expect(typeof component.pause).toBe('function');
		expect(typeof component.isReady).toBe('function');
		expect(typeof component.setPlaybackRate).toBe('function');

		document.body.removeChild(target);
	});
});
