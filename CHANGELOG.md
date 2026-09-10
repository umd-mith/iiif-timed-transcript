# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries below version `0.15.0` retain the `Minor Changes` / `Patch Changes` /
`Breaking Changes` groupings from the project's earlier changesets-based workflow.

## [Unreleased]

### Added

- 0cdcdcc: Reading mode — browse and search the transcript without disrupting playback. `IIIFPlayer.Transcript` gains `searchSeekBehavior: "change" | "activate"` (default `"change"`), `scrollToSeek: boolean` (default `true`), and a bindable `readingMode: boolean` (default `false`). A single "Follow along" switch governs whether the panel tracks playback; turning it off enters a detached Browsing state — playback keeps updating the active-passage highlight but never moves the panel or seeks — with a "Jump to current" control to return. `Search` / `TranscriptSearch` gain `onmatchactivate`, `onmatchnavigate`, and a synchronous `onqueryinput`; an explicit "Go to match" activation replaces seek-on-every-selection in `activate` mode, and text-selection no longer triggers a seek. `<iiif-transcript-player>` exposes `search-seek-behavior`, `scroll-to-seek`, and `reading-mode` attributes/properties plus a `:state(browsing)` custom state. Additive and opt-in: with no new props, existing integrations keep today's search-driven and scroll-driven seeking. (#72)

## [0.17.1] - 2026-09-10

### Fixed

- e92c0fb: `videoController` now keeps every seek within `[0, duration]`. The near-end backoff (seek to `duration - 1`) ran after the lower clamp, so a media duration shorter than that one-second backoff produced a negative seek target (e.g. a 0.5-second clip sought to `-0.5`). (#71)

## [0.17.0] - 2026-09-10

### Fixed

- 19071c7: `IIIFPlayer.Captions` now recognizes caption tracks supplied directly to `IIIFPlayer.Viewer` through its `tracks` prop, not only manifest-discovered ones. Previously a video captioned only via the prop rendered the `<track>` but no CC button — and with `Viewer`'s default `controls={false}` the viewer had no way to toggle captions. Viewer reports its effective caption tracks to the player, kept separate from the manifest tracks that drive transcript selection, and re-asserts them after every canvas load (including `actions.retry()`), so the toggle stays live. (#69)
- 19071c7: `actions.retry()` now restarts a failed native media load whose URL is unchanged. It previously cleared the error and re-ran manifest/canvas setup without re-requesting the media, so a native load failure never recovered; retry now calls `load()` on the native element (HLS/DASH re-attach through their own adapters). (#69)

## [0.16.0] - 2026-09-08

### Added

- 504a892: `IIIFPlayer.Root` gains `annotations="auto"`: transcript annotations are built from the manifest — embedded `TextualBody` annotations (motivation `supplementing`, `commenting`, or `tagging`) first, else — only when those yield nothing — the canvas's external WebVTT `supplementing` track, fetched on demand with `media-captions` (now a runtime dependency). New `onError(error, { fatal, source })` prop; `transcriptStatus` on the player context, `PlayerRef`, and the children snippet. `IIIFPlayer.Transcript` gains an optional `loading` snippet that replaces the built-in "Loading transcript…" affordance. `getSupplementaryVTTTracks` now finds VTT tracks inside `Choice` bodies and de-duplicates by `src`; `ExternalResourceSchema` keeps `label`/`language` (tolerantly). New public exports: `selectTranscriptTrack`, `loadVTTTranscript`, `buildAnnotationsFromVTTCues`, `vttCueToPlainText`, and the types `VTTCueTokenizer`, `TranscriptStatus`, `PlayerErrorSource`, `PlayerErrorInfo`. (#58)
- The `<iiif-transcript-player>` custom element, for pages without a Svelte build. Two distributions: `@umd-mith/iiif-timed-transcript/element` (ESM — call `register()` to define the element) and a bundled IIFE file (`dist/element/iiif-transcript-player.iife.js`, hls.js included — a classic `<script src>` that installs `window.IIIFTranscriptPlayer` and registers the element as a side effect of loading; vendor the file directly, it is not resolvable through the package `exports` map). Attributes: `manifest-url`, `canvas-index` (reflected), `initial-time`, `autoplay`, `label` (the player's accessible name), and `crossorigin` (passed through to the media element). Properties: `annotations`, `preprocessManifest`, `errorCallback`, `playerRef`. Events, all `iiif-player-` prefixed: `iiif-player-ready`, `iiif-player-error` (`{ error, fatal, source }`), `iiif-player-canvas-change`, and five playback events for analytics — `iiif-player-play`, `iiif-player-pause`, `iiif-player-ended`, `iiif-player-seeked`, `iiif-player-rate-change`. Host styling: custom-property theming, `::part()` handles (`controls`, `button`, `speed`, `progress`, `transcript`, and each segment), and CSS custom states `:state(playing)`, `:state(loading)`, `:state(error)`. Robustness: host inputs are validated and reported as non-fatal `source: "host"` errors instead of failing silently; a JavaScript property set on the element before it upgrades wins over a same-named attribute (the path a CMS page takes when markup parses before the element's script loads); clearing `manifest-url` unmounts the player and resets `playerRef` to `null`; re-connecting a detached element rebuilds it and fires `iiif-player-ready` again, applying `initial-time` only on the first connection, and a browser atomic move (`moveBefore()`) preserves playback state; element styles are hoisted into constructed stylesheets, so the player renders under a strict Content Security Policy that forbids inline `<style>`; media behind IIIF Auth is reported with `source: "auth"`. Packaging: `package.json` declares `sideEffects` (the IIFE file) so bundlers can drop the unused ESM element, and the package ships `dist/element/custom-elements.json` (a Custom Elements Manifest) guarded by a build-time drift check against the element's real attributes and typed event map. The README covers "Embedding in a CMS" and "Interface Language (i18n)". (#59, #60, #63)
- d42fa68: Manifest handling — `getPrimaryResource` resolves `Choice` bodies (first Sound/Video); `IIIFPlayer.Root` gains `preprocessManifest` (bypasses the manifest cache when set) and ignores a non-integer `switchCanvas` index; IIIF Auth API 1 service references (`@type`/`@id`) are tolerated, so `service[].type` is now optional. (#59)
- dcb4fa6: New interface-language (i18n) registry — `t()`, `setLocale`, `registerTranslation`, and a typed string table (`terms.ts`) route all built-in UI text through one table. The `<iiif-transcript-player>` element reads the page language from the DOM (nearest `lang` attribute, then `<html lang>`, then English); Svelte-API hosts set the `locale` prop themselves. One shared locale per page. (#60)
- 0ad964a: Accessibility — new `IIIFPlayer.Captions` toggle (placed in the element's control bar), a built-in transcript auto-scroll pause control in the transcript panel, and an always-mounted status live region that announces transcript load and failure (WCAG 4.1.3, Status Messages). Forced-colors mode (Windows High Contrast) is supported, and new focus and segment-indicator color tokens convey interface state without relying on color alone (WCAG 1.4.1, Use of Color). (#62)

### Changed

- 504a892: A captioned video whose transcript panel is populated no longer starts with captions showing — every attached track is set to `hidden` once per canvas and never written again (pass `tracks` explicitly to opt out); the tracks stay attached and can be re-enabled from the browser's native caption menu when `Viewer` is given `controls`. A missing `hls.js`/`dashjs` still logs a console warning and now also surfaces as a player error (`state.error` plus `onError` with `source: "media"`). `buildTranscriptAnnotations` now guarantees unique annotation ids when a manifest reuses one id more than twice. (#58)
- 0ad964a: Caption behavior is now governed by a single state machine (`captionsMachine`): once the transcript panel is populated the player hides native captions (the same text is already on screen), a user's caption choice persists for the session and across canvas switches, and only the selected track ever leaves `disabled`. Manifest-derived content language (`lang`) is placed on transcript segment text only, never on the transcript region container (WCAG 3.1.2, Language of Parts). (#62)

### Fixed

- 95bc3f8: Transcript auto-scroll no longer fires on load: the sync controller does not drive media-driven scrolling until playback has actually advanced the time, so the page no longer jumps to the transcript before the user presses play. (#55, #57)
- 0ad964a: The default border color token is darkened to `#767676`; the previous value measured 1.24:1 against white, below the 3:1 minimum for non-text contrast (WCAG 1.4.11). A committed contrast-ratio test (`src/element/contrast.test.ts`) and an axe-core scan of the mounted element now guard these ratios in CI. (#62)

## [0.15.0] - 2026-06-02

### Minor Changes

- 2c60daf: Add poster image support for video canvases. `IIIFPlayer.Viewer` now accepts a `poster` prop (passed to the native `<video poster>` attribute), and when omitted the poster is auto-derived from the IIIF manifest's `placeholderCanvas`, falling back to `accompanyingCanvas`. A new `getPosterUrl(canvas)` helper is exported for resolving a canvas's poster URL directly.

### Patch Changes

- 7718317: Accessibility: the default transcript segment now exposes `role="button"` (it already had click/keyboard activation and `aria-current`). The segments container is a labelled `role="group"` — read-first semantics, since a transcript is primarily readable text rather than a row of action controls — and its roving-tabindex arrow-key navigation remains as a progressive keyboard enhancement. Resolves the `a11y_no_static_element_interactions` and `a11y_no_noninteractive_tabindex` warnings; the container's keydown handler carries a scoped `svelte-ignore` for `a11y_no_noninteractive_element_interactions`. The custom-segment `segmentAttrs` API is unchanged (still role-free — consumers own their element semantics).

## [0.14.1] - 2026-04-21

### Patch Changes

- 03643c9: Add explicit `.js` / `/index.js` extensions to all internal relative imports so the package's `dist/` output conforms to the Node ESM spec (directory imports and extensionless specifiers are not permitted in Node ESM).

  This fixes `ERR_UNSUPPORTED_DIR_IMPORT` and `ERR_MODULE_NOT_FOUND` errors seen when the package is resolved by Node's native resolver — for example during Astro SSR prerendering, or when another Vite plugin (such as `@tailwindcss/vite` v4, which transitively registers a Node ESM loader hook via `@tailwindcss/node`) forwards resolution to Node's defaults.

  No API changes. Consumers using `ssr.noExternal: ['@umd-mith/iiif-timed-transcript']` in their Vite/Astro config remain the recommended pattern for SSR contexts.

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
