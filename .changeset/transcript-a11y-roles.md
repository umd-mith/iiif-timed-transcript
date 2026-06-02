---
"@umd-mith/svelte-iiif-transcript-player": patch
---

Accessibility: the default transcript segment now exposes `role="button"` (it already had click/keyboard activation and `aria-current`). The segments container is a labelled `role="group"` — read-first semantics, since a transcript is primarily readable text rather than a row of action controls — and its roving-tabindex arrow-key navigation remains as a progressive keyboard enhancement. Resolves the `a11y_no_static_element_interactions` and `a11y_no_noninteractive_tabindex` warnings; the container's keydown handler carries a scoped `svelte-ignore` for `a11y_no_noninteractive_element_interactions`. The custom-segment `segmentAttrs` API is unchanged (still role-free — consumers own their element semantics).
