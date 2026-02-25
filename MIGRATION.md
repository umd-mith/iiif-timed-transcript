# Migration from Lakeland Archive

This library extracts transcript and media player functionality from Lakeland Archive into a reusable OSS package. This guide helps Lakeland developers migrate to the packaged version.

## Overview

**Extraction Timeline:**
- LDA-1964: IIIF utilities
- LDA-1965: MediaPlayer and IIIFMediaViewer components
- LDA-1967: Transcript components (Panel, Search, Segment)
- LDA-1968: Bidirectional sync system

## Component Mapping

| Lakeland Archive | This Library | Status |
|------------------|--------------|--------|
| `src/lib/components/MediaPlayer.svelte` | `MediaPlayer` | ✅ Extracted |
| `src/lib/components/IIIFMediaViewer.svelte` | `IIIFMediaViewer` | ✅ Extracted |
| `src/lib/components/transcript/Panel.svelte` | `TranscriptPanel` | ✅ Extracted |
| `src/lib/components/transcript/Search.svelte` | `TranscriptSearch` | ✅ Extracted |
| `src/lib/components/transcript/Segment.svelte` | `TranscriptSegment` | ✅ Extracted |
| `src/lib/sync/SyncController.svelte.ts` | `SyncController` | ✅ Extracted (now public API) |
| `src/lib/iiif/helpers.ts` | IIIF helper functions | ✅ Extracted |
| `src/lib/iiif/validators.ts` | IIIF Zod schemas | ✅ Extracted |
| `src/lib/iiif/cache.ts` | `IIIFManifestCache` | ✅ Extracted |

## Breaking Changes

### 1. Sync Configuration Moved to Props

**Before (Lakeland - via context):**
```svelte
<TranscriptContext
  syncDebounceMs={200}
  syncSettleMs={150}
>
  <TranscriptPanel {annotations} {viewer} />
</TranscriptContext>
```

**After (Library - via props):**
```svelte
<TranscriptPanel
  {annotations}
  {viewer}
  syncDebounceMs={200}
  syncSettleMs={150}
/>
```

**Rationale:** Simpler API without context overhead.

---

### 2. Search is Now Opt-In

**Before (Lakeland):**
```svelte
<TranscriptPanel {annotations} {viewer} />
<!-- Search was always enabled -->
```

**After (Library):**
```svelte
<TranscriptPanel {annotations} {viewer} enableSearch />
```

**Rationale:** Not all use cases need search. Opt-in reduces bundle size.

---

### 3. No Default Styling

**Before (Lakeland):**
- Components came with Lakeland theme (brutalist design, brand colors)
- CSS was bundled

**After (Library):**
- Unstyled primitives
- Style via data attributes: `[data-annotation-id]`, `[data-state="active"]`
- Consumers provide their own styles

**Rationale:** Library shouldn't enforce design opinions.

**Migration Path:**
```css
/* Copy relevant styles from Lakeland's transcript.css */
[data-annotation-id] {
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}

[data-state="active"] {
  background: #f0f0f0;
  font-weight: bold;
}
```

---

### 4. SyncController is Now Public API

**Before (Lakeland):**
- SyncController was internal implementation detail
- Never instantiated directly by consumers

**After (Library):**
- Exported as public API
- Advanced users can use directly for custom transcript UIs

**Impact:** None for basic usage (TranscriptPanel still creates controller internally)

---

### 5. Context API Removed

**Before (Lakeland):**
- Had `createTranscriptContext()` and `getTranscriptContext()` for compound components

**After (Library):**
- Context API removed (was unused even in Lakeland)
- Use Snippet API instead for customization

**Migration Path:**
If you were using context (unlikely), switch to snippets:

```svelte
<TranscriptPanel {annotations} {viewer}>
  {#snippet segment({ annotation, isActive, onClick })}
    <button data-annotation-id={annotation.id} onclick={onClick}>
      {annotation.text}
    </button>
  {/snippet}
</TranscriptPanel>
```

---

## Installation

```bash
pnpm add @umd-mith/svelte-iiif-transcript-player
```

## Step-by-Step Migration

### Step 1: Update Imports

**Before:**
```typescript
import MediaPlayer from '$lib/components/MediaPlayer.svelte';
import IIIFMediaViewer from '$lib/components/IIIFMediaViewer.svelte';
import TranscriptPanel from '$lib/components/transcript/Panel.svelte';
import { SyncController } from '$lib/sync/SyncController.svelte';
import { getLabel, getThumbnail } from '$lib/iiif/helpers';
```

**After:**
```typescript
import {
  MediaPlayer,
  IIIFMediaViewer,
  TranscriptPanel,
  SyncController,
  getLabel,
  getThumbnail
} from '@umd-mith/svelte-iiif-transcript-player';
```

---

### Step 2: Update Component Usage

**Before (Lakeland with context):**
```svelte
<script>
  import { TranscriptContext } from '$lib/components/transcript/context';

  let viewer;
  const annotations = [...];
</script>

<IIIFMediaViewer bind:this={viewer} {manifestUrl} />

<TranscriptContext syncDebounceMs={200}>
  <TranscriptPanel {annotations} {viewer} />
</TranscriptContext>
```

**After (Library with props):**
```svelte
<script>
  import { IIIFMediaViewer, TranscriptPanel } from '@umd-mith/svelte-iiif-transcript-player';

  let viewer;
  const annotations = [...];
</script>

<IIIFMediaViewer bind:this={viewer} {manifestUrl} />
<TranscriptPanel {annotations} {viewer} syncDebounceMs={200} enableSearch />
```

---

### Step 3: Add Styles

The library ships unstyled. Copy relevant styles from Lakeland's `transcript.css`:

```css
/* Basic transcript styles */
.transcript-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.segments-container {
  flex: 1;
  overflow-y: auto;
}

[data-annotation-id] {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}

[data-annotation-id]:hover {
  background: var(--color-bg-hover);
}

[data-state="active"] {
  background: var(--color-primary-bg);
  border-left: 3px solid var(--color-primary);
  font-weight: 500;
}

[data-state="inactive"] {
  opacity: 0.7;
}
```

---

### Step 4: Update Tests

**Before (testing internal components):**
```typescript
import Panel from '$lib/components/transcript/Panel.svelte';
```

**After (testing library exports):**
```typescript
import { TranscriptPanel } from '@umd-mith/svelte-iiif-transcript-player';
```

Test behavior remains the same.

---

## Feature Parity

| Feature | Lakeland | Library | Notes |
|---------|----------|---------|-------|
| Bidirectional sync | ✅ | ✅ | Same XState-based implementation |
| Search | ✅ (always on) | ✅ (opt-in) | Add `enableSearch` prop |
| Custom segments | ✅ (slots) | ✅ (snippets) | Svelte 5 pattern |
| Keyboard navigation | ✅ | ✅ | Arrow keys, Enter |
| IIIF manifest loading | ✅ | ✅ | Same cache + validation |
| Static mode | ✅ | ✅ | `viewer={null}` |
| Fullscreen | 🚧 | 🚧 | Coming in Part 4 |

## TypeScript Support

Fully typed. Import types as needed:

```typescript
import type {
  Annotation,
  IIIFMediaViewerRef,
  SyncConfig,
  ManifestData
} from '@umd-mith/svelte-iiif-transcript-player';
```

## Performance

No performance regressions expected:
- Same XState state machine
- Same polling interval (100ms)
- Same debounce timings
- Slightly smaller bundle (no Lakeland-specific code)

## Rollback Plan

If migration issues arise:

1. **Keep both versions temporarily:**
   ```typescript
   // Old Lakeland import (aliased)
   import LakelandPanel from '$lib/components/transcript/Panel.svelte';

   // New library import
   import { TranscriptPanel } from '@umd-mith/svelte-iiif-transcript-player';
   ```

2. **Feature flag:**
   ```svelte
   {#if USE_LIBRARY_VERSION}
     <TranscriptPanel {annotations} {viewer} enableSearch />
   {:else}
     <LakelandPanel {annotations} {viewer} />
   {/if}
   ```

3. **Gradual rollout:**
   - Migrate one route at a time
   - Test each route in staging
   - Roll back specific routes if needed

## Common Issues

### Issue: "Cannot find module '@umd-mith/svelte-iiif-transcript-player'"

**Solution:** Install the package:
```bash
pnpm add @umd-mith/svelte-iiif-transcript-player
```

---

### Issue: Sync not working after migration

**Checklist:**
- [ ] `bind:this={viewer}` on IIIFMediaViewer?
- [ ] Annotations have `id`, `startTime`, `endTime`, `text`?
- [ ] Annotations sorted by `startTime`?
- [ ] Viewer passed to TranscriptPanel?

---

### Issue: Styles look broken

**Solution:** Library is unstyled. Copy styles from Lakeland's `transcript.css` or write custom styles using data attributes.

---

### Issue: Search not showing

**Solution:** Add `enableSearch` prop:
```svelte
<TranscriptPanel {annotations} {viewer} enableSearch />
```

---

## Questions?

1. Check this migration guide
2. Review [TRANSCRIPT_COMPONENTS.md](./TRANSCRIPT_COMPONENTS.md) for API reference
3. Ask in #lakeland-archive channel
4. File an issue: https://github.com/umd-mith/svelte-iiif-transcript-player/issues

## Timeline

**Recommended migration schedule:**

- **Week 1:** Install package, update imports, verify builds
- **Week 2:** Migrate one low-traffic route, test in staging
- **Week 3:** Migrate remaining routes, monitor production
- **Week 4:** Remove old Lakeland components, clean up imports

**Estimated effort:** 8-13 story points for full Lakeland migration
