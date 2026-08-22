---
"@umd-mith/svelte-iiif-transcript-player": minor
---

`IIIFPlayer.Root` gains `annotations="auto"`: transcript annotations are built from the manifest — embedded `TextualBody` supplementing annotations first, else the canvas's external WebVTT `supplementing` track, fetched on demand with `media-captions` (now a runtime dependency). New `onError(error, { fatal, source })` prop; `transcriptStatus` on the player context, `PlayerRef`, and the children snippet. `getSupplementaryVTTTracks` now finds VTT tracks inside `Choice` bodies and de-duplicates by `src`; `ExternalResourceSchema` keeps `label`/`language` (tolerantly). Behaviour changes: a captioned video whose transcript panel is populated no longer starts with captions showing (they stay available in native controls); a missing `hls.js`/`dashjs` now surfaces as a player error instead of a console warning.
