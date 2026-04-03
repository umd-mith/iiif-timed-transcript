# @umd-mith/svelte-iiif-transcript-player

## 0.13.1

### Patch Changes

- ffefd18: Fix regression: treat MEDIA_ERR_DECODE as transient when metadata already loaded

  MEDIA_ERR_DECODE (code 3) can fire transiently during initial buffering of large files.
  If the media element already has a valid duration, the decode error is a false alarm.
  Previously this permanently blocked playback, breaking large WAV files that played fine in 0.12.0.

## 0.13.0

### Minor Changes

- 4aefbe5: Add customizable labels to PlayButton via `play`, `pause`, and `loading` props that accept a string or Svelte snippet

### Patch Changes

- **Fix overlapping annotation lookup** — replace binary search with linear scan + narrowest-span tiebreaker in `getActiveAnnotation`. Fixes wrong segment highlighting for speaker diarization data with overlapping timestamps (#40)
- **Document roving tabindex pattern** — explain focus management in `segmentAttrs` to prevent `aria-activedescendant` conflicts (#41)
- **Wire native media error handling** — add `onerror` handlers to `<audio>`/`<video>` elements with user-friendly error messages. Remove duplicate error handler from Root.svelte. Filter `MEDIA_ERR_ABORTED` during canvas switching (#43)
- **Log non-fatal HLS errors** — non-fatal HLS errors now emit `console.warn` instead of being silently swallowed

## 0.12.0

### Breaking Changes

- **Remove `role="button"` from `SegmentAttrs`** — default segments now render as `<div>` instead of `<button>`, with Enter/Space key activation added for accessibility. Consumers using the `segment` snippet who spread `segmentAttrs` no longer receive `role: "button"`. Update CSS selectors from `button[data-annotation-id]` to `[data-annotation-id]` (#31)

### Patch Changes

- **Comprehensive README revision** — fix 14 factual errors, document Chapters and CanvasNav components, add PlayerContext/PlayerRef type references, correct children snippet fields (#36)
- **Update demo CSS selectors** — all demo components and walkthrough updated to use element-agnostic `[data-annotation-id]` selectors (#33)
- **Add HistoryUnErasedDemo** — new demo component showcasing custom segment snippets with `segmentAttrs` spread

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
