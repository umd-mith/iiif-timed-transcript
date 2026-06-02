---
"@umd-mith/svelte-iiif-transcript-player": patch
---

Accessibility: the default transcript segment now exposes `role="button"` (it already had click/keyboard activation and `aria-current`), and the segments container uses the WAI-ARIA Toolbar pattern (`role="toolbar"`, `aria-orientation="vertical"`) so its roving-tabindex arrow-key navigation is conveyed correctly. Resolves the `a11y_no_static_element_interactions`, `a11y_no_noninteractive_tabindex`, and `a11y_no_noninteractive_element_interactions` warnings. The custom-segment `segmentAttrs` API is unchanged (still role-free — consumers own their element semantics).
