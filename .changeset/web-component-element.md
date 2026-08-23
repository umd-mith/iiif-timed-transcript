---
"@umd-mith/svelte-iiif-transcript-player": minor
---

New `<iiif-transcript-player>` custom element for pages without a Svelte build: `@umd-mith/svelte-iiif-transcript-player/element` (ESM, `register()`) and `…/element/iife` (`<script src>`, hls.js bundled). Attributes `manifest-url`, `canvas-index` (reflected), `initial-time`, `autoplay`; properties `annotations`, `preprocessManifest`, `errorCallback`, `playerRef`; events `playerrefavailable`, `playererror` (`{ error, fatal, source }`), `canvaschange`; custom-property theming. Core changes: `getPrimaryResource` resolves `Choice` bodies (first Sound/Video; `[Choice{Video}, Image]` now resolves to the video); `IIIFPlayer.Root` gains `preprocessManifest` (bypasses the manifest cache when set).
