# @umd-mith/svelte-iiif-transcript-player

Composable Svelte 5 components for building media players with synchronized transcripts from [IIIF](https://iiif.io/) manifests. Designed for digital humanities projects, oral history archives, and anywhere time-based annotations meet audio/video.

The compound component API lets you assemble custom player layouts from small, focused pieces — controls, transcript panel, chapter navigation, canvas switching — while a bidirectional sync engine keeps the transcript scroll position and media playback in lockstep.

## What this library provides

- **13 composable components** under a single `IIIFPlayer` namespace (Root, Viewer, Controls, PlayButton, Progress, Skip, Speed, Time, Transcript, TranscriptSearch, TranscriptSegments, Chapters, CanvasNav)
- **Bidirectional sync** — clicking a transcript segment seeks the media; media playback scrolls the transcript (XState 5 state machine)
- **Full-text search** across transcript segments with match-by-match navigation
- **Multi-canvas support** — switch between canvases in a manifest, with chapter markers per canvas
- **HLS adaptive streaming** — auto-detects HLS URLs and uses `hls.js` when available (Safari uses native HLS)
- **Custom segment rendering** via Svelte 5 snippets and a `segmentAttrs` spread for accessibility
- **Dual-mode components** — `TranscriptSearch` and `TranscriptSegments` work inside `Transcript` (via context) or standalone (via props)
- **Unstyled by default** — all components expose `data-*` attributes for CSS targeting; bring your own styles
- **IIIF utilities** — re-exports parsing functions from `@umd-mith/iiif-media-parsers` plus Zod validators for manifests

## Quick Start

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

**3. Add to package.json**

Use the tarball URL as the version:

```json
{
  "dependencies": {
    "@umd-mith/svelte-iiif-transcript-player": "https://npm.pkg.github.com/download/@umd-mith/svelte-iiif-transcript-player/<version>/<sha>"
  }
}
```

Then run `pnpm install` (or your package manager). The `@umd-mith/iiif-media-parsers` dependency resolves from npm automatically.

### Peer Dependencies

- `svelte ^5.0.0`
- `hls.js` (optional — needed only for HLS streams on non-Safari browsers)

### Local Development

```bash
git clone https://github.com/umd-mith/svelte-iiif-transcript-player.git
cd svelte-iiif-transcript-player
pnpm install
pnpm run build
```

## Component API Reference

### Core Components

#### `IIIFPlayer.Root`

Top-level context provider. Fetches the IIIF manifest, parses canvases, and coordinates all child components via Svelte context.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `manifestUrl` | `string` | required | IIIF Presentation 3.0 manifest URL |
| `canvasIndex` | `number` | `0` | Canvas to display |
| `annotations` | `Annotation[]` | `[]` | Transcript annotations (passed through to context) |
| `initialTime` | `number` | — | Start playback at this time (seconds) |
| `autoplay` | `boolean` | `false` | Auto-play media on load |
| `hlsConstructor` | `HlsConstructor` | — | Custom `hls.js` constructor (bypasses dynamic import) |
| `onCanvasChange` | `(index: number, canvas: CanvasInfo) => void` | — | Fires when canvas switches |
| `onPlayerInit` | `(player: PlayerRef) => void` | — | Fires once after manifest loads. See [Accessing player state outside Root](#accessing-player-state-outside-root) |
| `class` | `string` | `""` | CSS class for root container |

**Children snippet:**

Root passes `{ player }` to its children snippet with `state`, `actions`, `annotations`, `chapters`, and `activeChapterId`:

```svelte
<IIIFPlayer.Root {manifestUrl}>
  {#snippet children({ player })}
    <p>Time: {player.state.currentTime}</p>
    <p>Chapter: {player.activeChapterId}</p>
    <button onclick={() => player.actions.seekTo(0)}>Restart</button>
  {/snippet}
</IIIFPlayer.Root>
```

#### `IIIFPlayer.Viewer`

Renders the media element (`<audio>` or `<video>`) for the current canvas. Auto-wires HLS when the media strategy requires it.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `controls` | `boolean` | `false` | Show native media controls |
| `crossOrigin` | `'anonymous' \| 'use-credentials'` | — | CORS setting |
| `preload` | `'auto' \| 'metadata' \| 'none'` | `'auto'` | Preload strategy |
| `tracks` | `TrackDefinition[]` | `[]` | Caption/subtitle tracks (overrides auto-discovered tracks from manifest) |
| `class` | `string` | `""` | CSS class |

#### `IIIFPlayer.Controls`

Pass-through container for control components. Use for layout.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | `""` | CSS class |

**Data attribute:** `data-audio-controls`

### Control Components

#### `IIIFPlayer.PlayButton`

Toggle play/pause. Shows "Play", "Pause", or "Loading..." based on player state.

- **Data attribute:** `data-audio-button="play-pause"`
- **Prop:** `class?: string`

#### `IIIFPlayer.Progress`

Seekable range input (`<input type="range">`).

- **Data attribute:** `data-audio-progress`
- **Prop:** `class?: string`

#### `IIIFPlayer.Skip`

Skip forward or backward.

| Prop | Type | Description |
|------|------|-------------|
| `seconds` | `number` | Seconds to skip (negative for rewind) |
| `class` | `string` | CSS class |

**Data attribute:** `data-audio-button="skip"`

#### `IIIFPlayer.Speed`

Playback rate selector (`<select>`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `rates` | `number[]` | `[0.5, 0.75, 1, 1.25, 1.5, 2]` | Available rates |
| `class` | `string` | `""` | CSS class |

**Data attribute:** `data-audio-control="speed"`

#### `IIIFPlayer.Time`

Displays current time and duration as `MM:SS / MM:SS` (or `H:MM:SS` for durations >= 1 hour).

- **Data attribute:** `data-audio-control="time"`
- **Prop:** `class?: string`

### Transcript Components

#### `IIIFPlayer.Transcript`

Synchronized transcript panel. Manages bidirectional scroll↔media sync via an XState-based `SyncController`. Provides `TranscriptContext` to compound children.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `annotations` | `Annotation[]` | `[]` | Transcript segments (falls back to Root context annotations) |
| `syncDebounceMs` | `number` | `150` | Scroll debounce (ms) |
| `syncSettleMs` | `number` | `100` | Settle delay after scroll (ms) |
| `syncPriorityLockDuration` | `number` | `1000` | Priority lock duration (ms) |
| `ariaLabel` | `string` | `"Media transcript"` | Region label |
| `announceActiveSegment` | `boolean` | `true` | Screen reader announcements for active segment |
| `onActiveAnnotationChange` | `(annotation: Annotation \| null) => void` | — | Fires when active segment changes |
| `onSegmentClick` | `(annotation: Annotation, event: { preventDefault: () => void }) => void` | — | Intercept clicks; call `preventDefault()` synchronously to suppress default seek |
| `empty` | `Snippet` | — | Custom empty state |
| `class` | `string` | `""` | CSS class |

**Children:** Use `TranscriptSearch` and `TranscriptSegments` as compound children. Without children, renders the empty state.

#### `IIIFPlayer.TranscriptSearch`

Search input for filtering transcript segments. **Dual-mode:** reads from `TranscriptContext` inside `Transcript`, or accepts props directly when used standalone.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `annotations` | `Annotation[]` | from context | Annotations to search |
| `placeholder` | `string` | `"Search transcript..."` | Input placeholder |
| `debounceMs` | `number` | `150` | Input debounce (ms) |
| `onmatchchange` | `(matches: Annotation[], index: number) => void` | from context | Match change callback |
| `class` | `string` | `""` | CSS class |

#### `IIIFPlayer.TranscriptSegments`

Renders transcript segments with active/search highlighting and roving tabindex keyboard navigation. **Dual-mode:** reads from `TranscriptContext` inside `Transcript`, or accepts props directly.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `annotations` | `Annotation[]` | from context | Annotations to display |
| `activeAnnotationId` | `string \| null` | from context | Currently active annotation |
| `highlightedIds` | `Set<string>` | from context | Search-highlighted annotation IDs |
| `currentMatchId` | `string \| null` | from context | Current search match (stronger highlight) |
| `highlightedAnnotationId` | `string \| null` | `null` | Deep-link highlight (merged with search highlights) |
| `onclick` | `(annotation: Annotation) => void` | from context | Segment click handler |
| `onkeydown` | `(event: KeyboardEvent, context: { annotation, index, annotations }) => void` | — | Keyboard handler on container; call `preventDefault()` to suppress built-in Arrow/Home/End navigation |
| `segment` | `Snippet<[SegmentSnippetProps]>` | — | Full custom segment rendering (see [Custom segment snippets](#custom-segment-snippets)) |
| `text` | `Snippet<[{ annotation: Annotation }]>` | — | Custom text rendering only |
| `class` | `string` | `""` | CSS class |

**Data attributes on each segment:**

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-annotation-id` | segment ID | Unique identifier |
| `data-state` | `"active"` \| `"inactive"` | Playback state |
| `data-highlighted` | `"true"` or absent | Matches search query |
| `data-current-match` | `"true"` or absent | Focused search match |

### Navigation Components

#### `IIIFPlayer.Chapters`

Displays chapter markers from the IIIF manifest's Range structures. Clicking a chapter seeks to its start time.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onActiveChapterChange` | `(chapter: Chapter \| null) => void` | — | Fires when active chapter changes |
| `chapter` | `Snippet<[{ chapter: Chapter, isActive: boolean, onClick: () => void }]>` | — | Custom chapter rendering |
| `empty` | `Snippet` | — | Custom empty state |
| `class` | `string` | `""` | CSS class |

**Data attributes (default rendering):**
- `data-chapter-id` — chapter identifier
- `data-state="active|inactive"` — current chapter state

#### `IIIFPlayer.CanvasNav`

Multi-canvas navigation. Hidden when the manifest has only one canvas.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onCanvasChange` | `(canvas: CanvasInfo) => void` | — | Fires when user selects a canvas |
| `canvas` | `Snippet<[{ canvas: CanvasInfo, isActive: boolean, onClick: () => void }]>` | — | Custom canvas rendering |
| `empty` | `Snippet` | — | Custom empty state |
| `class` | `string` | `""` | CSS class |

**Data attributes (default rendering):**
- `data-canvas-index` — canvas position
- `data-state="active|inactive"` — current canvas state

## Styling

All components ship **unstyled** with semantic HTML and `data-*` attributes for CSS hooks.

### Styling Targets

| Area | Selector | Notes |
|------|----------|-------|
| Transcript segments | `[data-annotation-id]` | Use `[data-state="active"]` for highlighting |
| Player controls | `[data-audio-button]`, `[data-audio-progress]`, `[data-audio-control]` | |
| Search input | `input[type="search"]` | Inside `.transcript-search-sticky` |
| Chapter markers | `[data-chapter-id]` | Use `[data-state="active"]` |
| Canvas nav | `[data-canvas-index]` | Use `[data-state="active"]` |
| Scroll container | `.transcript-panel` | The sync engine's scroll target |
| Segments container | `.segments-container` | Wraps all segments |

### Example: Active Segment Highlighting

```css
[data-annotation-id] {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: none;
  background: white;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

[data-annotation-id]:hover {
  background-color: #f3f4f6;
}

[data-annotation-id][data-state="active"] {
  background-color: #bae6fd;
  border-left: 4px solid #0ea5e9;
}

[data-annotation-id][data-highlighted="true"] {
  background-color: #fef9c3;
}

[data-annotation-id][data-current-match="true"] {
  background-color: #fde68a;
  border-left: 4px solid #f59e0b;
}
```

## Annotations

### The `Annotation` Type

```typescript
interface Annotation {
  id: string;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
  metadata?: Record<string, unknown>;
}
```

### Parsing Annotations

The companion package [`@umd-mith/iiif-media-parsers`](https://github.com/umd-mith/iiif-media-parsers) provides utilities for parsing IIIF annotation targets, media fragments, ranges, and VTT speaker segments. This library re-exports its key functions (`parseMediaFragment`, `parseAnnotationTarget`, `parseRanges`, `parseVTTSpeakers`).

For a working example of parsing VTT into `Annotation[]`, see [`docs/src/components/IIIFTranscriptDemo.svelte`](./docs/src/components/IIIFTranscriptDemo.svelte).

### Using `annotation.metadata`

The `metadata` field (`Record<string, unknown>`) carries consumer-specific data. Library components don't read metadata — access it in custom segment snippets.

**Speaker labels:**

```svelte
<IIIFPlayer.TranscriptSegments {annotations}>
  {#snippet segment({ annotation, segmentAttrs })}
    <div {...segmentAttrs}>
      {#if annotation.metadata?.speaker}
        <strong>{annotation.metadata.speaker}:</strong>
      {/if}
      <span>{annotation.text}</span>
    </div>
  {/snippet}
</IIIFPlayer.TranscriptSegments>
```

### Paragraph Merging

```ts
import { mergeIntoParagraphs } from "@umd-mith/svelte-iiif-transcript-player";

const speakers = new Map(
  annotations
    .filter((a) => a.metadata?.speaker)
    .map((a) => [a.id, a.metadata!.speaker as string]),
);

const paragraphs = mergeIntoParagraphs(annotations, { speakers });
```

## Advanced Patterns

### Custom Segment Snippets

The `segment` snippet on `TranscriptSegments` gives full control over rendering. It receives a `segmentAttrs` spread object that bundles `data-*` attributes, `aria-current`, `role`, `tabindex`, and `onclick` — spread it onto your root element for correct behavior:

```svelte
<IIIFPlayer.TranscriptSegments>
  {#snippet segment({ annotation, isActive, isHighlighted, isCurrentMatch, segmentAttrs })}
    <div {...segmentAttrs} class="my-segment" class:active={isActive}>
      <span class="timestamp">{annotation.startTime}</span>
      <p>{annotation.text}</p>
      {#if annotation.metadata?.confidence != null && annotation.metadata.confidence < 0.5}
        <span class="badge">Low confidence</span>
      {/if}
    </div>
  {/snippet}
</IIIFPlayer.TranscriptSegments>
```

The `text` snippet is a lighter alternative when you only need to customize text rendering (timestamps and wrapper element stay default):

```svelte
<IIIFPlayer.TranscriptSegments>
  {#snippet text({ annotation })}
    <p>{@html sanitize(annotation.text)}</p>
  {/snippet}
</IIIFPlayer.TranscriptSegments>
```

> **Caution:** If using `{@html}`, ensure annotation text is sanitized to prevent XSS. Default rendering escapes text automatically.

### Accessing Player State Outside Root

Use `onPlayerInit` to get a reactive `PlayerRef` in sibling or parent components:

```svelte
<script lang="ts">
  import {
    IIIFPlayer,
    type PlayerRef,
  } from "@umd-mith/svelte-iiif-transcript-player";

  let player = $state<PlayerRef | null>(null);

  const isPlaying = $derived(player?.state.isPlaying ?? false);
  const isAudio = $derived(player?.mediaType === "audio");
</script>

<IIIFPlayer.Root
  {manifestUrl}
  onPlayerInit={(p) => {
    player = p;
  }}
>
  <IIIFPlayer.Viewer />
  <IIIFPlayer.Controls>
    <IIIFPlayer.PlayButton />
    <IIIFPlayer.Progress />
  </IIIFPlayer.Controls>
</IIIFPlayer.Root>

<!-- Sibling components outside Root -->
{#if player}
  <p>{player.canvases.length} canvases, currently on #{player.canvasIndex}</p>
{/if}
```

**Notes:**

- `onPlayerInit` fires once after manifest loads and first canvas is parsed. If loading fails, the callback does not fire
- `state.isReady` is `false` at init time — use `$derived` to react to media readiness
- The ref is reactive (built on `$state` internally)
- For components inside Root's subtree, use `getPlayerContext()` or `tryGetPlayerContext()` instead

### Dual-Mode Components with `tryGetPlayerContext()`

`TranscriptSearch` and `TranscriptSegments` detect whether they're inside an `IIIFPlayer.Root` and adapt automatically. Build your own dual-mode components the same way:

```svelte
<script lang="ts">
  import { tryGetPlayerContext } from "@umd-mith/svelte-iiif-transcript-player";

  let { isPlaying: isPlayingProp = false }: { isPlaying?: boolean } = $props();

  const player = tryGetPlayerContext(); // PlayerContext | null
  const isPlaying = $derived(player ? player.state.isPlaying : isPlayingProp);
</script>
```

`tryGetPlayerContext()` must be called during component initialization (top-level `<script>`), not inside event handlers, `$effect`, or async callbacks.

## TypeScript Types

### Exported Types

```typescript
// Player
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
  seekToChapter: (chapter: Chapter) => void;
  switchCanvas: (index: number) => void;
}

interface PlayerRef {
  readonly state: PlayerState;
  readonly actions: PlayerActions;
  readonly annotations: Annotation[];
  readonly chapters: Chapter[];
  readonly activeChapterId: string | null;
  readonly canvasIndex: number;
  readonly canvasCount: number;
  readonly canvases: CanvasInfo[];
  readonly mediaType: "audio" | "video";
}

interface PlayerContext extends PlayerRef {
  mediaElement: HTMLMediaElement | null;
  mediaUrl: string;
  readonly mediaStrategy: MediaStrategy;
  readonly hlsAdapter: HlsAdapter | null;
  readonly tracks: TrackDefinition[];
}

interface CanvasInfo {
  index: number;
  id: string;
  label: string;
  duration?: number;
  mediaType: "audio" | "video";
}

type MediaStrategy = "native" | "hls-js";

// Transcript
interface TranscriptContext {
  state: TranscriptState;
  actions: TranscriptActions;
}

// Segments
interface SegmentSnippetProps {
  annotation: Annotation;
  isActive: boolean;
  isHighlighted: boolean;
  isCurrentMatch: boolean;
  index: number;
  segmentAttrs: SegmentAttrs;
}
```

All types are exported from the package entry point.

## Framework Integration

### Using with Astro

The compound components work in Astro islands. Place `client:load` on the `IIIFPlayer.Root` — child components inside share its hydration context automatically:

```astro
---
import IIIFTranscriptDemo from '../components/IIIFTranscriptDemo.svelte';
---

<IIIFTranscriptDemo client:load manifestUrl="..." vttUrl="..." />
```

**Key points:**

- Each `client:*` directive creates a separate island. Components inside the same Root share context — do not add separate `client:*` directives on nested Svelte components
- Only JSON-serializable props work across island boundaries. The compound component pattern handles this internally
- See [`docs/src/components/IIIFTranscriptDemo.svelte`](./docs/src/components/IIIFTranscriptDemo.svelte) for a working example

## Demo / Docs Site

The docs site is an Astro project in `docs/`. To run locally:

```bash
cd docs
pnpm install
pnpm run dev
```

Opens at `http://localhost:4321/svelte-iiif-transcript-player` with live demos using real IIIF manifests.

## Browser Support

Tested in modern evergreen browsers. Requires:

- Native ES modules
- `<video>` / `<audio>` elements
- `Proxy` (Svelte 5 reactivity)
- Svelte 5.0+
- XState 5 (bundled)

HLS streaming requires either Safari (native) or `hls.js` (other browsers).

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

For AI-assisted contributions, include commit trailers:

```
Assisted-by: Claude <noreply@anthropic.com>
```

## License

BSD 3-Clause Clear — see [LICENSE](LICENSE) for details.
