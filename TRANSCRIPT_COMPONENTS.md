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

Full TypeScript definitions are included:

```typescript
import type {
  Annotation,
  IIIFMediaViewerRef,
  SyncConfig
} from '@umd-mith/svelte-iiif-transcript-player';
```
