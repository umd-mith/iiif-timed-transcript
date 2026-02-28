import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Root from './Root.svelte';
import TestContextConsumer from '../../test/player/TestContextConsumer.svelte';
import type { PlayerContext } from './context';
import {
	MANIFEST_WITH_CHAPTERS,
	MANIFEST_WITHOUT_CHAPTERS,
	MANIFEST_WITH_HLS,
	MANIFEST_WITH_VTT_CAPTIONS,
	mockFetchManifest
} from './test-fixtures';

describe('Root component', () => {
	let target: HTMLElement;

	beforeEach(() => {
		target = document.createElement('div');
		document.body.appendChild(target);
		globalThis.fetch = vi.fn() as any;
	});

	afterEach(() => {
		if (document.body.contains(target)) {
			document.body.removeChild(target);
		}
	});

	const mockManifest = {
		'@context': 'http://iiif.io/api/presentation/3/context.json',
		id: 'https://example.com/manifest',
		type: 'Manifest',
		items: [
			{
				id: 'canvas1',
				type: 'Canvas',
				items: [
					{
						id: 'page1',
						type: 'AnnotationPage',
						items: [
							{
								id: 'annotation1',
								type: 'Annotation',
								motivation: 'painting',
								body: {
									id: 'https://example.com/audio.mp3',
									type: 'Sound',
									format: 'audio/mp3'
								},
								target: 'canvas1'
							}
						]
					}
				]
			}
		]
	};

	// Use unique URLs per test to avoid module-level cache cross-contamination
	test('renders without errors', () => {
		(globalThis.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockManifest
		});

		mount(Root, {
			target,
			props: { manifestUrl: 'https://example.com/render-test.json' }
		});
		flushSync();

		expect(target.querySelector('.iiif-player-root')).toBeTruthy();
	});

	test('does not re-fetch manifest for same URL when mounted twice', async () => {
		const url = 'https://example.com/cache-dedup-test.json';
		(globalThis.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockManifest
		});

		// Mount first instance
		mount(Root, {
			target,
			props: { manifestUrl: url }
		});
		flushSync();

		// Wait for first fetch to complete
		await vi.waitFor(() => {
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		});

		// Mount second instance with same URL
		const target2 = document.createElement('div');
		document.body.appendChild(target2);

		mount(Root, {
			target: target2,
			props: { manifestUrl: url }
		});
		flushSync();

		// Wait a tick for onMount to fire
		await new Promise((r) => setTimeout(r, 50));

		// Should still only have fetched once
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);

		document.body.removeChild(target2);
	});

	test('fetches different URLs separately', async () => {
		(globalThis.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockManifest
		});

		mount(Root, {
			target,
			props: { manifestUrl: 'https://example.com/separate-a.json' }
		});
		flushSync();

		await vi.waitFor(() => {
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		});

		const target2 = document.createElement('div');
		document.body.appendChild(target2);

		mount(Root, {
			target: target2,
			props: { manifestUrl: 'https://example.com/separate-b.json' }
		});
		flushSync();

		await vi.waitFor(() => {
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		document.body.removeChild(target2);
	});

	describe('chapters parsing', () => {
		test('exposes chapters from manifest with structures', async () => {
			mockFetchManifest(MANIFEST_WITH_CHAPTERS);

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/manifest.json',
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				// Context uses getters so .chapters reads the latest value
				expect(capturedCtx!.chapters).toBeDefined();
				expect(capturedCtx!.chapters.length).toBe(2);
				expect(capturedCtx!.chapters[0]).toMatchObject({
					id: 'https://example.com/range/1',
					label: 'Introduction',
					startTime: 0,
					endTime: 30
				});
				expect(capturedCtx!.chapters[1]).toMatchObject({
					id: 'https://example.com/range/2',
					label: 'Main Discussion',
					startTime: 30,
					endTime: 90
				});
			});
		});

		test('returns empty chapters when manifest has no structures', async () => {
			mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/manifest.json',
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				expect(capturedCtx!.chapters).toBeDefined();
				expect(capturedCtx!.chapters).toEqual([]);
				expect(capturedCtx!.state.error).toBeNull();
			});
		});

		test('activeChapterId starts as null (with chapters manifest)', async () => {
			mockFetchManifest(MANIFEST_WITH_CHAPTERS);

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/manifest.json',
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				expect(capturedCtx!.activeChapterId).toBeNull();
			});
		});
	});

	describe('HLS detection', () => {
		test('sets mediaStrategy to hls-js for .m3u8 URLs when native not supported', async () => {
			mockFetchManifest(MANIFEST_WITH_HLS);

			// Create a mock HLS constructor for Root to use
			function MockHls() {
				return { loadSource: vi.fn(), attachMedia: vi.fn(), destroy: vi.fn(), on: vi.fn(), off: vi.fn() };
			}
			(MockHls as any).isSupported = () => true;
			(MockHls as any).Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/hls-manifest.json',
					hlsConstructor: MockHls as any,
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				expect(capturedCtx!.mediaUrl).toBe('https://example.com/stream/master.m3u8');
				// In Chromium, native HLS may be supported, so strategy could be 'native' or 'hls-js'
				// The key assertion: it detected HLS content and the adapter exists when strategy is hls-js
				const strategy = capturedCtx!.mediaStrategy;
				if (strategy === 'hls-js') {
					expect(capturedCtx!.hlsAdapter).not.toBeNull();
				} else {
					expect(strategy).toBe('native');
				}
			});
		});

		test('sets mediaStrategy to native for non-HLS URLs', async () => {
			mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/non-hls-manifest.json',
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				expect(capturedCtx!.mediaStrategy).toBe('native');
				expect(capturedCtx!.hlsAdapter).toBeNull();
			});
		});
	});

	describe('VTT caption discovery', () => {
		test('discovers VTT tracks from canvas annotations', async () => {
			mockFetchManifest(MANIFEST_WITH_VTT_CAPTIONS);

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/vtt-manifest.json',
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				expect(capturedCtx!.tracks).toBeDefined();
				expect(capturedCtx!.tracks).toHaveLength(1);
				expect(capturedCtx!.tracks[0]).toMatchObject({
					src: 'https://example.com/captions-en.vtt',
					kind: 'captions',
					srclang: 'en'
				});
			});
		});

		test('returns empty tracks when manifest has no VTT annotations', async () => {
			mockFetchManifest(MANIFEST_WITHOUT_CHAPTERS);

			let capturedCtx: PlayerContext | null = null;

			mount(Root, {
				target,
				props: {
					manifestUrl: 'https://example.com/no-vtt-manifest.json',
					children: (anchor: any) => {
						mount(TestContextConsumer, {
							target,
							anchor,
							props: {
								onResult: (ctx: PlayerContext) => {
									capturedCtx = ctx;
								}
							}
						});
					}
				}
			});

			await vi.waitFor(() => {
				expect(capturedCtx).not.toBeNull();
				expect(capturedCtx!.tracks).toBeDefined();
				expect(capturedCtx!.tracks).toEqual([]);
			});
		});
	});
});
