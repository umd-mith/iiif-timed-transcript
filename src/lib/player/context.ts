import { getContext as svelteGetContext } from 'svelte';
import type { Chapter } from '@umd-mith/iiif-media-parsers';

export interface PlayerState {
	isPlaying: boolean;
	isBuffering: boolean;
	currentTime: number;
	duration: number;
	playbackRate: number;
	isReady: boolean;
	error: Error | null;
}

export interface PlayerActions {
	play: () => Promise<void>;
	pause: () => void;
	seekTo: (time: number) => void;
	setPlaybackRate: (rate: number) => void;
	retry: () => Promise<void>;
	seekToChapter: (chapter: Chapter) => void;
}

export interface PlayerContext {
	state: PlayerState;
	mediaElement: HTMLMediaElement | null;
	mediaUrl: string;
	mediaType: 'audio' | 'video';
	readonly chapters: Chapter[];
	readonly activeChapterId: string | null;
	actions: PlayerActions;
}

export const PLAYER_CONTEXT_KEY = 'iiif-player';

export function getPlayerContext(): PlayerContext {
	const ctx = svelteGetContext<PlayerContext>(PLAYER_CONTEXT_KEY);
	if (!ctx) {
		throw new Error('Player context not found. Component must be child of IIIFPlayer.Root');
	}
	return ctx;
}
