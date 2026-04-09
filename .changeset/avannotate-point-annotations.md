---
"@umd-mith/svelte-iiif-transcript-player": minor
---

BREAKING: `buildTranscriptAnnotations()` now returns `{ annotations, skipped }` instead of `Annotation[]`. Annotations without temporal fragments are skipped with structured diagnostics instead of silently defaulting to time 0. Also adds support for AVAnnotate point-in-time annotations (`#t=95,95`) via iiif-media-parsers 0.3.2.
