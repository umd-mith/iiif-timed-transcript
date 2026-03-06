import { vi } from "vitest";
import { mount, type Component } from "svelte";
import type { Snippet } from "svelte";
import type {
  PlayerActions,
  PlayerContext,
  PlayerState,
} from "../../lib/player/context";
import type { Annotation } from "../../lib/sync/types";
import type { Chapter } from "@umd-mith/iiif-media-parsers";
import TestContextConsumer from "./TestContextConsumer.svelte";

/**
 * Creates a typed Snippet for Root's children prop that mounts a
 * TestContextConsumer to capture the PlayerContext.
 */
export function createContextCapture(
  target: HTMLElement,
  onResult: (ctx: PlayerContext) => void,
): Snippet<
  [
    {
      player: {
        state: PlayerState;
        actions: PlayerActions;
        annotations: Annotation[];
        chapters: Chapter[];
        activeChapterId: string | null;
      };
    },
  ]
> {
  return ((_anchor: Node) => {
    mount(TestContextConsumer, {
      target,
      anchor: _anchor,
      props: { onResult },
    });
  }) as unknown as Snippet<
    [
      {
        player: {
          state: PlayerState;
          actions: PlayerActions;
          annotations: Annotation[];
          chapters: Chapter[];
          activeChapterId: string | null;
        };
      },
    ]
  >;
}

/**
 * Creates a plain Snippet that mounts a component at the anchor point.
 * Centralizes the Snippet cast needed for Svelte's mount() in tests.
 */
export function createChildSnippet(
  target: HTMLElement,
  ChildComponent: Component,
  props: Record<string, unknown> = {},
): Snippet {
  return ((_anchor: Node) => {
    mount(ChildComponent, { target, anchor: _anchor, props });
  }) as unknown as Snippet;
}

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
      ...stateOverrides,
    },
    mediaElement: null,
    mediaUrl: "https://example.com/media.mp3",
    mediaType: "audio",
    mediaStrategy: "native",
    hlsAdapter: null,
    annotations: [],
    chapters: [],
    activeChapterId: null,
    tracks: [],
    canvasIndex: 0,
    canvasCount: 1,
    canvases: [],
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
