# Compound Component Architecture Design

**Date**: 2026-02-26
**Status**: Approved
**Related Tickets**: LDA-1983, LDA-1984
**Story Points**: 13

## Problem Statement

During demo site development (LDA-1970/LDA-1971), we discovered fundamental API design issues:

1. **Broken "obvious" usage**: `<AudioPlayerControls playerRef={viewer} />` doesn't work (play/pause button never updates)
2. **Documentation actively misleads**: "Basic Usage" example teaches a pattern that results in non-functional controls
3. **Verbose boilerplate required**: Working pattern requires ~20 lines of manual callback wiring between IIIFMediaViewer and AudioPlayerControls

**Root cause**: AudioPlayerControls tries to derive state from `playerRef` methods (`isPlaying()`, `getPlaybackSpeed()`) but these methods don't exist on MediaPlayer, and even if they did, calling a method doesn't create reactive subscriptions to media events.

## Design Goals

1. **Library Philosophy** (Priority 1): Match Melt UI / Bits UI compound component patterns
2. **Architectural Purity** (Priority 2): Use Svelte's idiomatic patterns (context over prop drilling)
3. **Developer Experience** (Priority 3): Minimal boilerplate, "just works"
4. **Astro Compatibility**: Must work in Astro islands (serializable props, internal state)

## Solution: Context-Driven Compound Components

### Architecture Overview

**Melt UI-style compound components** with state managed via Svelte 5 `$state` and `setContext`/`getContext`.

**Component hierarchy**:
```
IIIFPlayer.Root                    # Context provider, manifest loader
├── IIIFPlayer.Viewer              # <video>/<audio> renderer
├── IIIFPlayer.Controls            # Layout container
│   ├── IIIFPlayer.PlayButton      # Play/pause toggle
│   ├── IIIFPlayer.Progress        # Seekable progress bar
│   ├── IIIFPlayer.Skip            # Skip forward/backward
│   ├── IIIFPlayer.Speed           # Playback rate picker
│   └── IIIFPlayer.Time            # Time display
└── IIIFPlayer.Transcript          # Sync controller
    ├── IIIFPlayer.TranscriptSearch
    └── IIIFPlayer.TranscriptSegments
```

**Context shape** (Svelte 5 `$state`):
```typescript
interface PlayerContext {
  state: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    playbackRate: number;
    isReady: boolean;
    error: Error | null;
  };

  mediaElement: HTMLMediaElement | null;

  actions: {
    play: () => Promise<void>;
    pause: () => void;
    seekTo: (time: number) => void;
    setPlaybackRate: (rate: number) => void;
    retry: () => Promise<void>;
  };
}
```

**Key design decision**: Use Svelte 5 `$state` (not stores) for reactive state passed through context. Simpler, more efficient, modern idiom.

---

## Component Responsibilities

### Root Component

**Responsibilities**:
- Load and validate IIIF manifest
- Create HTML media element
- Set up event listeners (play, pause, timeupdate, durationchange, error)
- Update `$state` objects from media events
- Provide context via `setContext()`
- Handle cleanup on unmount

**Props**:
```typescript
{
  manifestUrl: string;           // Required
  canvasIndex?: number;          // Default: 0
  annotations?: Annotation[];    // For transcript
  initialTime?: number;          // Seek on mount
  autoplay?: boolean;            // Default: false
  class?: string;                // Wrapper styling
}
```

**Snippet**:
```svelte
{#snippet children({ player })}
  <!-- Optional: expose imperative API for pure Svelte apps -->
{/snippet}
```

---

### Viewer Component

**Responsibilities**:
- Render `<video>` or `<audio>` element
- Get media URL and type from context
- Bind element ref back to context

**Props**:
```typescript
{
  controls?: boolean;      // Default: true
  crossOrigin?: string;    // Default: 'anonymous'
  class?: string;
}
```

**Design rationale**: Viewer is "dumb" - just renders the element. Root handles all logic.

---

### Control Components

**Shared pattern**: All read from context, call context actions. Zero props needed (unless overriding defaults).

**PlayButton**:
```typescript
Props: { class?: string }
Reads: state.isPlaying
Calls: actions.play() / actions.pause()
```

**Progress**:
```typescript
Props: { class?: string }
Reads: state.currentTime, state.duration
Calls: actions.seekTo(time)
```

**Skip**:
```typescript
Props: {
  seconds: number;      // Required: -10, 30, etc
  class?: string;
}
Reads: state.currentTime, state.duration
Calls: actions.seekTo(currentTime + seconds)
```

**Speed**:
```typescript
Props: {
  rates?: number[];     // Default: [0.5, 0.75, 1, 1.25, 1.5, 2]
  class?: string;
}
Reads: state.playbackRate
Calls: actions.setPlaybackRate(rate)
```

**Time**:
```typescript
Props: {
  format?: 'hh:mm:ss' | 'mm:ss';
  class?: string;
}
Reads: state.currentTime, state.duration
```

---

### Transcript Components

**IIIFPlayer.Transcript** - Sync controller
```typescript
Props: {
  annotations?: Annotation[];    // From Root or override
  enableSearch?: boolean;         // Default: false
  syncDebounceMs?: number;        // Default: 150
  class?: string;
}
Reads: state.currentTime, mediaElement
Calls: actions.seekTo() on segment click
```

**IIIFPlayer.TranscriptSearch**:
```typescript
Props: {
  placeholder?: string;
  class?: string;
}
Reads: annotations from Transcript context
Updates: Transcript's search state
```

**IIIFPlayer.TranscriptSegments**:
```typescript
Props: { class?: string }
Snippet: {#snippet segment({ annotation, isActive, onClick })}
Reads: annotations, activeAnnotationId from Transcript context
```

**Design decision**: Transcript creates its own sub-context for search/sync state. Keeps player context clean.

---

## Data Flow & Lifecycle

### Initialization

1. **Root mounts**:
   - Create `$state` objects (state, mediaElement)
   - Create actions object
   - `setContext('iiif-player', { state, mediaElement, actions })`
   - Fetch + validate IIIF manifest
   - Extract media URL, type, dimensions

2. **Viewer mounts**:
   - `getContext('iiif-player')`
   - Render `<video>` or `<audio>`
   - `bind:this={element}`
   - `$effect`: Update `context.mediaElement = element`

3. **Root sets up listeners** (once mediaElement available):
```typescript
$effect(() => {
  if (!mediaElement) return;

  mediaElement.addEventListener('play', () => state.isPlaying = true);
  mediaElement.addEventListener('pause', () => state.isPlaying = false);
  mediaElement.addEventListener('timeupdate', (e) => {
    state.currentTime = e.target.currentTime;
  });
  mediaElement.addEventListener('durationchange', (e) => {
    state.duration = e.target.duration;
    state.isReady = true;
  });

  return () => { /* cleanup */ };
});
```

4. **Control components mount**:
   - `getContext('iiif-player')`
   - Render UI based on reactive state
   - Call actions on interaction
   - Automatically re-render when state changes

### Update Flow Example

```
User clicks PlayButton
  → onclick={() => actions.play()}
  → mediaElement.play()
  → 'play' event fires
  → Listener updates state.isPlaying = true
  → All components reading state.isPlaying re-render
```

**Key pattern**: One-way data flow through native media events. No manual synchronization.

---

## Error Handling

### Error Categories

1. **Manifest Loading Errors**:
   - Network failures (fetch fails)
   - Invalid JSON
   - Zod validation failures

2. **Media Loading Errors**:
   - Media file not found (404)
   - Unsupported format
   - CORS issues

3. **User Action Errors** (defensive):
   - Seek before media ready
   - Invalid seek time

### Error Display Strategy

**Option B (chosen)**: Default error UI with snippet override.

```svelte
<!-- Root.svelte -->
{#if state.error}
  {#if errorSnippet}
    {@render errorSnippet(state.error, actions)}
  {:else}
    <div role="alert">{state.error.message}</div>
  {/if}
{/if}
```

**Rationale**: Matches "unstyled primitives" philosophy - provide structure, allow customization.

### Error Recovery

```typescript
actions: {
  retry: async () => {
    state.error = null;
    await loadManifest();
  }
}
```

User can add retry UI via error snippet.

---

## File Structure

```
src/lib/
├── player/                          # New compound component system
│   ├── Root.svelte
│   ├── Viewer.svelte
│   ├── Controls.svelte
│   ├── PlayButton.svelte
│   ├── Progress.svelte
│   ├── Skip.svelte
│   ├── Speed.svelte
│   ├── Time.svelte
│   ├── Transcript.svelte
│   ├── TranscriptSearch.svelte
│   ├── TranscriptSegments.svelte
│   ├── context.ts                   # Type definitions + helpers
│   └── index.ts                     # Re-exports
│
├── components/                      # DELETE after migration
│   ├── IIIFMediaViewer.svelte
│   ├── MediaPlayer.svelte
│   └── AudioPlayerControls.svelte
│
├── transcript/                      # DELETE after migration
│   ├── Panel.svelte
│   ├── Segment.svelte
│   └── Search.svelte
│
├── sync/                            # KEEP (reused)
│   ├── SyncController.svelte
│   ├── annotationUtils.ts
│   └── types.ts
│
└── iiif/                            # KEEP (reused)
    ├── helpers.ts
    └── validators.ts
```

### Export Strategy

**Main entry** (`src/lib/index.ts`):
```typescript
import Root from './player/Root.svelte';
import Viewer from './player/Viewer.svelte';
// ... all player components

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

export type {
  Annotation,
  PlayerContext,
  PlayerState,
  PlayerActions
} from './player/context';

export {
  formatTimestamp,
  mergeIntoParagraphs
} from './transcript/utils';
```

**Usage**:
```svelte
import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';
```

### Context Helper (`player/context.ts`)

```typescript
export const PLAYER_CONTEXT_KEY = 'iiif-player';

export function getPlayerContext(): PlayerContext {
  const ctx = getContext<PlayerContext>(PLAYER_CONTEXT_KEY);
  if (!ctx) {
    throw new Error(
      'Player context not found. Component must be child of IIIFPlayer.Root'
    );
  }
  return ctx;
}
```

---

## Testing Strategy

### Reuse Existing Test Patterns

**Adapt existing tests**:
- `MediaPlayer.test.ts` → `Root.test.ts` (seekTo guards, state management)
- `Panel.test.ts` → `Transcript.test.ts` (sync initialization, callbacks)
- `SyncController.test.ts` → Keep as-is (unit tests still valid)
- Integration tests → Adapt for new component API

**Test utilities**:
```typescript
// player/test-utils.ts
export function createMockPlayerContext(overrides = {}) {
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
    }
  };
}
```

### Test Coverage

- **Unit tests**: 100% for context helpers, utility functions
- **Component tests**: 80%+ for UI components (interaction logic)
- **Integration tests**: Key workflows (load, play, seek, transcript sync)

**No phantom testing**: Follow existing test patterns that verify actual behavior.

---

## Documentation Updates

### README.md

Replace "Basic Usage" with:
```svelte
<script>
  import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

  const annotations = [
    { id: 'seg-1', startTime: 0, endTime: 5, text: 'Hello world' }
  ];
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

### docs/src/pages/index.astro

- Update `<IIIFTranscriptDemo>` internals
- Replace "Basic Usage" code block
- Add Astro-specific example (LDA-1984)

### TRANSCRIPT_COMPONENTS.md → COMPOUND_COMPONENTS.md

- Document new architecture (context-driven)
- Component reference (all IIIFPlayer.* components)
- Styling guide (data attributes unchanged)
- Advanced usage (custom error UI, snippets)

---

## Astro Island Compatibility

**Key constraints**:
1. All compound components must hydrate together (same island)
2. No function props across `.astro` → `.svelte` boundary
3. Multiple instances on page must be isolated

**Usage in Astro**:
```astro
---
import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';
const manifestUrl = '...';
const annotations = await parseVTT('./captions.vtt'); // Server-side
---

<IIIFPlayer.Root client:load {manifestUrl} {annotations}>
  <IIIFPlayer.Viewer />
  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
  </IIIFPlayer.Controls>
  <IIIFPlayer.Transcript>
    <IIIFPlayer.TranscriptSearch />
    <IIIFPlayer.TranscriptSegments />
  </IIIFPlayer.Transcript>
</IIIFPlayer.Root>
```

**Design decision**: Root accepts **serializable props only** (string, number, JSON). All callbacks/methods stay internal to the island via context.

---

## Migration Path

**Good news**: No users exist yet. We can:
1. Delete old components entirely
2. Update all docs/examples to new API
3. Ship as breaking change (v0.1.0 or v1.0.0)

**No migration guide needed** - just document the new API clearly.

---

## Implementation Scope

**Story Points: 13**

**Breakdown**:
1. Root + context setup (3 pts)
   - Create context.ts (types, helpers)
   - Implement Root.svelte (manifest loading, event listeners, context provider)
   - Write tests

2. Control components (3 pts)
   - Implement PlayButton, Progress, Skip, Speed, Time
   - All consume context, minimal logic
   - Write component tests

3. Transcript refactor (3 pts)
   - Adapt Panel.svelte → Transcript.svelte
   - Adapt Search.svelte → TranscriptSearch.svelte
   - Adapt segment rendering → TranscriptSegments.svelte
   - Reuse SyncController (no changes needed)
   - Write tests

4. Documentation updates (2 pts)
   - Update README.md, COMPOUND_COMPONENTS.md
   - Update docs site (index.astro, demo component)
   - Create Astro example (LDA-1984)

5. Test adaptation (2 pts)
   - Port MediaPlayer.test.ts → Root.test.ts
   - Port Panel.test.ts → Transcript.test.ts
   - Adapt integration tests
   - Create test-utils.ts

---

## Success Criteria

- [ ] User can copy "Basic Usage" example and play/pause works
- [ ] Example requires <10 lines of code (no manual callback wiring)
- [ ] Pattern works in both pure Svelte and Astro islands
- [ ] All existing tests pass (adapted to new API)
- [ ] Documentation shows new API exclusively (old components deleted)

---

## Risks & Mitigations

**Risk**: Context "magic" less explicit than props
**Mitigation**: Clear error messages when components used outside Root, good documentation

**Risk**: Testing with context more complex
**Mitigation**: Provide `createMockPlayerContext()` utility, follow existing test patterns

**Risk**: Breaking change (deleting old components)
**Mitigation**: No users yet, can ship as breaking. Document clearly in changelog.

---

## References

- LDA-1983: API design issues discovered during demo/docs development
- LDA-1984: Add Astro islands integration example (blocked until this is done)
- Melt UI: https://melt-ui.com/ (reference for compound component pattern)
- Bits UI: https://bits-ui.com/ (reference for Svelte compound components)
