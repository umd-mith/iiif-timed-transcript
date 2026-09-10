import { vi } from "vitest";
import type {
  PlayerActions,
  PlayerContext,
  PlayerState,
} from "../../lib/player/context";

// Tests mount through vitest-browser-svelte's render() (see TestContextHarness
// / TestRootContextCapture), which auto-unmounts. The former createChildSnippet
// / createContextCapture svelte.mount() helpers were removed with that switch.

type MockPlayerOverrides = Partial<
  Omit<PlayerContext, "state" | "actions"> & {
    state: Partial<PlayerState>;
    actions: Partial<PlayerActions>;
  }
>;

export function createMockPlayerContext(
  overrides: MockPlayerOverrides = {},
): PlayerContext {
  const {
    state: stateOverrides,
    actions: actionsOverrides,
    ...rest
  } = overrides;
  return {
    state: {
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 120,
      playbackRate: 1,
      isReady: true,
      error: null,
      hasEnded: false,
      isSeeking: false,
      ...stateOverrides,
    },
    mediaElement: null,
    mediaUrl: "https://example.com/media.mp3",
    mediaType: "audio",
    posterUrl: undefined,
    mediaStrategy: "native",
    hlsAdapter: null,
    dashAdapter: null,
    annotations: [],
    chapters: [],
    activeChapterId: null,
    tracks: [],
    // Mirror `tracks` unless a test sets captionTracks explicitly, so existing
    // callers that express "this canvas has caption tracks" via `tracks` still
    // light the CC button (Captions reads captionTracks).
    captionTracks: rest.captionTracks ?? rest.tracks ?? [],
    loadNonce: 0,
    canvasIndex: 0,
    canvasCount: 1,
    canvases: [],
    transcriptStatus: "idle",
    transcriptPopulated: false,
    captionsState: "unavailable",
    toggleCaptions: vi.fn(),
    reportNativeCaptionChange: vi.fn(),
    reportCaptionTracks: vi.fn(),
    actions: {
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      setPlaybackRate: vi.fn(),
      retry: vi.fn(),
      seekToChapter: vi.fn(),
      switchCanvas: vi.fn(),
      ...actionsOverrides,
    },
    ...rest,
  };
}
