# @umd-mith/svelte-iiif-transcript-player

> IIIF-powered, transcript-synchronized media player for Svelte 5.

**Status:** Early development (v0.1.0). API not stable.

## Install

> **Note:** This package is not yet published to npm. Use one of the methods below:

### Install from GitHub

```bash
pnpm add github:umd-mith/svelte-iiif-transcript-player
```

### Local Development

```bash
git clone https://github.com/umd-mith/svelte-iiif-transcript-player.git
cd svelte-iiif-transcript-player
pnpm install
pnpm run build
```

## Peer dependencies

- `svelte ^5.0.0`
- `xstate ^5.0.0`

## Quick Start

### Compound Component API

Build custom IIIF media players with composable components:

```svelte
<script>
  import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';

  const manifestUrl = 'https://example.org/manifest.json';
  const annotations = [
    { id: 'a1', startTime: 0, endTime: 5, text: 'First segment' },
    { id: 'a2', startTime: 5, endTime: 10, text: 'Second segment' }
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
- `initialTime?: number` - Start playback at specific time in seconds
- `onReady?: () => void` - Callback when manifest is loaded
- `onError?: (error: Error) => void` - Error handler

**Context Provided:**
- Player state (playing, currentTime, duration, playbackRate)
- Actions (play, pause, seekTo, setPlaybackRate)
- Media element reference

#### `IIIFPlayer.Viewer`

Renders the IIIF media resource (video/audio) from the current canvas.

**Props:** None (receives context from Root)

#### `IIIFPlayer.Controls`

Container for player control components. Pass-through component for layout.

**Props:**
- `class?: string` - CSS class for styling

**Slots:** Default slot for control components

### Control Components

#### `IIIFPlayer.PlayButton`

Toggle play/pause button.

**Props:** None

**Data Attributes:**
- `data-playing="true|false"` - Reflects playback state

#### `IIIFPlayer.Progress`

Seekable progress bar (range input).

**Props:** None

**Data Attributes:**
- `data-progress` - Progress bar element

#### `IIIFPlayer.Skip`

Skip forward/backward button.

**Props:**
- `seconds: number` - Amount to skip (negative for rewind)

#### `IIIFPlayer.Speed`

Playback speed selector.

**Props:**
- `speeds?: number[]` - Available speeds (default: [0.5, 0.75, 1, 1.25, 1.5, 2])

#### `IIIFPlayer.Time`

Display current time and duration.

**Props:** None

**Format:** `MM:SS / MM:SS` (current / total)

### Transcript Components

#### `IIIFPlayer.Transcript`

Bidirectional synchronized transcript panel with search.

**Props:**
- `annotations: Annotation[]` - **Required.** Transcript segments with timing
- `syncDebounceMs?: number` - Scroll throttling (default: 150)
- `onActiveAnnotationChange?: (annotation: Annotation | null) => void` - Active segment callback

**Children:** Compound children only — use `TranscriptSearch` and `TranscriptSegments` inside.

**Context Used:** Player state from `IIIFPlayer.Root`
**Context Provided:** TranscriptContext (annotations, search state, active annotation)

#### `IIIFPlayer.TranscriptSearch`

Search UI for filtering transcript segments.

**Props:** None (receives search context from Transcript)

**Data Attributes:**
- `data-search-input` - Search input field

#### `IIIFPlayer.TranscriptSegments`

Renders the list of transcript segments with active highlighting.

**Props:** None (receives annotations from Transcript)

**Slots:**
- `segment` - Custom segment rendering snippet

**Data Attributes:**
- `data-annotation-id` - Segment ID
- `data-state="active|inactive"` - Active segment state

### TypeScript Types

#### `Annotation`

Transcript segment with timing information.

```typescript
interface Annotation {
  id: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
  text: string;
  metadata?: Record<string, unknown>;  // Your custom data
}
```

**Parsing VTT Files:**

The library focuses on IIIF playback and sync. For VTT parsing, we recommend:
- [`media-captions`](https://github.com/vidstack/media-captions) - Robust WebVTT parser
- Roll your own simple parser (see `docs/src/components/IIIFTranscriptDemo.svelte` for example)

#### `PlayerContext`

Internal context type (exposed for advanced use cases).

```typescript
interface PlayerContext {
  state: {
    playing: boolean;
    currentTime: number;
    duration: number;
    playbackRate: number;
  };
  actions: {
    play: () => void;
    pause: () => void;
    seekTo: (time: number) => void;
    setPlaybackRate: (rate: number) => void;
  };
  mediaElement: HTMLMediaElement | null;
}
```

## Using `annotation.metadata`

The `Annotation` type includes an optional `metadata` field (`Record<string, unknown>`) for consumer-specific data. The library components don't read metadata directly — instead, you access it in custom segment snippets.

### Speaker labels

```svelte
<script>
  import { IIIFPlayer } from '@umd-mith/svelte-iiif-transcript-player';
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
    class:needs-review={annotation.metadata?.reviewStatus === 'needs-review'}
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
import { mergeIntoParagraphs } from '@umd-mith/svelte-iiif-transcript-player';

// Build a speaker map from metadata
const speakers = new Map(
  annotations
    .filter(a => a.metadata?.speaker)
    .map(a => [a.id, a.metadata!.speaker as string])
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

    <!-- Transcript can lazy-load (often below fold) -->
    <IIIFPlayer.Transcript client:visible {annotations}>
      <IIIFPlayer.TranscriptSearch />
      <IIIFPlayer.TranscriptSegments />
    </IIIFPlayer.Transcript>
  </IIIFPlayer.Root>
</div>
```

### Hydration Directive Choices

- `IIIFPlayer.Root` → `client:load` - Controls media element, needs immediate initialization
- `IIIFPlayer.Transcript` → `client:visible` - Can lazy-load if below the fold, improving initial page load

### Common Pitfalls with Astro

- **Island isolation**: Each `client:*` directive creates a separate island. Components inside the same `IIIFPlayer.Root` share context automatically
- **Props serialization**: Only JSON-serializable props work across islands. The compound component pattern handles this internally via context
- **Reference implementation**: See [`docs/src/components/IIIFTranscriptDemo.svelte`](./docs/src/components/IIIFTranscriptDemo.svelte) for a working example

## Styling

All components ship **unstyled** with semantic HTML and `data-*` attributes for styling hooks. Bring your own CSS.

### What You Need to Style

- **Transcript segments**: Target `button[data-annotation-id]` and use `data-state="active"` for highlighting
- **Player controls**: Use `data-playing`, `data-progress`, etc. attributes
- **Search UI**: Target `data-search-input` and related elements
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
button[data-annotation-id][data-state='active'] {
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
