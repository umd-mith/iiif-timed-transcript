import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { flushSync } from 'svelte';
import Root from './Root.svelte';

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

	test('renders without errors', () => {
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

		(globalThis.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockManifest
		});

		mount(Root, {
			target,
			props: { manifestUrl: 'https://example.com/manifest.json' }
		});
		flushSync();

		expect(target.querySelector('.iiif-player-root')).toBeTruthy();
	});
});
