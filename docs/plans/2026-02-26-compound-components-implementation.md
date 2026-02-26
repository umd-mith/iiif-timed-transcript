# Compound Component Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor library to use Melt UI-style compound components with Svelte 5 `$state` and context, solving LDA-1983 API footguns.

**Architecture:** Context-driven compound components. `IIIFPlayer.Root` creates media element and provides context via `setContext()`. Child components (`Viewer`, `PlayButton`, `Progress`, etc.) consume context with `getContext()`. All state is `$state` reactive, no stores needed.

**Tech Stack:** Svelte 5 (runes, context), TypeScript, Vitest (browser mode), IIIF Presentation 3.0

**Related Design:** `docs/plans/2026-02-26-compound-components-design.md`

---

## Phase 1: Context Foundation (3 pts)

### Task 1.1: Create Context Types and Helpers

**Files:**
- Create: `src/lib/player/context.ts`

**Step 1: Create context type definitions**

```typescript
// src/lib/player/context.ts
import { getContext as svelteGetContext } from 'svelte';

export interface PlayerState {
  isPlaying: boolean;
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
}

export interface PlayerContext {
  state: PlayerState;
  mediaElement: HTMLMediaElement | null;
  actions: PlayerActions;
}

export const PLAYER_CONTEXT_KEY = 'iiif-player';

export function getPlayerContext(): PlayerContext {
  const ctx = svelteGetContext<PlayerContext>(PLAYER_CONTEXT_KEY);
  if (!ctx) {
    throw new Error(
      'Player context not found. Component must be child of IIIFPlayer.Root'
    );
  }
  return ctx;
}
```

**Step 2: Write unit tests for context helper**

Create: `src/lib/player/context.test.ts`

```typescript
import { describe, test, expect, vi } from 'vitest';
import { getPlayerContext, PLAYER_CONTEXT_KEY } from './context';
import { setContext } from 'svelte';

describe('getPlayerContext', () => {
  test('throws error when no context available', () => {
    expect(() => getPlayerContext()).toThrow(
      'Player context not found'
    );
  });

  test('returns context when available', () => {
    const mockContext = {
      state: {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        isReady: false,
        error: null
      },
      mediaElement: null,
      actions: {
        play: vi.fn(),
        pause: vi.fn(),
        seekTo: vi.fn(),
        setPlaybackRate: vi.fn(),
        retry: vi.fn()
      }
    };

    setContext(PLAYER_CONTEXT_KEY, mockContext);
    const result = getPlayerContext();

    expect(result).toBe(mockContext);
  });
});
```

**Step 3: Run tests to verify they pass**

```bash
pnpm test src/lib/player/context.test.ts
```

Expected: 2 tests pass

**Step 4: Create test utilities for mock context**

Create: `src/lib/player/test-utils.ts`

```typescript
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
```

**Step 5: Commit context foundation**

```bash
git add src/lib/player/context.ts src/lib/player/context.test.ts src/lib/player/test-utils.ts
git commit -m "feat(player): add context types and helpers (LDA-1983)

- PlayerContext interface with state/actions/mediaElement
- getPlayerContext() helper with error handling
- createMockPlayerContext() test utility

Part 1/13 of compound component refactor"
```

---

### Task 1.2: Implement Root Component (Core Logic)

**Files:**
- Create: `src/lib/player/Root.svelte`
- Reference: `src/lib/components/IIIFMediaViewer.svelte` (adapt manifest loading)
- Reference: `src/lib/components/MediaPlayer.svelte` (adapt event listeners)

**Step 1: Create Root component skeleton**

```svelte
<!-- src/lib/player/Root.svelte -->
<script lang="ts">
  import { setContext, onMount } from 'svelte';
  import { PLAYER_CONTEXT_KEY, type PlayerContext, type PlayerState } from './context';
  import { getFirstCanvas, getPrimaryResource, isAudioCanvas, isVideoCanvas } from '../iiif/helpers';
  import { ManifestSchema } from '../iiif/validators';
  import type { Annotation } from '../sync/types';

  // Props
  let {
    manifestUrl,
    canvasIndex = 0,
    annotations = [],
    initialTime,
    autoplay = false,
    class: className = '',
    children
  }: {
    manifestUrl: string;
    canvasIndex?: number;
    annotations?: Annotation[];
    initialTime?: number;
    autoplay?: boolean;
    class?: string;
    children?: any;
  } = $props();

  // Reactive state
  let state = $state<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    isReady: false,
    error: null
  });

  let mediaElement = $state<HTMLMediaElement | null>(null);
  let mediaUrl = $state('');
  let mediaType = $state<'audio' | 'video'>('audio');

  // Actions
  const actions = {
    play: async () => {
      if (mediaElement) {
        await mediaElement.play();
      }
    },
    pause: () => {
      mediaElement?.pause();
    },
    seekTo: (time: number) => {
      if (!mediaElement || !state.isReady) {
        console.warn('[IIIFPlayer] Cannot seek: media not ready');
        return;
      }
      if (!isFinite(time) || time < 0) {
        console.warn(`[IIIFPlayer] Invalid seek time: ${time}`);
        return;
      }
      const clampedTime = Math.min(time, state.duration);
      mediaElement.currentTime = clampedTime;
    },
    setPlaybackRate: (rate: number) => {
      if (!mediaElement) {
        console.warn('[IIIFPlayer] Cannot set playback rate: element not initialized');
        return;
      }
      const clampedRate = Math.max(0.25, Math.min(4, rate));
      mediaElement.playbackRate = clampedRate;
    },
    retry: async () => {
      state.error = null;
      await loadManifest();
    }
  };

  // Provide context
  setContext(PLAYER_CONTEXT_KEY, {
    state,
    mediaElement,
    actions
  } satisfies PlayerContext);

  // Manifest loading
  async function loadManifest() {
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
      }

      const manifest = await response.json();
      const validationResult = ManifestSchema.safeParse(manifest);
      if (!validationResult.success) {
        throw new Error(
          `Invalid IIIF manifest: ${validationResult.error.issues.map(e => e.message).join(', ')}`
        );
      }

      const validManifest = validationResult.data;
      const canvas = validManifest.items?.[canvasIndex] ?? getFirstCanvas(validManifest);

      if (!canvas) {
        throw new Error('No canvas found in IIIF manifest');
      }

      if (isAudioCanvas(canvas)) {
        mediaType = 'audio';
      } else if (isVideoCanvas(canvas)) {
        mediaType = 'video';
      } else {
        throw new Error('Canvas is not audio or video media');
      }

      const primaryResource = getPrimaryResource(canvas);
      if (!primaryResource?.id) {
        throw new Error('No media resource found in canvas');
      }

      mediaUrl = primaryResource.id;
    } catch (error) {
      state.error = error instanceof Error ? error : new Error(String(error));
      state.isReady = false;
    }
  }

  // Set up media event listeners
  $effect(() => {
    if (!mediaElement) return;

    const handlePlay = () => { state.isPlaying = true; };
    const handlePause = () => { state.isPlaying = false; };
    const handleTimeUpdate = () => { state.currentTime = mediaElement.currentTime; };
    const handleDurationChange = () => {
      state.duration = mediaElement.duration;
      state.isReady = true;
    };
    const handleRateChange = () => { state.playbackRate = mediaElement.playbackRate; };
    const handleError = () => {
      const mediaError = mediaElement.error;
      if (mediaError) {
        state.error = new Error(`Media error (code ${mediaError.code})`);
        state.isReady = false;
      }
    };

    mediaElement.addEventListener('play', handlePlay);
    mediaElement.addEventListener('pause', handlePause);
    mediaElement.addEventListener('timeupdate', handleTimeUpdate);
    mediaElement.addEventListener('durationchange', handleDurationChange);
    mediaElement.addEventListener('ratechange', handleRateChange);
    mediaElement.addEventListener('error', handleError);

    return () => {
      mediaElement.removeEventListener('play', handlePlay);
      mediaElement.removeEventListener('pause', handlePause);
      mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
      mediaElement.removeEventListener('durationchange', handleDurationChange);
      mediaElement.removeEventListener('ratechange', handleRateChange);
      mediaElement.removeEventListener('error', handleError);
    };
  });

  // Load manifest on mount
  onMount(async () => {
    await loadManifest();
  });

  // Cleanup on unmount
  $effect(() => {
    return () => {
      if (mediaElement) {
        mediaElement.pause();
        mediaElement.src = '';
      }
    };
  });
</script>

<div class="iiif-player-root {className}">
  {#if state.error}
    <div role="alert" class="error">
      <strong>Error:</strong> {state.error.message}
    </div>
  {/if}

  {#if children}
    {@render children({ player: { state, actions } })}
  {/if}
</div>
```

**Step 2: Write tests for Root component**

Create: `src/lib/player/Root.test.ts`

Adapt from `src/lib/components/MediaPlayer.test.ts` and `src/lib/components/IIIFMediaViewer.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import Root from './Root.svelte';

describe('Root component', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  test('loads manifest and provides context', async () => {
    const mockManifest = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.com/manifest',
      type: 'Manifest',
      items: [{
        id: 'canvas1',
        type: 'Canvas',
        items: [{
          id: 'page1',
          type: 'AnnotationPage',
          items: [{
            id: 'annotation1',
            type: 'Annotation',
            motivation: 'painting',
            body: {
              id: 'https://example.com/audio.mp3',
              type: 'Sound',
              format: 'audio/mp3'
            },
            target: 'canvas1'
          }]
        }]
      }]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockManifest
    });

    const { container } = render(Root, {
      props: { manifestUrl: 'https://example.com/manifest.json' }
    });

    await waitFor(() => {
      expect(container.querySelector('audio, video')).toBeTruthy();
    });
  });

  test('handles manifest fetch errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const { container } = render(Root, {
      props: { manifestUrl: 'https://example.com/missing.json' }
    });

    await waitFor(() => {
      const error = container.querySelector('[role="alert"]');
      expect(error).toBeTruthy();
      expect(error?.textContent).toContain('404');
    });
  });
});
```

**Step 3: Run tests**

```bash
pnpm test src/lib/player/Root.test.ts
```

Expected: Tests pass

**Step 4: Commit Root component**

```bash
git add src/lib/player/Root.svelte src/lib/player/Root.test.ts
git commit -m "feat(player): implement Root context provider (LDA-1983)

- Loads IIIF manifest and extracts media URL
- Creates reactive $state for player state
- Provides context to children
- Sets up media event listeners
- Handles errors and retry

Part 2/13 of compound component refactor"
```

---

### Task 1.3: Implement Viewer Component

**Files:**
- Create: `src/lib/player/Viewer.svelte`
- Create: `src/lib/player/Viewer.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { setContext } from 'svelte';
import Viewer from './Viewer.svelte';
import { createMockPlayerContext, PLAYER_CONTEXT_KEY } from './test-utils';

describe('Viewer', () => {
  test('renders audio element when mediaType is audio', () => {
    const ctx = createMockPlayerContext();
    setContext(PLAYER_CONTEXT_KEY, ctx);

    const { container } = render(Viewer);

    expect(container.querySelector('audio')).toBeTruthy();
  });

  test('throws error when no context available', () => {
    expect(() => render(Viewer)).toThrow('Player context not found');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/player/Viewer.test.ts
```

Expected: FAIL (Viewer.svelte doesn't exist)

**Step 3: Implement Viewer component**

```svelte
<!-- src/lib/player/Viewer.svelte -->
<script lang="ts">
  import { getPlayerContext } from './context';

  let {
    controls = true,
    crossOrigin = 'anonymous',
    class: className = ''
  }: {
    controls?: boolean;
    crossOrigin?: 'anonymous' | 'use-credentials';
    class?: string;
  } = $props();

  const { state, mediaElement: mediaElementFromContext } = getPlayerContext();

  let element: HTMLMediaElement | null = $state(null);

  // Update context when element binds
  $effect(() => {
    if (element) {
      // Type assertion needed because context mediaElement is writable
      (mediaElementFromContext as any) = element;
    }
  });
</script>

{#if mediaType === 'audio'}
  <audio
    bind:this={element}
    src={mediaUrl}
    {controls}
    crossorigin={crossOrigin}
    class={className}
  />
{:else if mediaType === 'video'}
  <video
    bind:this={element}
    src={mediaUrl}
    {controls}
    crossorigin={crossOrigin}
    class={className}
  />
{/if}
```

**Wait - this won't work. Viewer needs mediaUrl and mediaType from Root context. Let me revise the architecture.**

Actually, looking at the design, Viewer should get mediaUrl/mediaType from Root's context too. Let me update context.ts first:

**Step 3a: Update context to include mediaUrl and mediaType**

Modify: `src/lib/player/context.ts`

```typescript
export interface PlayerContext {
  state: PlayerState;
  mediaElement: HTMLMediaElement | null;
  mediaUrl: string;
  mediaType: 'audio' | 'video';
  actions: PlayerActions;
}
```

**Step 3b: Update Root to provide mediaUrl/mediaType in context**

Modify: `src/lib/player/Root.svelte` (in setContext call):

```typescript
setContext(PLAYER_CONTEXT_KEY, {
  state,
  mediaElement,
  mediaUrl,
  mediaType,
  actions
} satisfies PlayerContext);
```

**Step 3c: Now implement Viewer correctly**

```svelte
<!-- src/lib/player/Viewer.svelte -->
<script lang="ts">
  import { getPlayerContext } from './context';

  let {
    controls = true,
    crossOrigin = 'anonymous',
    class: className = ''
  }: {
    controls?: boolean;
    crossOrigin?: 'anonymous' | 'use-credentials';
    class?: string;
  } = $props();

  const context = getPlayerContext();
  const { mediaUrl, mediaType } = context;

  let element: HTMLMediaElement | null = $state(null);

  // Update context when element binds
  $effect(() => {
    context.mediaElement = element;
  });
</script>

{#if mediaType === 'audio'}
  <audio
    bind:this={element}
    src={mediaUrl}
    {controls}
    crossorigin={crossOrigin}
    class={className}
  />
{:else if mediaType === 'video'}
  <video
    bind:this={element}
    src={mediaUrl}
    {controls}
    crossorigin={crossOrigin}
    class={className}
  />
{/if}
```

**Step 4: Run tests**

```bash
pnpm test src/lib/player/Viewer.test.ts
```

Expected: Tests pass

**Step 5: Commit Viewer component**

```bash
git add src/lib/player/Viewer.svelte src/lib/player/Viewer.test.ts src/lib/player/context.ts src/lib/player/Root.svelte
git commit -m "feat(player): implement Viewer component (LDA-1983)

- Renders <audio> or <video> based on mediaType from context
- Binds element ref back to context for actions
- Accepts controls, crossOrigin, class props

Part 3/13 of compound component refactor"
```

---

## Phase 2: Control Components (3 pts)

### Task 2.1: Implement PlayButton Component

**Files:**
- Create: `src/lib/player/PlayButton.svelte`
- Create: `src/lib/player/PlayButton.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, test, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { setContext } from 'svelte';
import PlayButton from './PlayButton.svelte';
import { createMockPlayerContext, PLAYER_CONTEXT_KEY } from './test-utils';

describe('PlayButton', () => {
  test('shows "Play" when paused', () => {
    const ctx = createMockPlayerContext({ state: { isPlaying: false } });
    setContext(PLAYER_CONTEXT_KEY, ctx);

    const { container } = render(PlayButton);
    const button = container.querySelector('button');

    expect(button?.textContent).toContain('Play');
  });

  test('shows "Pause" when playing', () => {
    const ctx = createMockPlayerContext({ state: { isPlaying: true } });
    setContext(PLAYER_CONTEXT_KEY, ctx);

    const { container } = render(PlayButton);
    const button = container.querySelector('button');

    expect(button?.textContent).toContain('Pause');
  });

  test('calls play action when clicked while paused', async () => {
    const playFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { isPlaying: false },
      actions: { play: playFn }
    });
    setContext(PLAYER_CONTEXT_KEY, ctx);

    const { container } = render(PlayButton);
    const button = container.querySelector('button')!;

    await fireEvent.click(button);

    expect(playFn).toHaveBeenCalled();
  });

  test('calls pause action when clicked while playing', async () => {
    const pauseFn = vi.fn();
    const ctx = createMockPlayerContext({
      state: { isPlaying: true },
      actions: { pause: pauseFn }
    });
    setContext(PLAYER_CONTEXT_KEY, ctx);

    const { container } = render(PlayButton);
    const button = container.querySelector('button')!;

    await fireEvent.click(button);

    expect(pauseFn).toHaveBeenCalled();
  });

  test('is disabled when media not ready', () => {
    const ctx = createMockPlayerContext({ state: { isReady: false } });
    setContext(PLAYER_CONTEXT_KEY, ctx);

    const { container } = render(PlayButton);
    const button = container.querySelector('button');

    expect(button?.disabled).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/player/PlayButton.test.ts
```

Expected: FAIL (PlayButton.svelte doesn't exist)

**Step 3: Implement PlayButton component**

```svelte
<!-- src/lib/player/PlayButton.svelte -->
<script lang="ts">
  import { getPlayerContext } from './context';

  let {
    class: className = ''
  }: {
    class?: string;
  } = $props();

  const { state, actions } = getPlayerContext();

  function handleClick() {
    if (state.isPlaying) {
      actions.pause();
    } else {
      actions.play();
    }
  }
</script>

<button
  type="button"
  data-audio-button="play-pause"
  disabled={!state.isReady}
  onclick={handleClick}
  class={className}
>
  {state.isPlaying ? 'Pause' : 'Play'}
</button>

<style>
  button {
    all: unset;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
</style>
```

**Step 4: Run tests**

```bash
pnpm test src/lib/player/PlayButton.test.ts
```

Expected: All tests pass

**Step 5: Commit PlayButton**

```bash
git add src/lib/player/PlayButton.svelte src/lib/player/PlayButton.test.ts
git commit -m "feat(player): implement PlayButton component (LDA-1983)

- Toggles play/pause via context actions
- Shows correct label based on state.isPlaying
- Disabled when media not ready
- Unstyled with data-audio-button attribute

Part 4/13 of compound component refactor"
```

---

### Task 2.2: Implement Progress Component

**Files:**
- Create: `src/lib/player/Progress.svelte`
- Create: `src/lib/player/Progress.test.ts`

**Step 1: Write tests** (following same pattern as PlayButton)

**Step 2: Implement Progress component**

```svelte
<!-- src/lib/player/Progress.svelte -->
<script lang="ts">
  import { getPlayerContext } from './context';

  let {
    class: className = ''
  }: {
    class?: string;
  } = $props();

  const { state, actions } = getPlayerContext();

  function handleClick(event: MouseEvent) {
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * state.duration;
    actions.seekTo(seekTime);
  }

  function handleKeydown(event: KeyboardEvent) {
    const step = 5; // 5 second steps

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        actions.seekTo(state.currentTime - step);
        break;
      case 'ArrowRight':
        event.preventDefault();
        actions.seekTo(state.currentTime + step);
        break;
      case 'Home':
        event.preventDefault();
        actions.seekTo(0);
        break;
      case 'End':
        event.preventDefault();
        actions.seekTo(state.duration);
        break;
    }
  }

  const progressPercentage = $derived(
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
  );
</script>

<div
  data-audio-progress-track
  role="slider"
  tabindex="0"
  aria-label="Seek"
  aria-valuemin={0}
  aria-valuemax={state.duration}
  aria-valuenow={state.currentTime}
  onclick={handleClick}
  onkeydown={handleKeydown}
  class={className}
>
  <div
    data-audio-progress-fill
    style="width: {progressPercentage}%"
  />
</div>

<style>
  [data-audio-progress-track] {
    all: unset;
    display: block;
    cursor: pointer;
    position: relative;
  }

  [data-audio-progress-track]:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
</style>
```

**Step 3: Commit Progress**

```bash
git add src/lib/player/Progress.svelte src/lib/player/Progress.test.ts
git commit -m "feat(player): implement Progress component (LDA-1983)

- Seekable progress bar with click and keyboard
- Reads currentTime/duration from context
- Calls actions.seekTo on interaction
- Unstyled with data attributes

Part 5/13 of compound component refactor"
```

---

### Task 2.3: Implement Skip, Speed, Time Components

**Files:**
- Create: `src/lib/player/Skip.svelte` + test
- Create: `src/lib/player/Speed.svelte` + test
- Create: `src/lib/player/Time.svelte` + test
- Create: `src/lib/player/Controls.svelte` (layout container)

**Follow same TDD pattern as above for each component**

**Skip.svelte** - Accepts `seconds` prop, calls `actions.seekTo(currentTime + seconds)`

**Speed.svelte** - Dropdown with `rates` prop, calls `actions.setPlaybackRate(rate)`

**Time.svelte** - Displays formatted currentTime / duration

**Controls.svelte** - Simple layout container with data-audio-controls attribute

**Commit after all three are done:**

```bash
git add src/lib/player/{Skip,Speed,Time,Controls}.svelte src/lib/player/{Skip,Speed,Time}.test.ts
git commit -m "feat(player): implement Skip/Speed/Time/Controls (LDA-1983)

- Skip: forward/backward by seconds prop
- Speed: playback rate picker with dropdown
- Time: formatted time display
- Controls: layout container

Part 6/13 of compound component refactor"
```

---

## Phase 3: Transcript Refactor (3 pts)

### Task 3.1: Adapt Transcript Component

**Files:**
- Create: `src/lib/player/Transcript.svelte`
- Reference: `src/lib/transcript/Panel.svelte` (adapt logic)
- Reuse: `src/lib/sync/SyncController.svelte` (no changes)

**Strategy**: Copy Panel.svelte logic, but get player state from parent context instead of props.

**Step 1: Create Transcript component skeleton**

```svelte
<!-- src/lib/player/Transcript.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { getPlayerContext } from './context';
  import { SyncController } from '../sync/SyncController.svelte';
  import type { Annotation } from '../sync/types';

  let {
    annotations = [],
    enableSearch = false,
    syncDebounceMs = 150,
    syncSettleMs = 100,
    syncPriorityLockDuration = 1000,
    class: className = '',
    children
  }: {
    annotations?: Annotation[];
    enableSearch?: boolean;
    syncDebounceMs?: number;
    syncSettleMs?: number;
    syncPriorityLockDuration?: number;
    class?: string;
    children?: any;
  } = $props();

  const playerContext = getPlayerContext();
  const { state, mediaElement, actions } = playerContext;

  let scrollContainer: HTMLElement | null = $state(null);
  let syncController: SyncController | null = $state(null);

  // Rest of Panel.svelte logic adapted...
  // (Full implementation would be lengthy, follow Panel.svelte patterns)
</script>

<div class="transcript {className}">
  {#if children}
    {@render children()}
  {/if}
</div>
```

**Step 2: Port tests from Panel.test.ts**

**Step 3: Commit Transcript component**

```bash
git add src/lib/player/Transcript.svelte src/lib/player/Transcript.test.ts
git commit -m "feat(player): implement Transcript component (LDA-1983)

- Adapts Panel.svelte logic to use player context
- Reuses SyncController for scroll sync
- Gets mediaElement/currentTime from context
- Calls actions.seekTo on segment click

Part 7/13 of compound component refactor"
```

---

### Task 3.2: Implement TranscriptSearch and TranscriptSegments

**Files:**
- Create: `src/lib/player/TranscriptSearch.svelte`
- Create: `src/lib/player/TranscriptSegments.svelte`
- Reference: `src/lib/transcript/Search.svelte` (adapt)

**Follow same TDD pattern**

**Commit:**

```bash
git add src/lib/player/TranscriptSearch.svelte src/lib/player/TranscriptSegments.svelte
git commit -m "feat(player): implement TranscriptSearch/Segments (LDA-1983)

- TranscriptSearch: search input with match navigation
- TranscriptSegments: scrollable segment list
- Both consume Transcript context

Part 8/13 of compound component refactor"
```

---

## Phase 4: Export and Documentation (2 pts)

### Task 4.1: Create Namespace Export

**Files:**
- Create: `src/lib/player/index.ts`
- Modify: `src/lib/index.ts`

**Step 1: Create player index**

```typescript
// src/lib/player/index.ts
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

export const IIIFPlayer = {
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
  TranscriptSegments
};

export type { PlayerContext, PlayerState, PlayerActions } from './context';
```

**Step 2: Update main index**

```typescript
// src/lib/index.ts
// New compound component API
export { IIIFPlayer } from './player/index';
export type { PlayerContext, PlayerState, PlayerActions } from './player/context';

// Types
export type { Annotation } from './sync/types';

// Utilities
export { formatTimestamp, mergeIntoParagraphs } from './transcript/utils';
```

**Step 3: Commit exports**

```bash
git add src/lib/player/index.ts src/lib/index.ts
git commit -m "feat(player): add namespace exports (LDA-1983)

- IIIFPlayer.Root, IIIFPlayer.Viewer, etc.
- Export types: PlayerContext, PlayerState, PlayerActions
- Update main index.ts

Part 9/13 of compound component refactor"
```

---

### Task 4.2: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/src/pages/index.astro`
- Create: `COMPOUND_COMPONENTS.md`
- Delete: `TRANSCRIPT_COMPONENTS.md`

**Step 1: Update README Basic Usage**

Replace old example with:

```svelte
<script>
  import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

  const annotations = [/* ... */];
</script>

<IIIFPlayer.Root
  manifestUrl="https://iiif.io/.../manifest.json"
  {annotations}
>
  <IIIFPlayer.Viewer />

  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
    <IIIFPlayer.Skip seconds={-10} />
    <IIIFPlayer.Skip seconds={30} />
    <IIIFPlayer.Speed />
  </IIIFPlayer.Controls>

  <IIIFPlayer.Transcript>
    <IIIFPlayer.TranscriptSearch />
    <IIIFPlayer.TranscriptSegments />
  </IIIFPlayer.Transcript>
</IIIFPlayer.Root>
```

**Step 2: Create COMPOUND_COMPONENTS.md**

Copy structure from TRANSCRIPT_COMPONENTS.md, update with new API.

**Step 3: Update docs site**

Modify `docs/src/pages/index.astro` "Basic Usage" section with new example.

**Step 4: Update demo component**

Modify `docs/src/components/IIIFTranscriptDemo.svelte` to use new API.

**Step 5: Commit documentation**

```bash
git add README.md COMPOUND_COMPONENTS.md docs/src/pages/index.astro docs/src/components/IIIFTranscriptDemo.svelte
git rm TRANSCRIPT_COMPONENTS.md
git commit -m "docs(player): update for compound components (LDA-1983)

- Update README.md Basic Usage
- Create COMPOUND_COMPONENTS.md reference
- Update docs site with new API
- Update demo component
- Remove TRANSCRIPT_COMPONENTS.md

Part 10/13 of compound component refactor"
```

---

## Phase 5: Cleanup and Migration (2 pts)

### Task 5.1: Delete Old Components

**Files:**
- Delete: `src/lib/components/IIIFMediaViewer.svelte` + test
- Delete: `src/lib/components/MediaPlayer.svelte` + test
- Delete: `src/lib/components/AudioPlayerControls.svelte` + test
- Delete: `src/lib/transcript/Panel.svelte` + test
- Delete: `src/lib/transcript/Segment.svelte`
- Delete: `src/lib/transcript/Search.svelte` + test

**Step 1: Verify all tests still pass**

```bash
pnpm test
```

Expected: All tests pass (old component tests deleted, new tests cover behavior)

**Step 2: Delete old files**

```bash
git rm src/lib/components/{IIIFMediaViewer,MediaPlayer,AudioPlayerControls}.svelte
git rm src/lib/components/{IIIFMediaViewer,MediaPlayer,AudioPlayerControls}.svelte.test.ts
git rm src/lib/transcript/{Panel,Segment,Search}.svelte
git rm src/lib/transcript/{Panel,Search}.svelte.test.ts
git commit -m "refactor(player): remove old component architecture (LDA-1983)

Deleted components replaced by compound architecture:
- IIIFMediaViewer → IIIFPlayer.Root + IIIFPlayer.Viewer
- MediaPlayer → absorbed into Root
- AudioPlayerControls → IIIFPlayer.PlayButton/Progress/etc
- Panel/Search/Segment → IIIFPlayer.Transcript/Search/Segments

Part 11/13 of compound component refactor"
```

---

### Task 5.2: Update Build and Package Exports

**Files:**
- Modify: `package.json` (if needed for exports)
- Run: `pnpm run build`
- Run: `pnpm run check`

**Step 1: Build package**

```bash
pnpm run build
```

Expected: Build succeeds, new exports available

**Step 2: Run type checking**

```bash
pnpm run check
```

Expected: No TypeScript errors

**Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass

**Step 4: Commit build verification**

```bash
git add package.json # if modified
git commit -m "build(player): verify compound components build (LDA-1983)

- Package builds successfully
- Type checking passes
- All tests passing

Part 12/13 of compound component refactor"
```

---

### Task 5.3: Create Astro Example (LDA-1984)

**Files:**
- Create: `docs/src/pages/astro-example.astro` (or update existing)

**Step 1: Add Astro integration example**

````astro
---
import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

const manifestUrl = 'https://iiif.io/api/cookbook/recipe/0219-using-caption-file/manifest.json';

// Parse VTT server-side (example)
const vttUrl = 'https://fixtures.iiif.io/video/indiana/lunchroom_manners/lunchroom_manners.vtt';
const vttResponse = await fetch(vttUrl);
const vttText = await vttResponse.text();
// ... simple VTT parsing (or use media-captions library)
const annotations = parseVTT(vttText); // pseudo-code
---

<IIIFPlayer.Root client:load {manifestUrl} {annotations}>
  <IIIFPlayer.Viewer />

  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
    <IIIFPlayer.Skip seconds={-10} />
    <IIIFPlayer.Skip seconds={30} />
  </IIIFPlayer.Controls>

  <IIIFPlayer.Transcript>
    <IIIFPlayer.TranscriptSearch />
    <IIIFPlayer.TranscriptSegments />
  </IIIFPlayer.Transcript>
</IIIFPlayer.Root>

<style>
  /* Tailwind or custom styles */
</style>
````

**Step 2: Update docs site navigation**

Add link to Astro example page.

**Step 3: Commit Astro example**

```bash
git add docs/src/pages/astro-example.astro
git commit -m "docs(astro): add Astro islands integration example (LDA-1984)

- Shows client:load directive usage
- Server-side VTT parsing
- All components in single island
- Solves LDA-1984

Part 13/13 of compound component refactor"
```

---

## Final Verification

### Step 1: Run full test suite

```bash
pnpm test
pnpm run check
pnpm run build
```

Expected: All green

### Step 2: Manual testing in docs site

```bash
cd docs
pnpm run dev
```

Visit http://localhost:4321 and verify:
- [ ] Demo works with new API
- [ ] Play/pause button updates correctly
- [ ] Progress bar seeks correctly
- [ ] Transcript sync works
- [ ] Search highlights correctly
- [ ] No console errors

### Step 3: Final commit

```bash
git add -A
git commit -m "feat(player): complete compound component refactor (LDA-1983)

Comprehensive refactor to Melt UI-style compound components:
- Context-driven architecture with Svelte 5 $state
- IIIFPlayer.* namespace (Root, Viewer, Controls, etc)
- Solves play/pause footgun (automatic reactivity)
- Astro island compatible
- Documentation updated
- Old components removed

Closes LDA-1983
Closes LDA-1984

Story points: 13
- Root + context: 3pts ✅
- Control components: 3pts ✅
- Transcript refactor: 3pts ✅
- Documentation: 2pts ✅
- Cleanup: 2pts ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Notes for Implementation

### Key Design Decisions

1. **`$state` over stores**: Simpler, more efficient, modern Svelte 5 idiom
2. **Context for all state**: Eliminates prop drilling, matches Melt UI pattern
3. **Delete old components**: No users exist yet, breaking change is fine
4. **Reuse SyncController**: No changes needed, works with new architecture

### Testing Strategy

- **Unit tests**: Context helpers, utility functions
- **Component tests**: Mock context with `createMockPlayerContext()`
- **Integration tests**: Adapt existing tests to new API
- **Manual testing**: Use docs site dev server

### Common Pitfalls

- **Context reactivity**: Make sure to assign to context properties, not replace context object
- **Effect dependencies**: Use `$derived` for computed values, `$effect` only for side effects
- **Cleanup**: Always return cleanup function from `$effect` for event listeners
- **Test isolation**: Use `setContext` in tests, don't rely on global state

### References

- Design doc: `docs/plans/2026-02-26-compound-components-design.md`
- Melt UI: https://melt-ui.com/ (pattern reference)
- Bits UI: https://bits-ui.com/ (Svelte compound components)
- Svelte 5 runes docs: https://svelte.dev/docs/svelte/$state
