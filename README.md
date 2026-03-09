# @umd-mith/svelte-iiif-transcript-player

> IIIF-powered, transcript-synchronized media player for Svelte 5.

**Status:** Early development (v0.6.0). API not stable.

## Install

### From GitHub Packages

This package is published to [GitHub Packages](https://github.com/umd-mith/svelte-iiif-transcript-player/pkgs/npm/svelte-iiif-transcript-player), not npm. Its dependency `@umd-mith/iiif-media-parsers` _is_ on npm. Because both packages share the `@umd-mith` scope, you can't use scope-based registry config (e.g. `@umd-mith:registry=...`) — that would route _all_ `@umd-mith` packages to one registry. Instead, use a direct tarball URL.

**1. Authenticate with GitHub Packages**

Create or update `.npmrc` in your project root:

```ini
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

You need a GitHub personal access token (classic) with `read:packages` scope, set as the `GITHUB_TOKEN` environment variable. Do **not** add `@umd-mith:registry=...` — this is intentional so that `@umd-mith/iiif-media-parsers` resolves from npm normally.

**2. Find the tarball URL**

```bash
npm view @umd-mith/svelte-iiif-transcript-player@<version> dist.tarball \
  --registry=https://npm.pkg.github.com
```

This prints a URL like:

```
https://npm.pkg.github.com/download/@umd-mith/svelte-iiif-transcript-player/<version>/<sha>
```

**3. Add to package.json**

Use the tarball URL as the version in your `package.json`:

```json
{
  "dependencies": {
    "@umd-mith/svelte-iiif-transcript-player": "https://npm.pkg.github.com/download/@umd-mith/svelte-iiif-transcript-player/<version>/<sha>"
  }
}
```

Then run `pnpm install` (or your package manager of choice). The `@umd-mith/iiif-media-parsers` dependency will resolve from npm automatically — no extra config needed.

### Local Development

```bash
git clone https://github.com/umd-mith/svelte-iiif-transcript-player.git
cd svelte-iiif-transcript-player
pnpm install
pnpm run build
```

## Peer dependencies

- `svelte ^5.0.0`

## Quick Start

### Compound Component API

Build custom IIIF media players with composable components:

```svelte
<script>
  import { IIIFPlayer } from "@umd-mith/svelte-iiif-transcript-player";

  const manifestUrl = "https://example.org/manifest.json";
  const annotations = [
    { id: "a1", startTime: 0, endTime: 5, text: "First segment" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second segment" },
  ];
</script>

<IIIFPlayer.Root {manifestUrl} canvasIndex={0}>
  <IIIFPlayer.Viewer />

  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
    <IIIFPlayer.Skip seconds={10} />
    <IIIFPlayer.Speed />
    <IIIFPlayer.Time />
  </IIIFPlayer.Controls>

  <IIIFPlayer.Transcript {annotations}>
    <IIIFPlayer.TranscriptSearch />
    <IIIFPlayer.TranscriptSegments />
  </IIIFPlayer.Transcript>
</IIIFPlayer.Root>
```

## Demo / Docs Site

The docs site is an Astro project in `docs/`. To run locally:

```bash
cd docs
pnpm install
pnpm run dev
```

Opens at `http://localhost:4321/svelte-iiif-transcript-player` with a live demo using a real IIIF manifest.

## Component API Reference

### Core Components

#### `IIIFPlayer.Root`

Top-level context provider that manages player state and coordinates all child components.

**Props:**

- `manifestUrl: string` - IIIF Presentation 3.0 manifest URL
- `canvasIndex?: number` - Canvas index to display (default: 0)
- `annotations?: Annotation[]` - Transcript annotations (passed through to children)
- `initialTime?: number` - Start playback at specific time in seconds
- `autoplay?: boolean` - Auto-play media on load (default: false)
- `onPlayerInit?: (player: PlayerRef) => void` - Callback fired once after manifest loads and first canvas is parsed. See [Accessing player state outside Root](#accessing-player-state-outside-root)
- `class?: string` - CSS class for the root container

**Context Provided:**

- Player state (`isPlaying`, `isBuffering`, `currentTime`, `duration`, `playbackRate`, `isReady`, `error`)
- Actions (`play`, `pause`, `seekTo`, `setPlaybackRate`, `retry`)
- Media element reference, media URL, media type

**Children Snippet:**

Root passes `{ player: { state, actions } }` to its children snippet, allowing direct access to player state:

```svelte
<IIIFPlayer.Root {manifestUrl}>
  {#snippet children({ player })}
    <p>Time: {player.state.currentTime}</p>
    <button onclick={() => player.actions.seekTo(0)}>Restart</button>
  {/snippet}
</IIIFPlayer.Root>
```

#### `IIIFPlayer.Viewer`

Renders the IIIF media resource (video/audio) from the current canvas.

**Props:**

- `controls?: boolean` - Show native media controls (default: false)
- `crossOrigin?: 'anonymous' | 'use-credentials'` - CORS setting for media element
- `preload?: 'auto' | 'metadata' | 'none'` - Media preload strategy (default: 'auto')
- `class?: string` - CSS class for the media element

#### `IIIFPlayer.Controls`

Container for player control components. Pass-through component for layout.

**Props:**

- `class?: string` - CSS class for styling

**Slots:** Default slot for control components

### Control Components

#### `IIIFPlayer.PlayButton`

Toggle play/pause button. Shows "Play", "Pause", or "Loading..." based on state.

**Props:**

- `class?: string` - CSS class

**Data Attributes:**

- `data-audio-button="play-pause"` - Button identifier

#### `IIIFPlayer.Progress`

Seekable progress bar (`<input type="range">`).

**Props:**

- `class?: string` - CSS class

**Data Attributes:**

- `data-audio-progress` - Progress bar element

#### `IIIFPlayer.Skip`

Skip forward/backward button.

**Props:**

- `seconds: number` - Amount to skip (negative for rewind)
- `class?: string` - CSS class

**Data Attributes:**

- `data-audio-button="skip"` - Button identifier

#### `IIIFPlayer.Speed`

Playback speed selector.

**Props:**

- `rates?: number[]` - Available playback rates (default: [0.5, 0.75, 1, 1.25, 1.5, 2])
- `class?: string` - CSS class

#### `IIIFPlayer.Time`

Display current time and duration.

**Props:**

- `class?: string` - CSS class

**Data Attributes:**

- `data-audio-control="time"` - Time display element

**Format:** `MM:SS / MM:SS` or `H:MM:SS / H:MM:SS` (current / total, with hours shown for durations >= 1 hour)

### Transcript Components

#### `IIIFPlayer.Transcript`

Bidirectional synchronized transcript panel with search.

**Props:**

- `annotations?: Annotation[]` - Transcript segments with timing (default: [])
- `syncDebounceMs?: number` - Scroll debounce in ms (default: 150)
- `syncSettleMs?: number` - Settle delay after scroll in ms (default: 100)
- `syncPriorityLockDuration?: number` - Priority lock duration in ms (default: 1000)
- `ariaLabel?: string` - Region label (default: "Media transcript")
- `announceActiveSegment?: boolean` - Screen reader announcements for active segment (default: true)
- `onActiveAnnotationChange?: (annotation: Annotation | null) => void` - Active segment callback
- `onSegmentClick?: (annotation: Annotation, event: { preventDefault: () => void }) => void` - Intercept segment clicks (call `preventDefault()` synchronously to suppress default seek)
- `empty?: Snippet` - Custom empty state when no annotations
- `class?: string` - CSS class

**Children:** Use `TranscriptSearch` and `TranscriptSegments` as compound children. Without children, shows empty state.

**Context Used:** Player state from `IIIFPlayer.Root`
**Context Provided:** TranscriptContext (annotations, search state, active annotation) for compound children

#### `IIIFPlayer.TranscriptSearch`

Search UI for filtering transcript segments. Reads from TranscriptContext when inside Transcript, or accepts props directly.

**Props (optional, overrides context):**

- `annotations?: Annotation[]` - Annotations to search
- `placeholder?: string` - Input placeholder (default: "Search transcript...")
- `debounceMs?: number` - Input debounce in ms (default: 150)
- `onmatchchange?: (matches: Annotation[], index: number) => void` - Match change callback
- `class?: string` - CSS class

#### `IIIFPlayer.TranscriptSegments`

Renders the list of transcript segments with active highlighting. Reads from TranscriptContext when inside Transcript, or accepts props directly.

**Props (optional, overrides context):**

- `annotations?: Annotation[]` - Annotations to display
- `activeAnnotationId?: string | null` - Currently active annotation
- `highlightedIds?: Set<string>` - Set of search-highlighted annotation IDs
- `currentMatchId?: string | null` - Current search match for stronger highlight
- `onclick?: (annotation: Annotation) => void` - Segment click handler
- `class?: string` - CSS class

**Data Attributes (on each Segment):**

- `data-annotation-id` - Segment ID
- `data-state="active|inactive"` - Active segment state
- `data-highlighted="true"` - Present when segment matches search query
- `data-current-match="true"` - Present on the focused search match

### TypeScript Types

#### `Annotation`

Transcript segment with timing information.

```typescript
interface Annotation {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
  metadata?: Record<string, unknown>; // Your custom data
}
```

**Parsing Annotations:**

The companion package [`@umd-mith/iiif-media-parsers`](https://github.com/umd-mith/iiif-media-parsers) provides utilities for parsing IIIF annotation targets, media fragments, ranges, and VTT speaker segments. This library re-exports its key functions (`parseMediaFragment`, `parseAnnotationTarget`, `parseRanges`, `parseVTTSpeakers`).

For a working example of parsing VTT into `Annotation[]`, see `docs/src/components/IIIFTranscriptDemo.svelte`.

#### `PlayerContext`

Internal context type (exposed for advanced use cases). Defined in `src/lib/player/context.ts`.

```typescript
interface PlayerState {
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isReady: boolean;
  error: Error | null;
}

interface PlayerActions {
  play: () => Promise<void>;
  pause: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  retry: () => Promise<void>;
}

interface PlayerContext {
  state: PlayerState;
  actions: PlayerActions;
  mediaElement: HTMLMediaElement | null;
  mediaUrl: string;
  mediaType: "audio" | "video";
}
```

## Accessing player state outside Root

Consumers needing player state in sibling components or parent-level orchestration can use the `onPlayerInit` callback.

```svelte
<script lang="ts">
  import { IIIFPlayer, type PlayerRef } from "@umd-mith/svelte-iiif-transcript-player";

  let player = $state<PlayerRef | null>(null);

  const isPlaying = $derived(player?.state.isPlaying ?? false);
  const isAudio = $derived(player?.mediaType === 'audio');
</script>

<IIIFPlayer.Root
  {manifestUrl}
  onPlayerInit={(p) => { player = p; }}
>
  <IIIFPlayer.Viewer />
  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
  </IIIFPlayer.Controls>
</IIIFPlayer.Root>

<!-- Sibling components outside Root's subtree -->
<TranscriptPanel annotations={player?.annotations ?? []} {isPlaying} />
```

**Notes:**

- `onPlayerInit` fires once after manifest first loads successfully and first canvas is parsed. If loading fails, the callback does not fire
- `state.isReady` is `false` at init time — use `$derived` to react to media readiness
- The ref is reactive (built on `$state` internally)
- `PlayerRef` fields: `state`, `actions`, `annotations`, `chapters`, `activeChapterId`, `canvasIndex`, `canvasCount`, `canvases`, `mediaType`
- For components inside Root's subtree, use `getPlayerContext()` or `tryGetPlayerContext()` instead

## Using `annotation.metadata`

The `Annotation` type includes an optional `metadata` field (`Record<string, unknown>`) for consumer-specific data. The library components don't read metadata directly — instead, you access it in custom segment snippets.

### Speaker labels

```svelte
<script>
  import { IIIFPlayer } from "@umd-mith/svelte-iiif-transcript-player";
</script>

<IIIFPlayer.Transcript {annotations}>
  {#snippet segment({ annotation, isActive, onClick })}
    <button data-annotation-id={annotation.id} onclick={onClick}>
      {#if annotation.metadata?.speaker}
        <strong>{annotation.metadata.speaker}:</strong>
      {/if}
      <span class:active={isActive}>{annotation.text}</span>
    </button>
  {/snippet}
</IIIFPlayer.Transcript>
```

### Review flags

```svelte
{#snippet segment({ annotation, isActive, onClick })}
  <div
    data-annotation-id={annotation.id}
    onclick={onClick}
    class:needs-review={annotation.metadata?.reviewStatus === "needs-review"}
  >
    {annotation.text}
    {#if annotation.metadata?.confidence != null && annotation.metadata.confidence < 0.5}
      <span class="low-confidence-badge">Low confidence</span>
    {/if}
  </div>
{/snippet}
```

### Paragraph merging with speakers

```ts
import { mergeIntoParagraphs } from "@umd-mith/svelte-iiif-transcript-player";

// Build a speaker map from metadata
const speakers = new Map(
  annotations
    .filter((a) => a.metadata?.speaker)
    .map((a) => [a.id, a.metadata!.speaker as string]),
);

const paragraphs = mergeIntoParagraphs(annotations, { speakers });
```

## Using with Astro

The compound components work seamlessly in Astro islands with proper hydration directives:

```astro
---
import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

const manifestUrl = 'https://example.org/manifest.json';
const annotations = [...]; // Your VTT parsing logic
---

<div class="media-player">
  <IIIFPlayer.Root client:load {manifestUrl} canvasIndex={0}>
    <!-- Media viewer needs immediate initialization -->
    <IIIFPlayer.Viewer />

    <!-- Controls should respond immediately -->
    <IIIFPlayer.Controls>
      <IIIFPlayer.PlayButton />
      <IIIFPlayer.Progress />
      <IIIFPlayer.Skip seconds={-10} />
      <IIIFPlayer.Skip seconds={30} />
      <IIIFPlayer.Speed />
      <IIIFPlayer.Time />
    </IIIFPlayer.Controls>

    <!-- Transcript shares Root's context — no separate hydration directive needed -->
    <IIIFPlayer.Transcript {annotations}>
      <IIIFPlayer.TranscriptSearch />
      <IIIFPlayer.TranscriptSegments />
    </IIIFPlayer.Transcript>
  </IIIFPlayer.Root>
</div>
```

### Hydration Directive Choices

- `IIIFPlayer.Root` → `client:load` - Controls media element, needs immediate initialization
- Child components inside Root share its hydration context — do not add separate `client:*` directives on nested Svelte components (they only work on top-level Astro islands)

### Common Pitfalls with Astro

- **Island isolation**: Each `client:*` directive creates a separate island. Components inside the same `IIIFPlayer.Root` share context automatically
- **Props serialization**: Only JSON-serializable props work across islands. The compound component pattern handles this internally via context
- **Reference implementation**: See [`docs/src/components/IIIFTranscriptDemo.svelte`](./docs/src/components/IIIFTranscriptDemo.svelte) for a working example

## Styling

All components ship **unstyled** with semantic HTML and `data-*` attributes for styling hooks. Bring your own CSS.

### What You Need to Style

- **Transcript segments**: Target `button[data-annotation-id]` and use `data-state="active"` for highlighting
- **Player controls**: Use `data-audio-button`, `data-audio-progress`, `data-audio-control` attributes
- **Search UI**: Target `input[type="search"]` inside `.search-container`
- **Layout**: Components don't enforce layout — use flexbox/grid as needed

### Example: Active Segment Highlighting

```css
/* Transcript segment buttons */
button[data-annotation-id] {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: none;
  background: white;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

button[data-annotation-id]:hover {
  background-color: #f3f4f6;
}

/* Active segment gets blue highlight */
button[data-annotation-id][data-state="active"] {
  background-color: #bae6fd;
  border-left: 4px solid #0ea5e9;
}
```

### No CSS Variables (Yet)

The library currently doesn't use CSS custom properties. You control all styling via your own CSS. If you need themeable defaults, open an issue to discuss design token integration.

## Browser Support

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- **Requires**: Native ESM, `<video>`/`<audio>` elements, Proxy support
- **Svelte 5**: Requires Svelte 5.0+ (runes, snippets)
- **XState 5**: State machine for playback sync

**Known limitations:**

- No IE11 support (Svelte 5 requirement)
- Safari < 15 lacks some IIIF Presentation 3.0 features

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

For AI-assisted contributions, include commit trailers:

```
Assisted-by: Claude <noreply@anthropic.com>
```

## License

BSD 3-Clause Clear - see [LICENSE](LICENSE) for details.
