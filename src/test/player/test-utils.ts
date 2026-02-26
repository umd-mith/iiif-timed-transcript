import { vi } from 'vitest';
import type { PlayerContext, PlayerState, PlayerActions } from '../../lib/player/context';

export function createMockPlayerContext(overrides: {
	state?: Partial<PlayerState>;
	actions?: Partial<PlayerActions>;
	mediaElement?: HTMLMediaElement | null;
	mediaUrl?: string;
	mediaType?: 'audio' | 'video';
} = {}): PlayerContext {
	return {
		state: {
			isPlaying: false,
			currentTime: 0,
			duration: 120,
			playbackRate: 1,
			isReady: true,
			error: null,
			...overrides.state
		},
		mediaElement: overrides.mediaElement ?? null,
		mediaUrl: overrides.mediaUrl ?? 'https://example.com/media.mp3',
		mediaType: overrides.mediaType ?? 'audio',
		actions: {
			play: vi.fn(),
			pause: vi.fn(),
			seekTo: vi.fn(),
			setPlaybackRate: vi.fn(),
			retry: vi.fn(),
			...overrides.actions
		}
	};
}
