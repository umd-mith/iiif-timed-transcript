import { vi } from 'vitest';
import type { PlayerContext } from './context';

export function createMockPlayerContext(overrides: Partial<PlayerContext> = {}): PlayerContext {
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
		mediaElement: null,
		actions: {
			play: vi.fn(),
			pause: vi.fn(),
			seekTo: vi.fn(),
			setPlaybackRate: vi.fn(),
			retry: vi.fn(),
			...overrides.actions
		},
		...overrides
	};
}
