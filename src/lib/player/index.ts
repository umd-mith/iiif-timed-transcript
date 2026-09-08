// Compound component exports for IIIF Player
import Root from "./Root.svelte";
import Viewer from "./Viewer.svelte";
import Controls from "./Controls.svelte";
import PlayButton from "./PlayButton.svelte";
import Progress from "./Progress.svelte";
import Skip from "./Skip.svelte";
import Speed from "./Speed.svelte";
import Time from "./Time.svelte";
import Transcript from "./Transcript.svelte";
import TranscriptSearch from "./TranscriptSearch.svelte";
import TranscriptSegments from "./TranscriptSegments.svelte";
import Chapters from "./Chapters.svelte";
import CanvasNav from "./CanvasNav.svelte";
import Captions from "./Captions.svelte";

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
export const IIIFPlayer: {
  Root: typeof Root;
  Viewer: typeof Viewer;
  Controls: typeof Controls;
  PlayButton: typeof PlayButton;
  Progress: typeof Progress;
  Skip: typeof Skip;
  Speed: typeof Speed;
  Time: typeof Time;
  Transcript: typeof Transcript;
  TranscriptSearch: typeof TranscriptSearch;
  TranscriptSegments: typeof TranscriptSegments;
  Chapters: typeof Chapters;
  CanvasNav: typeof CanvasNav;
  Captions: typeof Captions;
} = {
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
  CanvasNav,
  Captions,
};

// Export player context accessors for custom child components
export { getPlayerContext, tryGetPlayerContext } from "./context.js";

// Export types
export type {
  PlayerContext,
  PlayerState,
  PlayerActions,
  MediaStrategy,
  CanvasInfo,
  TrackDefinition,
  PlayerRef,
  TranscriptStatus,
  PlayerErrorSource,
  PlayerErrorInfo,
} from "./context.js";
export type {
  TranscriptContext,
  TranscriptState,
  TranscriptActions,
} from "./transcript-context.js";
