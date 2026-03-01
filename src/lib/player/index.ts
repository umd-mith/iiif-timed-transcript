// Compound component exports for IIIF Player
import type { Component } from 'svelte';
import Root from './Root.svelte';
import Viewer from './Viewer.svelte';
import Controls from './Controls.svelte';
import PlayButton from './PlayButton.svelte';
import Progress from './Progress.svelte';
import Skip from './Skip.svelte';
import Speed from './Speed.svelte';
import Time from './Time.svelte';
import Transcript from './Transcript.svelte';
import TranscriptSearch from './TranscriptSearch.svelte';
import TranscriptSegments from './TranscriptSegments.svelte';
import Chapters from './Chapters.svelte';
import CanvasNav from './CanvasNav.svelte';

/**
 * IIIF Player compound component namespace.
 *
 * Usage:
 * ```svelte
 * <IIIFPlayer.Root manifestUrl="...">
 *   <IIIFPlayer.Viewer />
 *   <IIIFPlayer.Controls>
 *     <IIIFPlayer.PlayButton />
 *     <IIIFPlayer.Progress />
 *     <IIIFPlayer.Speed />
 *   </IIIFPlayer.Controls>
 *   <IIIFPlayer.Transcript annotations={...}>
 *     <IIIFPlayer.TranscriptSearch />
 *     <IIIFPlayer.TranscriptSegments />
 *   </IIIFPlayer.Transcript>
 * </IIIFPlayer.Root>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IIIFPlayer: Record<string, Component<any>> = {
	Root,
	Viewer,
	Controls,
	PlayButton,
	Progress,
	Skip,
	Speed,
	Time,
	Transcript,
	TranscriptSearch,
	TranscriptSegments,
	Chapters,
	CanvasNav
};

// Export context accessor for custom child components
export { getPlayerContext } from './context';

// Export types
export type { PlayerContext, PlayerState, PlayerActions, MediaStrategy, CanvasInfo, TrackDefinition } from './context';
export type { TranscriptContext, TranscriptState, TranscriptActions } from './transcript-context';
