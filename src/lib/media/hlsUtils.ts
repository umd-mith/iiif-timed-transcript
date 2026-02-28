const HLS_FORMATS = ['application/vnd.apple.mpegurl', 'application/x-mpegurl'];

/**
 * Detects whether a URL points to an HLS stream.
 * Checks for .m3u8 extension (ignoring query/fragment) and
 * known HLS content types from the IIIF manifest format field.
 */
export function isHlsUrl(url: string, format?: string): boolean {
	try {
		const pathname = new URL(url).pathname;
		if (pathname.endsWith('.m3u8')) return true;
	} catch {
		// If URL parsing fails, try simple string match
		if (url.split('?')[0]?.split('#')[0]?.endsWith('.m3u8')) return true;
	}

	if (format && HLS_FORMATS.includes(format.toLowerCase())) return true;

	return false;
}

/**
 * Checks whether the browser supports HLS playback natively (e.g. Safari).
 * Accepts an optional media element for testability via dependency injection.
 */
export function isHlsNativelySupported(mediaElement?: HTMLMediaElement): boolean {
	const el = mediaElement ?? document.createElement('video');
	return (
		el.canPlayType('application/vnd.apple.mpegurl') !== '' ||
		el.canPlayType('application/x-mpegURL') !== ''
	);
}

/**
 * Minimal interface for the hls.js constructor, used for dependency injection
 * so consumers provide the actual hls.js library (optional peer dep).
 */
export interface HlsConstructor {
	new (): HlsInstance;
	isSupported(): boolean;
	Events: { MANIFEST_PARSED: string; ERROR: string };
}

interface HlsInstance {
	loadSource(src: string): void;
	attachMedia(el: HTMLMediaElement): void;
	destroy(): void;
	on(event: string, handler: (...args: unknown[]) => void): void;
	off(event: string, handler: (...args: unknown[]) => void): void;
}

export interface HlsAdapter {
	attach(el: HTMLMediaElement, src: string, options?: { onError?: (data: unknown) => void }): void;
	detach(): void;
	isSupported(): boolean;
}

/**
 * Creates an HLS adapter that manages the hls.js lifecycle on a media element.
 * The hls.js constructor is injected so the library remains an optional peer dep.
 */
export function createHlsAdapter(Hls: HlsConstructor): HlsAdapter {
	let instance: HlsInstance | null = null;

	return {
		attach(el, src, options) {
			// Clean up any previous instance
			if (instance) {
				instance.destroy();
				instance = null;
			}

			instance = new Hls();

			if (options?.onError) {
				const onError = options.onError;
				instance.on(Hls.Events.ERROR, (_event: unknown, data: unknown) => {
					onError(data);
				});
			}

			instance.loadSource(src);
			instance.attachMedia(el);
		},

		detach() {
			if (instance) {
				instance.destroy();
				instance = null;
			}
		},

		isSupported() {
			return Hls.isSupported();
		}
	};
}
