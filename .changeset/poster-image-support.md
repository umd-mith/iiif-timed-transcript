---
"@umd-mith/svelte-iiif-transcript-player": minor
---

Add poster image support for video canvases. `IIIFPlayer.Viewer` now accepts a `poster` prop (passed to the native `<video poster>` attribute), and when omitted the poster is auto-derived from the IIIF manifest's `placeholderCanvas`, falling back to `accompanyingCanvas`. A new `getPosterUrl(canvas)` helper is exported for resolving a canvas's poster URL directly.
