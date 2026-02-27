import { vi } from 'vitest';
import type { PlayerActions, PlayerContext, PlayerState } from '../../lib/player/context';

type MockPlayerOverrides = Partial<
	Omit<PlayerContext, 'state' | 'actions'> & {
		state: Partial<PlayerState>;
		actions: Partial<PlayerActions>;
	}
>;

export function createMockPlayerContext(overrides: MockPlayerOverrides = {}): PlayerContext {
	const { state: stateOverrides, actions: actionsOverrides, ...rest } = overrides;
	return {
		state: {
			isPlaying: false,
			isBuffering: false,
			currentTime: 0,
			duration: 120,
			playbackRate: 1,
			isReady: true,
			error: null,
			...stateOverrides
		},
		mediaElement: null,
		mediaUrl: 'https://example.com/media.mp3',
		mediaType: 'audio',
		chapters: [],
		activeChapterId: null,
		actions: {
			play: vi.fn(),
			pause: vi.fn(),
			seekTo: vi.fn(),
			setPlaybackRate: vi.fn(),
			retry: vi.fn(),
			seekToChapter: vi.fn(),
			...actionsOverrides
		},
		...rest
	};
}
