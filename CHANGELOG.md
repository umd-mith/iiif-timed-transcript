# @umd-mith/svelte-iiif-transcript-player

## 0.11.0

### Breaking Changes

- **Remove sync internals from public API** — `SyncController`, `IIIFMediaViewerRef`, `SyncContext`, `SyncEvent`, `SyncPriority`, `SyncConfig`, and `DEFAULT_SYNC_CONFIG` are no longer exported. These were internal to the sync layer and only consumed by `Transcript.svelte`. Use `PlayerRef` and `tryGetPlayerContext()` for external player control (#32)

### Retained Exports

- `Annotation` type, `getActiveAnnotation`, `timeToScrollProgress`, `scrollProgressToTime` remain available as standalone utilities

## 0.10.0

### Minor Changes

- **Export `SegmentAttrs` type** — consumers building custom segment renderers can now import `SegmentAttrs` directly instead of using `SegmentSnippetProps['segmentAttrs']` indexed access (#30)

### Patch Changes

- **Fix unhandled `play()` rejections** — `actions.play()` now catches `NotAllowedError` (autoplay policy) and routes it through `state.error`, consistent with existing error paths. Benign `AbortError` (play interrupted by pause/seek) is silently ignored (#28)

## 0.9.0

### Minor Changes

- **`onPlayerInit` callback and `PlayerRef` type** — new callback fires after manifest fetch and first canvas parse, providing a curated `PlayerRef` handle for external orchestration (state, actions, annotations, chapters, canvas info) without exposing internal implementation details (#26)
- **`tryGetPlayerContext()` utility** — returns `null` instead of throwing when used outside `IIIFPlayer.Root`, enabling dual-mode components that work with or without the player context (#24)

### Patch Changes

- Remove dead `Panel.svelte` and its tests (superseded by compound component API)
- Fix `Search.svelte` double-firing `onmatchchange` on navigation
- Switch `annotations`, `chapters`, `tracks` to `$state.raw` for reduced proxy overhead
- Remove redundant `xstate` from `devDependencies`
- Add Search navigation and callback test coverage (#27)

## 0.7.0

### Minor Changes

- **Segment extension points** — consumers can now fully customize segment rendering via a `segment` snippet prop, which receives annotation data and a `segmentAttrs` spread object for pit-of-success correctness (a11y, keyboard nav, click handling included by default) (#22)
- **`onkeydown` extensibility** — new `onkeydown` prop on TranscriptSegments fires before built-in navigation with full annotation context; call `preventDefault()` to suppress built-in arrow/Home/End nav
- **`highlightedAnnotationId` prop** — supports deep-link highlighting that merges cleanly with search highlights
- **`scrollToAnnotation` imperative API** — accepts optional `ScrollIntoViewOptions` and respects `prefers-reduced-motion` by default; wired through TranscriptContext
- **Roving tabindex refactored to `$derived`** — replaced `$effect`-based focusedIndex with synchronous `$derived` clamping, eliminating render frames with missing tabindex

### Patch Changes

- Input-element guard prevents keyboard nav from hijacking typing in inputs, textareas, and contenteditable elements inside the segments container
- `keyboardNav.ts` `getNextIndex` now returns `null` (instead of current index) for unrecognized keys

## 0.6.1

### Patch Changes

- - Use version-agnostic placeholders in README install examples
  - Fix type inconsistency in test-utils `createContextCapture` cast
  - Add XSS sanitization caution to `text` snippet JSDoc in Segment and TranscriptSegments

## 0.6.0

### Minor Changes

- ### Features
  - Implement `initialTime` and `autoplay` props in Root — previously accepted but ignored, now functional (#21)
  - Wire `annotations` prop through PlayerContext so Root can pass annotations to Transcript children (#20)
  - Render annotation text as HTML in Segment component (#18)
  - Publish to GitHub Packages with `prepare` build script

  ### Housekeeping
  - Update README with GitHub Packages installation instructions
  - Remove unused `phosphor-svelte` dependency (#19)
  - Fix CI to run `svelte-kit sync` before typecheck
