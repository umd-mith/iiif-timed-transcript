# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries below version `0.15.0` retain the `Minor Changes` / `Patch Changes` /
`Breaking Changes` groupings from the project's earlier changesets-based workflow.

## [Unreleased]

### Added

- 504a892: `IIIFPlayer.Root` gains `annotations="auto"`: transcript annotations are built from the manifest — embedded `TextualBody` annotations (motivation `supplementing`, `commenting`, or `tagging`) first, else — only when those yield nothing — the canvas's external WebVTT `supplementing` track, fetched on demand with `media-captions` (now a runtime dependency). New `onError(error, { fatal, source })` prop; `transcriptStatus` on the player context, `PlayerRef`, and the children snippet. `IIIFPlayer.Transcript` gains an optional `loading` snippet that replaces the built-in "Loading transcript…" affordance. `getSupplementaryVTTTracks` now finds VTT tracks inside `Choice` bodies and de-duplicates by `src`; `ExternalResourceSchema` keeps `label`/`language` (tolerantly). New public exports: `selectTranscriptTrack`, `loadVTTTranscript`, `buildAnnotationsFromVTTCues`, `vttCueToPlainText`, and the types `VTTCueTokenizer`, `TranscriptStatus`, `PlayerErrorSource`, `PlayerErrorInfo`. (#58)
- d42fa68: New `<iiif-transcript-player>` custom element for pages without a Svelte build: `@umd-mith/svelte-iiif-transcript-player/element` (ESM, `register()`) and `…/element/iife` (`<script src>`, hls.js bundled — a classic script that installs `window.IIIFTranscriptPlayer`, not a module). Attributes `manifest-url`, `canvas-index` (reflected), `initial-time`, `autoplay`; properties `annotations`, `preprocessManifest`, `errorCallback`, `playerRef`; events `playerrefavailable`, `playererror` (`{ error, fatal, source }`), `canvaschange`; custom-property theming. Host inputs are validated and reported as non-fatal `source: "host"` errors instead of failing silently; clearing `manifest-url` unmounts the player; re-connecting a detached element rebuilds the player and fires `playerrefavailable` again, applying `initial-time` only on the first connection. Core changes: `getPrimaryResource` resolves `Choice` bodies (first Sound/Video); `IIIFPlayer.Root` gains `preprocessManifest` (bypasses the manifest cache when set) and ignores a non-integer `switchCanvas` index; IIIF Auth API 1 service references (`@type`/`@id`) are tolerated, so `service[].type` is now optional. (#59)

### Changed

- 504a892: A captioned video whose transcript panel is populated no longer starts with captions showing — every attached track is set to `hidden` once per canvas and never written again (pass `tracks` explicitly to opt out); the tracks stay attached and can be re-enabled from the browser's native caption menu when `Viewer` is given `controls`. A missing `hls.js`/`dashjs` still logs a console warning and now also surfaces as a player error (`state.error` plus `onError` with `source: "media"`). `buildTranscriptAnnotations` now guarantees unique annotation ids when a manifest reuses one id more than twice. (#58)

### Fixed

- 95bc3f8: Transcript auto-scroll no longer fires on load: the sync controller does not drive media-driven scrolling until playback has actually advanced the time, so the page no longer jumps to the transcript before the user presses play. (#55, #57)

## [0.15.0] - 2026-06-02

### Minor Changes

- 2c60daf: Add poster image support for video canvases. `IIIFPlayer.Viewer` now accepts a `poster` prop (passed to the native `<video poster>` attribute), and when omitted the poster is auto-derived from the IIIF manifest's `placeholderCanvas`, falling back to `accompanyingCanvas`. A new `getPosterUrl(canvas)` helper is exported for resolving a canvas's poster URL directly.

### Patch Changes

- 7718317: Accessibility: the default transcript segment now exposes `role="button"` (it already had click/keyboard activation and `aria-current`). The segments container is a labelled `role="group"` — read-first semantics, since a transcript is primarily readable text rather than a row of action controls — and its roving-tabindex arrow-key navigation remains as a progressive keyboard enhancement. Resolves the `a11y_no_static_element_interactions` and `a11y_no_noninteractive_tabindex` warnings; the container's keydown handler carries a scoped `svelte-ignore` for `a11y_no_noninteractive_element_interactions`. The custom-segment `segmentAttrs` API is unchanged (still role-free — consumers own their element semantics).

## [0.14.1] - 2026-04-21

### Patch Changes

- 03643c9: Add explicit `.js` / `/index.js` extensions to all internal relative imports so the package's `dist/` output conforms to the Node ESM spec (directory imports and extensionless specifiers are not permitted in Node ESM).

  This fixes `ERR_UNSUPPORTED_DIR_IMPORT` and `ERR_MODULE_NOT_FOUND` errors seen when the package is resolved by Node's native resolver — for example during Astro SSR prerendering, or when another Vite plugin (such as `@tailwindcss/vite` v4, which transitively registers a Node ESM loader hook via `@tailwindcss/node`) forwards resolution to Node's defaults.

  No API changes. Consumers using `ssr.noExternal: ['@umd-mith/svelte-iiif-transcript-player']` in their Vite/Astro config remain the recommended pattern for SSR contexts.

## [0.14.0] - 2026-04-09

### Minor Changes

- b2c42d5: BREAKING: `buildTranscriptAnnotations()` now returns `{ annotations, skipped }` instead of `Annotation[]`. Annotations without temporal fragments are skipped with structured diagnostics instead of silently defaulting to time 0. Also adds support for AVAnnotate point-in-time annotations (`#t=95,95`) via iiif-media-parsers 0.3.2.

### Patch Changes

- ffefd18: Fix regression: treat MEDIA_ERR_DECODE as transient when metadata already loaded

  MEDIA_ERR_DECODE (code 3) can fire transiently during initial buffering of large files.
  If the media element already has a valid duration, the decode error is a false alarm.
  Previously this permanently blocked playback, breaking large WAV files that played fine in 0.12.0.

## [0.13.1] - 2026-04-03

### Patch Changes

- ffefd18: Fix regression: treat MEDIA_ERR_DECODE as transient when metadata already loaded

  MEDIA_ERR_DECODE (code 3) can fire transiently during initial buffering of large files.
  If the media element already has a valid duration, the decode error is a false alarm.
  Previously this permanently blocked playback, breaking large WAV files that played fine in 0.12.0.

## [0.13.0] - 2026-04-03

### Minor Changes

- 4aefbe5: Add customizable labels to PlayButton via `play`, `pause`, and `loading` props that accept a string or Svelte snippet

### Patch Changes

- **Fix overlapping annotation lookup** — replace binary search with linear scan + narrowest-span tiebreaker in `getActiveAnnotation`. Fixes wrong segment highlighting for speaker diarization data with overlapping timestamps (#40)
- **Document roving tabindex pattern** — explain focus management in `segmentAttrs` to prevent `aria-activedescendant` conflicts (#41)
- **Wire native media error handling** — add `onerror` handlers to `<audio>`/`<video>` elements with user-friendly error messages. Remove duplicate error handler from Root.svelte. Filter `MEDIA_ERR_ABORTED` during canvas switching (#43)
- **Log non-fatal HLS errors** — non-fatal HLS errors now emit `console.warn` instead of being silently swallowed

## [0.12.0] - 2026-03-10

### Breaking Changes

- **Remove `role="button"` from `SegmentAttrs`** — default segments now render as `<div>` instead of `<button>`, with Enter/Space key activation added for accessibility. Consumers using the `segment` snippet who spread `segmentAttrs` no longer receive `role: "button"`. Update CSS selectors from `button[data-annotation-id]` to `[data-annotation-id]` (#31)

### Patch Changes

- **Comprehensive README revision** — fix 14 factual errors, document Chapters and CanvasNav components, add PlayerContext/PlayerRef type references, correct children snippet fields (#36)
- **Update demo CSS selectors** — all demo components and walkthrough updated to use element-agnostic `[data-annotation-id]` selectors (#33)
- **Add HistoryUnErasedDemo** — new demo component showcasing custom segment snippets with `segmentAttrs` spread

## [0.11.0] - 2026-03-10

### Breaking Changes

- **Remove sync internals from public API** — `SyncController`, `IIIFMediaViewerRef`, `SyncContext`, `SyncEvent`, `SyncPriority`, `SyncConfig`, and `DEFAULT_SYNC_CONFIG` are no longer exported. These were internal to the sync layer and only consumed by `Transcript.svelte`. Use `PlayerRef` and `tryGetPlayerContext()` for external player control (#32)

### Retained Exports

- `Annotation` type, `getActiveAnnotation`, `timeToScrollProgress`, `scrollProgressToTime` remain available as standalone utilities

## [0.10.0] - 2026-03-10

### Minor Changes

- **Export `SegmentAttrs` type** — consumers building custom segment renderers can now import `SegmentAttrs` directly instead of using `SegmentSnippetProps['segmentAttrs']` indexed access (#30)

### Patch Changes

- **Fix unhandled `play()` rejections** — `actions.play()` now catches `NotAllowedError` (autoplay policy) and routes it through `state.error`, consistent with existing error paths. Benign `AbortError` (play interrupted by pause/seek) is silently ignored (#28)

## [0.9.0] - 2026-03-09

### Minor Changes

- **`onPlayerInit` callback and `PlayerRef` type** — new callback fires after manifest fetch and first canvas parse, providing a curated `PlayerRef` handle for external orchestration (state, actions, annotations, chapters, canvas info) without exposing internal implementation details (#26)
- **`tryGetPlayerContext()` utility** — returns `null` instead of throwing when used outside `IIIFPlayer.Root`, enabling dual-mode components that work with or without the player context (#24)

### Patch Changes

- Remove dead `Panel.svelte` and its tests (superseded by compound component API)
- Fix `Search.svelte` double-firing `onmatchchange` on navigation
- Switch `annotations`, `chapters`, `tracks` to `$state.raw` for reduced proxy overhead
- Remove redundant `xstate` from `devDependencies`
- Add Search navigation and callback test coverage (#27)

## [0.7.0] - 2026-03-09

### Minor Changes

- **Segment extension points** — consumers can now fully customize segment rendering via a `segment` snippet prop, which receives annotation data and a `segmentAttrs` spread object for pit-of-success correctness (a11y, keyboard nav, click handling included by default) (#22)
- **`onkeydown` extensibility** — new `onkeydown` prop on TranscriptSegments fires before built-in navigation with full annotation context; call `preventDefault()` to suppress built-in arrow/Home/End nav
- **`highlightedAnnotationId` prop** — supports deep-link highlighting that merges cleanly with search highlights
- **`scrollToAnnotation` imperative API** — accepts optional `ScrollIntoViewOptions` and respects `prefers-reduced-motion` by default; wired through TranscriptContext
- **Roving tabindex refactored to `$derived`** — replaced `$effect`-based focusedIndex with synchronous `$derived` clamping, eliminating render frames with missing tabindex

### Patch Changes

- Input-element guard prevents keyboard nav from hijacking typing in inputs, textareas, and contenteditable elements inside the segments container
- `keyboardNav.ts` `getNextIndex` now returns `null` (instead of current index) for unrecognized keys

## [0.6.1] - 2026-03-06

### Patch Changes

- - Use version-agnostic placeholders in README install examples
  - Fix type inconsistency in test-utils `createContextCapture` cast
  - Add XSS sanitization caution to `text` snippet JSDoc in Segment and TranscriptSegments

## [0.6.0] - 2026-03-06

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
