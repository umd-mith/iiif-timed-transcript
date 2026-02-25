# Transcript Components

Unstyled primitives for displaying and synchronizing media transcripts with IIIF viewers.

## Components

### TranscriptPanel

Main orchestrator component that handles transcript display, bidirectional synchronization, search, and keyboard navigation.

**Features:**
- ✅ Bidirectional sync (click transcript → seek video, video plays → scroll transcript)
- ✅ Debounced search with match navigation
- ✅ Keyboard navigation (arrow keys, Enter)
- ✅ Snippet-based customization for segments, toolbar, empty state
- ✅ Unstyled (style via data attributes)

**Basic Usage:**

```svelte
<script>
  import { TranscriptPanel, IIIFMediaViewer } from '@umd-mith/svelte-iiif-transcript-player';

  let viewer;
  const annotations = [
    { id: 'seg-1', startTime: 0, endTime: 5, text: 'Hello world' },
    { id: 'seg-2', startTime: 5, endTime: 10, text: 'Welcome to IIIF' }
  ];
</script>

<IIIFMediaViewer bind:this={viewer} manifestUrl="..." />
<TranscriptPanel {annotations} {viewer} enableSearch />
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `annotations` | `Annotation[]` | **required** | Array of transcript segments |
| `viewer` | `IIIFMediaViewerRef \| null` | **required** | Viewer instance (null for static) |
| `syncDebounceMs` | `number` | `150` | Scroll event throttling |
| `syncSettleMs` | `number` | `100` | Operation settle time |
| `syncPriorityLockDuration` | `number` | `1000` | Feedback loop prevention |
| `enableSearch` | `boolean` | `false` | Show search UI |
| `enableFullscreen` | `boolean` | `false` | Show fullscreen toggle |
| `searchDebounceMs` | `number` | `150` | Search input debounce |
| `searchPlaceholder` | `string` | `"Search transcript..."` | Search input placeholder |
| `ariaLabel` | `string` | `"Media transcript"` | ARIA label for container |
| `announceActiveSegment` | `boolean` | `true` | Screen reader announcements |

**Snippets:**

Customize rendering via Svelte 5 snippets:

```svelte
<TranscriptPanel {annotations} {viewer}>
  {#snippet segment({ annotation, isActive, onClick })}
    <button
      data-annotation-id={annotation.id}
      class:active={isActive}
      onclick={onClick}
    >
      <time>{formatTime(annotation.startTime)}</time>
      <p>{annotation.text}</p>
    </button>
  {/snippet}

  {#snippet toolbar()}
    <MyCustomSearch />
  {/snippet}

  {#snippet empty()}
    <p>No transcript loaded.</p>
  {/snippet}
</TranscriptPanel>
```

**Important:** When using the `segment` snippet, you **must** include:
- `data-annotation-id={annotation.id}` – Required for SyncController to find elements
- `onclick={onClick}` – Wires click-to-seek functionality

### TranscriptSearch

Standalone search component for filtering annotations.

```svelte
<script>
  import { TranscriptSearch } from '@umd-mith/svelte-iiif-transcript-player';

  let matches = [];
  let currentMatchIndex = -1;
</script>

<TranscriptSearch
  {annotations}
  placeholder="Find in transcript..."
  onmatchchange={(m) => matches = m}
  onnavigatematch={(idx) => currentMatchIndex = idx}
  {currentMatchIndex}
  totalMatches={matches.length}
/>
```

### TranscriptSegment

Reference implementation for individual transcript segments. Use as a starting point for custom designs.

```svelte
<script>
  import { TranscriptSegment } from '@umd-mith/svelte-iiif-transcript-player';

  const annotation = { id: 'seg-1', startTime: 0, endTime: 5, text: 'Hello' };
</script>

<TranscriptSegment
  {annotation}
  isActive={false}
  onclick={() => console.log('Clicked')}
/>
```

## Styling

Components ship **unstyled** and use data attributes for styling hooks:

```css
/* Style segments */
[data-annotation-id] {
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

/* Style active segment */
[data-state="active"] {
  background: #f0f0f0;
  font-weight: bold;
}

/* Style inactive segments */
[data-state="inactive"] {
  opacity: 0.7;
}
```

### Complete Styling Reference

All available styling hooks for customization:

#### TranscriptPanel

```css
/* Container */
.transcript-panel {
  /* Panel wrapper */
}

/* Toolbar (when enableSearch or enableFullscreen is true) */
.toolbar {
  /* Toolbar container */
}

/* Segments scrollable container */
.segments-container {
  /* Scrollable list wrapper */
}

/* Empty state */
.empty-message {
  /* Shown when annotations array is empty */
}
```

#### TranscriptSegment

```css
/* Segment button */
[data-annotation-id] {
  /* Target any segment */
}

[data-annotation-id="seg-1"] {
  /* Target specific segment by ID */
}

/* State-based styling */
[data-state="active"] {
  /* Currently playing segment */
}

[data-state="inactive"] {
  /* Not currently playing */
}

/* ARIA attributes (for accessibility-aware styling) */
[aria-current="true"] {
  /* Active segment (same as data-state="active") */
}

/* Nested elements */
[data-annotation-id] .timestamp {
  /* Timestamp display */
}

[data-annotation-id] .text {
  /* Transcript text */
}
```

#### TranscriptSearch

```css
/* Search container */
.search-container {
  /* Search wrapper (role="search") */
}

/* Search input */
.search-container input[type="search"] {
  /* Search text input */
}

/* Match counter */
.match-counter {
  /* "X / Y" match display */
}

/* Navigation buttons */
.search-container button[aria-label="Previous match"] {
  /* Previous button */
}

.search-container button[aria-label="Next match"] {
  /* Next button */
}

/* Disabled state */
.search-container button:disabled {
  /* When no matches or navigation not available */
}
```

#### Example: Complete Custom Theme

```css
/* Dark mode transcript */
.transcript-panel {
  background: #1a1a1a;
  color: #e0e0e0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.segments-container {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

[data-annotation-id] {
  padding: 0.75rem 1rem;
  background: #2a2a2a;
  border-left: 3px solid transparent;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

[data-annotation-id]:hover {
  background: #3a3a3a;
  border-left-color: #666;
}

[data-state="active"] {
  background: #2d3748;
  border-left-color: #4299e1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

[data-annotation-id] .timestamp {
  font-size: 0.875rem;
  color: #a0aec0;
  margin-bottom: 0.25rem;
  font-family: monospace;
}

[data-annotation-id] .text {
  margin: 0;
  line-height: 1.6;
}

.search-container {
  padding: 0.5rem;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-container input {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  padding: 0.5rem;
  border-radius: 4px;
}

.match-counter {
  font-size: 0.875rem;
  color: #a0aec0;
}
```

## Annotation Type

```typescript
interface Annotation {
  id: string;          // Unique identifier
  startTime: number;   // Start time in seconds
  endTime: number;     // End time in seconds
  text: string;        // Transcript text
}
```

## Static Mode (No Sync)

Pass `viewer={null}` for a static transcript without synchronization:

```svelte
<TranscriptPanel {annotations} viewer={null} />
```

In static mode:
- No automatic scrolling from video playback
- Clicking segments does nothing
- All other features (search, keyboard nav) still work

## Utilities

```typescript
import { formatTimestamp, getAnnotationById, keyboardNav } from '@umd-mith/svelte-iiif-transcript-player';

// Format seconds to MM:SS
formatTimestamp(65); // "1:05"

// Find annotation by ID
const ann = getAnnotationById(annotations, 'seg-1');

// Keyboard navigation action
<div use:keyboardNav={{
  onArrowDown: () => console.log('Down'),
  onEnter: () => console.log('Enter')
}} />
```

## Advanced: Custom Sync Configuration

Fine-tune synchronization behavior:

```svelte
<TranscriptPanel
  {annotations}
  {viewer}
  syncDebounceMs={200}              // Slower scroll throttling
  syncSettleMs={150}                // More settle time
  syncPriorityLockDuration={2000}   // Longer lock duration
/>
```

- **`syncDebounceMs`**: How often scroll events are processed (higher = less responsive but smoother)
- **`syncSettleMs`**: Wait time after operations before next action (prevents jitter)
- **`syncPriorityLockDuration`**: Lock duration after user interaction (prevents feedback loops)

## Architecture

```
TranscriptPanel
├─ SyncController (internal)      ← Handles bidirectional sync
├─ TranscriptSearch (optional)    ← Search UI when enableSearch={true}
├─ Segments container              ← Scrollable list
│  └─ TranscriptSegment (default) ← Or custom via snippet
└─ Keyboard navigation             ← Arrow keys, Enter
```

**Design Philosophy:**
- **Unstyled primitives** – Use data attributes for styling, no opinions on appearance
- **Baked-in sync** – Panel creates SyncController internally, you just pass `viewer`
- **Snippet customization** – Override rendering without losing functionality
- **Escape hatches** – `viewer={null}` for static mode, snippets for full control

## Common Pitfalls

### ❌ Pitfall 1: Missing `data-annotation-id` in Custom Snippet

**Problem:** When using custom segment snippet, forgetting required attributes breaks sync.

```svelte
<!-- WRONG: Missing data-annotation-id -->
{#snippet segment({ annotation, isActive, onClick })}
  <button onclick={onClick}>
    {annotation.text}
  </button>
{/snippet}
```

**Why it breaks:** SyncController uses `data-annotation-id` to find elements in DOM for auto-scrolling.

**Fix:**
```svelte
<!-- CORRECT: Include required attributes -->
{#snippet segment({ annotation, isActive, onClick })}
  <button
    data-annotation-id={annotation.id}
    onclick={onClick}
  >
    {annotation.text}
  </button>
{/snippet}
```

---

### ❌ Pitfall 2: Unsorted Annotations

**Problem:** Annotations passed in random order cause incorrect active segment detection.

```typescript
// WRONG: Unsorted
const annotations = [
  { id: 'seg-3', startTime: 10, endTime: 15, text: '...' },
  { id: 'seg-1', startTime: 0, endTime: 5, text: '...' },
  { id: 'seg-2', startTime: 5, endTime: 10, text: '...' }
];
```

**Why it breaks:** SyncController expects annotations in chronological order for binary search.

**Fix:**
```typescript
// CORRECT: Sort by startTime
const annotations = [...unsortedAnnotations].sort((a, b) => a.startTime - b.startTime);

<TranscriptPanel {annotations} {viewer} />
```

---

### ❌ Pitfall 3: Forgetting `bind:this` on Viewer

**Problem:** Viewer ref is undefined, sync doesn't initialize.

```svelte
<!-- WRONG: No bind:this -->
<IIIFMediaViewer {manifestUrl} />
<TranscriptPanel {annotations} {viewer} />
<!-- viewer is undefined! -->
```

**Fix:**
```svelte
<!-- CORRECT: Bind viewer reference -->
<script>
  let viewer;
</script>

<IIIFMediaViewer bind:this={viewer} {manifestUrl} />
<TranscriptPanel {annotations} {viewer} />
```

---

### ❌ Pitfall 4: Duplicate Annotation IDs

**Problem:** Multiple annotations with same ID cause unpredictable behavior.

```typescript
// WRONG: Duplicate IDs
const annotations = [
  { id: 'seg-1', startTime: 0, endTime: 5, text: 'First' },
  { id: 'seg-1', startTime: 5, endTime: 10, text: 'Second' } // ❌ Duplicate!
];
```

**Why it breaks:** DOM queries return first match, second segment is inaccessible.

**Fix:**
```typescript
// CORRECT: Unique IDs
const annotations = [
  { id: 'seg-1', startTime: 0, endTime: 5, text: 'First' },
  { id: 'seg-2', startTime: 5, endTime: 10, text: 'Second' }
];
```

---

### ❌ Pitfall 5: Invalid Time Values

**Problem:** Negative, NaN, or invalid times cause sync failures.

```typescript
// WRONG: Invalid times
const annotations = [
  { id: 'seg-1', startTime: -5, endTime: 0, text: '...' }, // Negative!
  { id: 'seg-2', startTime: 5, endTime: 3, text: '...' }   // End before start!
];
```

**Fix:**
```typescript
// CORRECT: Validate times
function validateAnnotation(ann: Annotation): boolean {
  return (
    ann.startTime >= 0 &&
    ann.endTime > ann.startTime &&
    Number.isFinite(ann.startTime) &&
    Number.isFinite(ann.endTime)
  );
}

const validAnnotations = annotations.filter(validateAnnotation);
```

---

### ❌ Pitfall 6: Search Without `enableSearch`

**Problem:** Search component not showing, users confused.

```svelte
<!-- WRONG: Search UI won't appear -->
<TranscriptPanel {annotations} {viewer} />
```

**Fix:**
```svelte
<!-- CORRECT: Enable search explicitly -->
<TranscriptPanel {annotations} {viewer} enableSearch />
```

Search is opt-in to keep bundle size small for users who don't need it.

---

## Security Considerations

### HTML in Annotation Text

Annotation `text` is rendered directly into the DOM. If annotations come from untrusted sources (user input, external APIs), sanitize before passing to components:

```typescript
import DOMPurify from 'dompurify';

// Sanitize untrusted annotation text
const sanitizedAnnotations = annotations.map(ann => ({
  ...ann,
  text: DOMPurify.sanitize(ann.text, { ALLOWED_TAGS: [] }) // Strip all HTML
}));

<TranscriptPanel annotations={sanitizedAnnotations} {viewer} />
```

**When to sanitize:**
- ✅ Annotations from user uploads (WebVTT, SRT)
- ✅ Annotations from external APIs
- ✅ Annotations from untrusted sources

**When sanitization is NOT needed:**
- ✅ Annotations from curated IIIF manifests (institution-controlled)
- ✅ Annotations from your own database (already validated)
- ✅ Hard-coded annotations in source code

**XSS Risk Example:**
```typescript
// DANGEROUS: User-uploaded WebVTT with malicious content
const annotations = [
  {
    id: 'evil',
    startTime: 0,
    endTime: 5,
    text: '<img src=x onerror="alert(document.cookie)">' // XSS attack!
  }
];
```

If you control the annotation source (typical for IIIF use cases), sanitization is unnecessary overhead.

---

## Edge Cases & Data Validation

### Handling Invalid or Malformed Data

The components expect well-formed annotations. Here's how the library handles edge cases:

#### Empty or Null Data

```typescript
// Empty annotations array
<TranscriptPanel annotations={[]} {viewer} />
// Result: Shows empty state snippet (default: "No transcript available")

// Null/undefined viewer (static mode)
<TranscriptPanel {annotations} viewer={null} />
// Result: Transcript renders, no sync behavior
```

#### Unsorted Annotations

**Behavior:** Components use binary search for performance. Unsorted annotations cause incorrect active segment detection.

```typescript
// ❌ WRONG: Random order
const annotations = [
  { id: 'c', startTime: 10, endTime: 15, text: 'Third' },
  { id: 'a', startTime: 0, endTime: 5, text: 'First' },
  { id: 'b', startTime: 5, endTime: 10, text: 'Second' }
];

// ✅ CORRECT: Sort before passing
const sortedAnnotations = [...annotations].sort((a, b) => a.startTime - b.startTime);
<TranscriptPanel annotations={sortedAnnotations} {viewer} />
```

#### Duplicate IDs

**Behavior:** DOM queries return first match only. Duplicates are inaccessible.

```typescript
// ❌ WRONG: Same ID used twice
const annotations = [
  { id: 'seg-1', startTime: 0, endTime: 5, text: 'A' },
  { id: 'seg-1', startTime: 5, endTime: 10, text: 'B' } // Unreachable!
];

// ✅ CORRECT: Ensure unique IDs
const annotations = rawData.map((item, idx) => ({
  ...item,
  id: item.id || `auto-${idx}` // Generate if missing
}));
```

#### Invalid Time Values

**Behavior:** Components clamp negative times to 0, ignore NaN/Infinity, skip annotations where `endTime <= startTime`.

```typescript
// ❌ PROBLEMATIC: Invalid times
const annotations = [
  { id: 'neg', startTime: -10, endTime: 5, text: '...' },    // Clamped to 0
  { id: 'nan', startTime: NaN, endTime: 10, text: '...' },   // Skipped
  { id: 'inv', startTime: 10, endTime: 5, text: '...' }      // Skipped (end < start)
];

// ✅ CORRECT: Validate before passing
function isValidAnnotation(ann: Annotation): boolean {
  return (
    typeof ann.id === 'string' &&
    Number.isFinite(ann.startTime) &&
    Number.isFinite(ann.endTime) &&
    ann.startTime >= 0 &&
    ann.endTime > ann.startTime
  );
}

const validAnnotations = rawAnnotations.filter(isValidAnnotation);
<TranscriptPanel annotations={validAnnotations} {viewer} />
```

#### Overlapping Annotations

**Behavior:** When multiple annotations cover the same time, **earliest-starting annotation wins**. If tied, first in array is active.

```typescript
// Overlapping case
const annotations = [
  { id: 'a', startTime: 0, endTime: 10, text: 'Background music' },
  { id: 'b', startTime: 5, endTime: 8, text: 'Speaker 1' }
];

// At time=6s: annotation 'a' is active (started earlier)
```

If you need multi-track support (e.g., speaker + sound effects), use separate `<TranscriptPanel>` instances.

#### Missing Required Properties

**Behavior:** TypeScript prevents this at compile time. At runtime:
- Missing `id`: Element not found, sync broken
- Missing `startTime`/`endTime`: Treated as 0, likely skipped
- Missing `text`: Renders empty segment

**Best practice:** Use a schema validator (Zod, Yup) for runtime data:

```typescript
import { z } from 'zod';

const AnnotationSchema = z.object({
  id: z.string().min(1),
  startTime: z.number().min(0),
  endTime: z.number(),
  text: z.string()
}).refine(ann => ann.endTime > ann.startTime, {
  message: 'endTime must be greater than startTime'
});

// Validate before use
const validated = rawAnnotations
  .map(ann => AnnotationSchema.safeParse(ann))
  .filter(result => result.success)
  .map(result => result.data);
```

#### Annotations with Gaps

**Behavior:** Gaps in timeline are expected. When video time is between annotations, no segment is active.

```typescript
// Annotations with 5-second gap
const annotations = [
  { id: 'a', startTime: 0, endTime: 5, text: 'Hello' },
  { id: 'b', startTime: 10, endTime: 15, text: 'World' } // Gap: 5-10s
];

// At time=7s: No active segment (expected behavior)
```

---

## Examples

### Example 1: Minimal (Default Rendering)

```svelte
<IIIFMediaViewer bind:this={viewer} {manifestUrl} />
<TranscriptPanel {annotations} {viewer} />
```

### Example 2: With Search

```svelte
<TranscriptPanel {annotations} {viewer} enableSearch />
```

### Example 3: Custom Segment Rendering

```svelte
<TranscriptPanel {annotations} {viewer}>
  {#snippet segment({ annotation, isActive, onClick })}
    <button
      data-annotation-id={annotation.id}
      onclick={onClick}
      class="segment"
      class:highlight={isActive}
    >
      <span class="speaker">{annotation.speaker}</span>
      <span class="time">{formatTime(annotation.startTime)}</span>
      <p class="text">{annotation.text}</p>
    </button>
  {/snippet}
</TranscriptPanel>

<style>
  .segment { padding: 1rem; cursor: pointer; }
  .segment.highlight { background: yellow; }
  .speaker { font-weight: bold; }
  .time { color: #666; font-size: 0.875rem; }
</style>
```

### Example 4: Static Transcript (No Video)

```svelte
<TranscriptPanel {annotations} viewer={null} enableSearch />
```

## Related Components

- **IIIFMediaViewer** – IIIF-powered media viewer (required for sync)
- **SyncController** – Lower-level sync API (used internally by Panel)

## TypeScript Support

Full TypeScript definitions are included. The library exports all necessary types for type-safe usage.

### Basic Type Usage

```typescript
import type {
  Annotation,
  IIIFMediaViewerRef,
  SyncConfig
} from '@umd-mith/svelte-iiif-transcript-player';

// Type-safe annotation array
const annotations: Annotation[] = [
  { id: 'seg-1', startTime: 0, endTime: 5, text: 'Hello' },
  { id: 'seg-2', startTime: 5, endTime: 10, text: 'World' }
];

// Type-safe viewer reference
let viewer: IIIFMediaViewerRef | null = null;
```

### Component Props Types

All components export their props types:

```typescript
import type { Props as TranscriptPanelProps } from '@umd-mith/svelte-iiif-transcript-player/transcript/Panel.svelte';
import type { Props as SearchProps } from '@umd-mith/svelte-iiif-transcript-player/transcript/Search.svelte';

// Use in wrappers or higher-order components
interface MyWrapperProps extends Partial<TranscriptPanelProps> {
  title: string;
  theme: 'light' | 'dark';
}
```

### Type-Safe Data Fetching

```typescript
import type { Annotation } from '@umd-mith/svelte-iiif-transcript-player';

// Fetch annotations from API
async function fetchTranscript(videoId: string): Promise<Annotation[]> {
  const response = await fetch(`/api/transcripts/${videoId}`);
  const data = await response.json();

  // Type assertion with validation
  return data.map((item: unknown): Annotation => {
    if (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'startTime' in item &&
      'endTime' in item &&
      'text' in item
    ) {
      return item as Annotation;
    }
    throw new Error('Invalid annotation format');
  });
}
```

### Custom Segment Props with TypeScript

When extending the annotation type for custom metadata:

```typescript
import type { Annotation } from '@umd-mith/svelte-iiif-transcript-player';

// Extend base annotation type
interface ExtendedAnnotation extends Annotation {
  speaker?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// Type-safe in component
<script lang="ts">
  import { TranscriptPanel } from '@umd-mith/svelte-iiif-transcript-player';
  import type { IIIFMediaViewerRef } from '@umd-mith/svelte-iiif-transcript-player';

  let viewer: IIIFMediaViewerRef | null = null;
  const annotations: ExtendedAnnotation[] = [
    {
      id: 'seg-1',
      startTime: 0,
      endTime: 5,
      text: 'Hello',
      speaker: 'Alice',
      confidence: 0.95
    }
  ];
</script>

<TranscriptPanel {annotations} {viewer}>
  {#snippet segment({ annotation, isActive, onClick })}
    <button
      data-annotation-id={annotation.id}
      onclick={onClick}
    >
      {#if annotation.speaker}
        <strong>{annotation.speaker}:</strong>
      {/if}
      {annotation.text}
      {#if annotation.confidence && annotation.confidence < 0.8}
        <span class="low-confidence">(?)</span>
      {/if}
    </button>
  {/snippet}
</TranscriptPanel>
```

### Type Guards for Runtime Safety

```typescript
import type { Annotation } from '@umd-mith/svelte-iiif-transcript-player';

function isAnnotation(value: unknown): value is Annotation {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'startTime' in value &&
    typeof value.startTime === 'number' &&
    'endTime' in value &&
    typeof value.endTime === 'number' &&
    'text' in value &&
    typeof value.text === 'string'
  );
}

// Use type guard
const rawData: unknown[] = await fetchFromAPI();
const validAnnotations = rawData.filter(isAnnotation);
// validAnnotations is now typed as Annotation[]
```

---

## Browser Compatibility

The library is designed for modern browsers and requires the following features:

### Minimum Browser Versions

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| **Chrome** | 92+ | Full support including media sync |
| **Edge** | 92+ | Chromium-based versions only |
| **Firefox** | 90+ | Full support |
| **Safari** | 15.4+ | Requires iOS 15.4+ for mobile |
| **Opera** | 78+ | Chromium-based versions |

### Required JavaScript Features

The library uses modern JavaScript features without polyfills:

- **ES2022 Syntax**
  - `Array.prototype.at()` – Used in sync algorithms for reverse lookups
  - `Object.hasOwn()` – Used for property checks
  - Top-level `await` in modules

- **ES2021+**
  - Logical assignment operators (`??=`, `||=`)
  - Numeric separators

- **Svelte 5 Runtime**
  - Requires runes support (`$state`, `$derived`, `$effect`)
  - Snippets for customization

### Feature Detection

If you need to support older browsers, check for required features:

```typescript
function isBrowserSupported(): boolean {
  return (
    // Check Array.at() support
    typeof Array.prototype.at === 'function' &&
    // Check for modern event handling
    typeof AbortController === 'function' &&
    // Check for requestAnimationFrame (sync smoothness)
    typeof requestAnimationFrame === 'function'
  );
}

// Conditional rendering
{#if isBrowserSupported()}
  <TranscriptPanel {annotations} {viewer} />
{:else}
  <p>Your browser does not support this transcript player. Please upgrade to a modern browser.</p>
{/if}
```

### Known Limitations

#### Safari < 15.4
- Missing `Array.at()` support – causes runtime errors in sync calculations
- **Workaround:** Include core-js polyfill:
  ```bash
  npm install core-js
  ```
  ```typescript
  import 'core-js/actual/array/at';
  ```

#### Internet Explorer 11
- **Not supported** – IE11 lacks ES6+ features and Svelte 5 is not compatible
- No workarounds available – users must upgrade to modern browser

#### Mobile Browsers
- **iOS Safari 15.4+** required (iOS 15.3 and below lack `Array.at()`)
- **Android Chrome 92+** recommended
- Touch events fully supported for segment selection
- Mobile viewport considerations: Use `height: 100dvh` for dynamic viewport units

### Media Format Compatibility

The transcript components sync with media playback. Ensure your IIIF manifest serves compatible formats:

| Format | Chrome/Edge | Firefox | Safari |
|--------|-------------|---------|--------|
| **MP4 (H.264)** | ✅ | ✅ | ✅ |
| **WebM (VP9)** | ✅ | ✅ | ❌ |
| **MP3** | ✅ | ✅ | ✅ |
| **AAC** | ✅ | ✅ | ✅ |

**Best practice:** Provide MP4 with H.264 codec for maximum compatibility.

### Accessibility Features

All accessibility features are supported in modern browsers:

- **ARIA live regions** – Announces active segment to screen readers
- **Keyboard navigation** – Arrow keys, Enter, focus management
- **High contrast mode** – Respects OS preferences via data attributes
- **Reduced motion** – Honors `prefers-reduced-motion` (disable auto-scroll via CSS)

### Testing Your Setup

```typescript
// Check if critical features are available
console.assert(typeof Array.prototype.at === 'function', 'Array.at() required');
console.assert(typeof requestAnimationFrame === 'function', 'RAF required for sync');

// Test media format support
const video = document.createElement('video');
const canPlayMP4 = video.canPlayType('video/mp4; codecs="avc1.42E01E"');
console.log('MP4 support:', canPlayMP4); // "probably" or "maybe" = supported
```

---

## License

MIT © Maryland Institute for Technology in the Humanities

---

## Contributing

Issues and pull requests are welcome at the [GitHub repository](https://github.com/umd-mith/svelte-iiif-transcript-player).
